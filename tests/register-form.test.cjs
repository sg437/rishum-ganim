/* ============================================================================
   בדיקת דפדפן — טופס הרישום הציבורי (register.html) מול גשר מדומה
   ----------------------------------------------------------------------------
   טופס אחד לכל הערים: בורר עיר כשיש כמה ערים, תלמידה ממשיכה לפי ת"ז (רק הגן —
   בלי פרטים אישיים), סינון גנים לפי גיל, בעלי דרכון, צהרון, ביטוח תלמידים
   (קישור תשלום + מספר אישור / התחייבות), ומסלול ערעור / פנייה.
   הרצה:  NODE_PATH=$(npm root -g) node tests/register-form.test.cjs
   ============================================================================ */
const fs=require('fs'), path=require('path');
let chromium;
try{ ({chromium}=require('playwright')); }
catch(e){ console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית).'); process.exit(0); }
const ROOT=path.join(__dirname,'..');
let html=fs.readFileSync(path.join(ROOT,'register.html'),'utf8');
html=html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/,'');
/* המעבר לכתובת החיה רלוונטי רק בדומיין הישן — כאן מנוטרל */
html=html.replace('if(location.hostname!=="rishum-ganim.pages.dev")return;','return;');
const PORT=8751;
const server=require('http').createServer((req,res)=>{
  const f=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');
  if(f==='register.html'){ res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); return res.end(html); }
  /* רק קבצים מרשימה סגורה שבשורש הפרויקט — שום נתיב מהבקשה אינו נבנה ישירות */
  const STATIC={ 'ui-lab.js':'text/javascript', 'ui-lab.css':'text/css', 'sw.js':'text/javascript' };
  if(!Object.prototype.hasOwnProperty.call(STATIC, f)){ res.writeHead(404); return res.end('nf'); }
  try{ const body=fs.readFileSync(path.join(ROOT, Object.keys(STATIC).find(k=>k===f))); res.writeHead(200,{'Content-Type':STATIC[f]}); res.end(body); }
  catch(e){ res.writeHead(404); res.end('nf'); }
});
let pass=0, fail=0;
const check=(name, ok, extra)=>{ if(ok){ pass++; console.log('✅ '+name); } else { fail++; console.log('❌ '+name+(extra?' → '+extra:'')); } };
const CFG={ beitar:{ cityId:'beitar', cityName:'ביתר עילית', year:'תשפ"ז', gans:[{name:'גן הדקל',symbol:'111',address:'הרב שך 5',age:'3'},{name:'גן התמר',symbol:'222',address:'',age:'4'},{name:'גן הזית',symbol:'333',address:'',age:'4/5'}],
  ages:['3','4','5'], insurancePayUrl:'https://pay.example.com/ins', tzaharonOffer:true, appealsOn:true, ownership:{name:'רשת'} },
  modiin:{ cityId:'modiin-illit', cityName:'מודיעין עילית', year:'תשפ"ז', gans:[{name:'גן א',symbol:'9',address:'',age:'3'}], ages:['3'], insurancePayUrl:'', tzaharonOffer:false, ownership:{name:'רשת'} } };
(async()=>{
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  const b=await chromium.launch({ executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  const pg=await b.newPage(); const errors=[]; pg.on('pageerror',e=>errors.push(e.message));
  const calls=[];
  await pg.route('**',async r=>{
    const u=r.request().url();
    if(u.startsWith('http://127.0.0.1:'+PORT+'/')) return r.continue();
    let host=''; try{ host=new URL(u).hostname; }catch(e){}
    if(host==='script.google.com'){
      let body={}; try{ const q=new URL(u).searchParams.get('data'); body=JSON.parse(q||r.request().postData()||'{}'); }catch(e){}
      calls.push(body);
      const city=body.cityId==='beitar'?CFG.beitar:(body.cityId==='modiin-illit'?CFG.modiin:null);
      let out={ ok:true };
      if(body.action==='regConfigGet') out={ ok:true, config:city||{}, cities:[{id:'modiin-illit',name:'מודיעין עילית'},{id:'beitar',name:'ביתר עילית'}] };
      if(body.action==='regLookup') out= String(body.tz).replace(/\D/g,'')==='123456782' ? { ok:true, found:true, gan:{ symbol:'222', name:'גן התמר', age:'4' } } : { ok:true, found:false };
      return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(out) });
    }
    return r.abort();
  });

  await pg.goto('http://127.0.0.1:'+PORT+'/register.html'); await pg.waitForTimeout(300);
  check('כמה ערים בלי ?city — בורר עיר לפני הטופס', await pg.evaluate(()=>document.getElementById('cityCard').style.display!=='none' && document.getElementById('citySel').options.length===3 && document.getElementById('formCard').style.display==='none'));

  await pg.goto('http://127.0.0.1:'+PORT+'/register.html?city=beitar'); await pg.waitForTimeout(300);
  check('?city=beitar — הטופס של העיר, עם שם העיר בכותרת', await pg.evaluate(()=>document.getElementById('formCard').style.display!=='none' && /ביתר עילית/.test(document.getElementById('mainTitle').textContent)));
  check('כל קריאה לגשר נושאת את העיר שנבחרה', calls.filter(c=>c.action==='regConfigGet').every(c=>!c.cityId || c.cityId==='beitar') && calls.some(c=>c.action==='regConfigGet' && c.cityId==='beitar'));
  check('סינון גנים לפי גיל: גיל 4 → גן התמר וגן הזית (דו-גילאי) בלבד', await pg.evaluate(()=>{ const s=document.getElementById('ageSel'); s.value='4'; s.dispatchEvent(new Event('change')); return [...document.querySelectorAll('#ganList option')].map(o=>o.value).sort().join(',')==='גן הזית,גן התמר'; }));
  await pg.fill('#childTz','123456782'); await pg.dispatchEvent('#childTz','change'); await pg.waitForTimeout(250);
  const ret=await pg.evaluate(()=>({ gan:document.getElementById('ganName').value, sym:document.getElementById('ganSymbol').value, note:document.getElementById('returnNote').textContent, street:document.getElementById('street').value }));
  check('תלמידה ממשיכה: לפי ת"ז נבחר הגן שאליו היא עולה — ופרטים אישיים לא מתמלאים', ret.gan==='גן התמר' && ret.sym==='222' && /ממשיכה/.test(ret.note) && ret.street==='', JSON.stringify(ret));
  check('הגשר מקבל לחיפוש רק ת"ז — ומחזיר רק גן', calls.some(c=>c.action==='regLookup' && c.cityId==='beitar' && c.tz==='123456782'));
  check('בעלי דרכון: נפתחים שדות נספח ב׳ ודרכונים', await pg.evaluate(()=>{ const c=document.getElementById('isPassport'); c.checked=true; c.dispatchEvent(new Event('change')); return document.getElementById('passportDocs').style.display==='' && /דרכון/.test(document.getElementById('childTzLbl').textContent); }));
  check('צהרון מוצע (לפי הגדרות העיר) · ביטוח: כפתור תשלום עם הקישור + שדה מספר אישור', await pg.evaluate(()=>document.getElementById('tzBox').style.display==='' && document.getElementById('insPay').style.display==='' && document.getElementById('insPayBtn').getAttribute('href')==='https://pay.example.com/ins'));
  /* שליחה בלי מספר אישור ביטוח — נחסמת */
  await pg.evaluate(()=>{ const c=document.getElementById('isPassport'); c.checked=false; c.dispatchEvent(new Event('change'));
    document.getElementById('childFirst').value='נועה'; document.getElementById('childLast').value='כהן'; document.getElementById('parentName').value='שרה';
    const cv=document.getElementById('sign'); const ctx=cv.getContext('2d'); ctx.fillRect(1,1,5,5); });
  await pg.evaluate(()=>{ const cv=document.getElementById('sign'); const r=cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+10,clientY:r.top+10,pointerId:1})); cv.dispatchEvent(new PointerEvent('pointerup',{pointerId:1})); });
  await pg.click('#submitBtn'); await pg.waitForTimeout(150);
  check('ביטוח: בלי מספר אישור התשלום — הרישום לא נשלח', await pg.evaluate(()=>/ביטוח/.test(document.getElementById('msg').textContent)) && !calls.some(c=>c.action==='regSubmit'));
  await pg.fill('#insRef','A-998877'); await pg.check('#tzaharon'); await pg.click('#submitBtn'); await pg.waitForTimeout(600);
  const sub=calls.find(c=>c.action==='regSubmit');
  check('רישום נשלח עם העיר, הגיל, מספר אישור הביטוח, הצהרון וסימון "ממשיכה"', !!sub && sub.cityId==='beitar' && sub.data.insurancePayRef==='A-998877' && sub.data.tzaharon===true && sub.data.returning===true && sub.data.age==='4', JSON.stringify(sub&&sub.data&&{c:sub.cityId,r:sub.data.insurancePayRef,t:sub.data.tzaharon,ret:sub.data.returning,a:sub.data.age}));
  check('מסך הסיום: הרישום אינו מחייב קבלה — אישור שיבוץ יישלח', await pg.evaluate(()=>/אינו מחייב/.test(document.getElementById('formCard').textContent)));

  await pg.goto('http://127.0.0.1:'+PORT+'/register.html?city=modiin-illit'); await pg.waitForTimeout(300);
  check('עיר בלי קישור תשלום — התחייבות לתשלום ביטוח · בלי צהרון', await pg.evaluate(()=>document.getElementById('insPay').style.display==='none' && document.getElementById('insPledgeBox').style.display!=='none' && document.getElementById('tzBox').style.display==='none'));
  check('בתחתית הטופס — קישור לטופס ערעור של אותה עיר', await pg.evaluate(()=>/appeal=1/.test(document.getElementById('appealLink').getAttribute('href')) && /city=modiin-illit/.test(document.getElementById('appealLink').getAttribute('href'))));

  await pg.goto('http://127.0.0.1:'+PORT+'/register.html?appeal=1&city=beitar'); await pg.waitForTimeout(300);
  check('טופס ערעור: נפתח במקום טופס הרישום', await pg.evaluate(()=>document.getElementById('appealCard').style.display!=='none' && document.getElementById('formCard').style.display==='none'));
  await pg.fill('#apChild','נועה כהן'); await pg.fill('#apTz','123456782'); await pg.fill('#apPhone','0501234567'); await pg.fill('#apWant','גן הדקל'); await pg.fill('#apText','מבקשים לעבור גן'); await pg.click('#apSend'); await pg.waitForTimeout(300);
  const ap=calls.find(c=>c.action==='appealSubmit');
  check('ערעור נשלח לגשר עם העיר והפרטים', !!ap && ap.cityId==='beitar' && ap.data.childName==='נועה כהן' && ap.data.wantGan==='גן הדקל' && ap.data.text==='מבקשים לעבור גן');
  check('אין שגיאות JS', !errors.length, errors.join(' | '));
  await b.close(); server.close();
  console.log(`\n${pass} עברו · ${fail} נכשלו`); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
