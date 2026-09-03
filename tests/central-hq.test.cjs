/* ============================================================================
   בדיקת דפדפן — המרכזי: מודולי מחלקת הרישום (Playwright + Chromium)
   ----------------------------------------------------------------------------
   טוענת את management.html האמיתי בלי רשת: Firebase מוחלף ב-stub שמדמה את
   השכבה החיה (org/meta, אוספי הערים, אחסון המרכזי org/hq), ומוודאת:
     • אחרי כניסה כל המסכים החיים נפתחים בלי שגיאות ומציגים את הנתונים
       (תלמידים מכל הערים, צוות, פילוחים, רישיון/סייעת ב׳, בקרת משרד החינוך,
       פניות, החלטות, ערוצי רישום, הפצה, חוזרים, Smoove, מרכז הודעות, הגדרות).
     • שיבוץ מרכזי כותב לתיק במסמך השנה של העיר במבנה של תוכנת העיר (דחוס).
     • ייבוא מוסיף תיקים למסמך השנה בלי לדרוס קיימים.
     • הרשאות לפי משתמש/ת (צפייה / אין) נאכפות בממשק.
     • מסכי ההדמיה מסומנים "יופעל בהמשך" ולא נמחקו.
     • הייצוא בונה שורות לפי בחירת השדות.
   הרצה:  NODE_PATH=$(npm root -g) node tests/central-hq.test.cjs
   ============================================================================ */
const fs=require('fs'), path=require('path');
let chromium;
try{ ({chromium}=require('playwright')); }
catch(e){ console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית).'); process.exit(0); }
const ROOT=path.join(__dirname,'..');
const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'rg-hq-'));
let html=fs.readFileSync(path.join(ROOT,'management.html'),'utf8');
html=html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/,'');
html=html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g,'./fbstub.js');
fs.writeFileSync(path.join(TMP,'management.html'),html);
/* --- Firebase מדומה: מסמכים בזיכרון, onSnapshot מיידי, טרנזקציה אמיתית על המסמך --- */
fs.writeFileSync(path.join(TMP,'fbstub.js'),`
const noop=()=>{};
window.__docs=window.__docs||{}; window.__listeners=[];
const key=(segs)=>segs.join('/');
export const initializeApp=()=>({name:'stub'});
export const getAuth=()=>({currentUser:null});
export const onAuthStateChanged=(a,cb)=>{ window.__authCb=cb; setTimeout(()=>cb(window.__user||null),0); return noop; };
export const signInWithPopup=()=>Promise.resolve(), signOut=()=>Promise.resolve();
export class GoogleAuthProvider{ setCustomParameters(){} }
export const initializeFirestore=()=>({stub:true});
export const doc=(db,...segs)=>({ path:key(segs), kind:'doc' });
export const collection=(db,...segs)=>({ path:key(segs), kind:'coll' });
function snapDoc(p){ const d=window.__docs[p]; return { exists:()=>!!d, data:()=>d, id:p.split('/').pop(), metadata:{fromCache:false} }; }
function collDocs(p){ return Object.keys(window.__docs).filter(k=>k.startsWith(p+'/') && k.slice(p.length+1).indexOf('/')<0).map(k=>({ id:k.split('/').pop(), data:()=>window.__docs[k] })); }
function fire(p){ window.__listeners.forEach(l=>{ if(l.ref.kind==='doc' && l.ref.path===p) l.cb(snapDoc(p)); if(l.ref.kind==='coll' && p.startsWith(l.ref.path+'/')){ const docs=collDocs(l.ref.path); l.cb({ docs, docChanges:()=>docs.map(d=>({ type:'modified', doc:d })), metadata:{fromCache:false} }); } }); }
window.__fire=fire;
export const onSnapshot=(ref,opts,cb,err)=>{ const f=typeof opts==='function'?opts:cb; const l={ref,cb:f}; window.__listeners.push(l);
  setTimeout(()=>{ if(ref.kind==='doc') f(snapDoc(ref.path)); else { const docs=collDocs(ref.path); f({ docs, docChanges:()=>docs.map(d=>({ type:'added', doc:d })), metadata:{fromCache:false} }); } },0); return noop; };
export const setDoc=(ref,data,opts)=>{ window.__writes=(window.__writes||[]); window.__writes.push({path:ref.path,data:JSON.parse(JSON.stringify(data)),merge:!!(opts&&opts.merge)}); window.__docs[ref.path]=(opts&&opts.merge)?Object.assign({},window.__docs[ref.path]||{},data):JSON.parse(JSON.stringify(data)); fire(ref.path); return Promise.resolve(); };
export const deleteDoc=(ref)=>{ delete window.__docs[ref.path]; fire(ref.path); return Promise.resolve(); };
export const runTransaction=async(db,fn)=>{ const tx={ get:async(ref)=>snapDoc(ref.path), set:(ref,data)=>{ window.__docs[ref.path]=JSON.parse(JSON.stringify(data)); window.__txWrites=(window.__txWrites||[]); window.__txWrites.push({path:ref.path,data:window.__docs[ref.path]}); fire(ref.path); } }; return fn(tx); };
export const initializeAppCheck=()=>({}); export class ReCaptchaV3Provider{}
`);
const PORT=8741;
const server=require('http').createServer((req,res)=>{
  const f=path.join(TMP, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''));
  try{ const body=fs.readFileSync(f); const ct=f.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'; res.writeHead(200,{'Content-Type':ct}); res.end(body); }
  catch(e){ res.writeHead(404); res.end('nf'); }
});
/* --- נתוני דוגמה: שתי ערים, במבנה שתוכנת העיר כותבת (תיקים דחוסים) --- */
const YEAR='תשפ"ז';
const DATA={
  'org/meta': { cities:[ {id:'beitar',name:'ביתר עילית',region:'ירושלים',absorption:'office',placement:'office',coordinator:'רכזת ביתר',active:true} ], users:{ 'hq@example.com':{ name:'מרכז', hq:true, cities:{} }, 'view@example.com':{ name:'צופה', hq:true, cities:{} }, 'beitar-user@example.com':{ name:'עובדת ביתר', hq:false, cities:{ beitar:'edit' } } } },
  'org/hq': { thresholds:{ license:35, assistantB:30, requestDays:7 }, perms:{ 'view@example.com':{ students:'view', import:'none' } }, contacts:{ beitar:{ intake:{ name:'ר. פלר', phone:'050-1111111', email:'feller@example.com' }, coordinator:{ name:'רכזת ביתר', phone:'', email:'coord@example.com' } } }, bounces:{ 'modiin-illit|bad@example.com':{ at:1 } } },
  'org/hq/requests/r1': { cityId:'modiin-illit', cityName:'מודיעין עילית', studentId:'s2', who:'ילדה ב כהן', type:'ערעור על שיבוץ', status:'open', text:'מבקשים גן קרוב יותר', createdAt:Date.now()-10*86400000, due:'2020-01-01', log:[] },
  'org/hq/decisions/d1': { title:'פתיחת גן נוסף בביתר', status:'open', context:'40 ממתינות', createdAt:Date.now()-86400000 },
  'org/hq/ministry/modiin-illit': { cityName:'מודיעין עילית', students:{ '000000018':{ status:'ok', name:'ילדה א' }, '000000026':{ status:'missing', note:'לא מופיעה', name:'ילדה ב' } }, checkedAt:Date.now() },
  'org/hq/circulars/c1': { title:'חוזר מנכ״ל רישום תשפ״ז', audience:'coordinators', status:'draft', emphasis:'גיל הרישום' },
  'app/meta': { activeYear:YEAR, years:[YEAR], settings:{ admins:['admin@example.com'], userActivity:{ 'admin@example.com':{ ts:Date.now()-1000, name:'צ. שפירא', last:'עדכון תיק' } }, staffRoles:['גננת','סייעת',"סייעת ב'"] }, assignments:{ [YEAR]:{ activity:{ g1:{ 'גננת':{ staffId:'st1', name:'שרה לוי' } }, g2:{ 'גננת':{ staffId:'st2', name:'רבקה כהן' } } }, tzaharon:{ g1:{ 'סייעת':{ staffId:'st1', name:'שרה לוי', days:'א,ב' } } } } } },
  'app/gans': { gans:[ { id:'g1', ganName:'גן הדקל', ganSymbol:'111', age:'3', education:'רגיל', gender:'בנות', capacity:'35', licenseCap:'2', assignCap:'', active:true, street:'הרב שך', building:'5', geo:{ lat:31.93, lng:35.04 } }, { id:'g2', ganName:'גן התמר', ganSymbol:'222', age:'4', education:'רגיל', gender:'בנות', capacity:'', licenseCap:'', active:true }, { id:'g3', ganName:'גן כבוי', age:'5', education:'רגיל', active:false } ] },
  'app/staff': { staff:[ { id:'st1', lastName:'לוי', firstName:'שרה', role:'גננת', tz:'123456782', mobile:'0501234567', email:'sara@example.com', active:true }, { id:'st2', lastName:'כהן', firstName:'רבקה', role:'גננת', active:true }, { id:'st3', lastName:'עזבה', firstName:'מישהי', role:'סייעת', active:false } ] },
  'app/management': { management:[ { id:'m1', dept:'כספים', name:'יוסי', role:'גזבר', email:'y@example.com' } ] },
  ['app/students_'+YEAR.replace(/[^0-9A-Za-z֐-׿]/g,'_')]: { year:YEAR, students:[
    { id:'s1', year:YEAR, tz:'18', firstName:'ילדה', lastName:'א', ganId:'g1', age:'3', mobile:'0521111111', email:'a@example.com', absorbedMunicipality:true, programs:{ tzaharon:true }, createdAt:new Date().toISOString() },
    { id:'s2', year:YEAR, tz:'26', firstName:'ילדה', lastName:'ב', ganId:'g1', age:'3', placed:false, email:'bad@example.com', period:'ב', createdAt:new Date(Date.now()-3*86400000).toISOString() },
    { id:'s3', year:YEAR, tz:'', firstName:'ילדה', lastName:'ג', ganId:'g1', age:'4', createdAt:'2026-01-01T00:00:00.000Z' },
    { id:'s4', year:YEAR, tz:'34', firstName:'סיימה', lastName:'ד', ganId:'g2', finished:true }
  ] },
  'app/presence_admin_example_com': { email:'admin@example.com', name:'צ. שפירא', ts:Date.now() },
  'cities/beitar/app/meta': { activeYear:YEAR, years:[YEAR], settings:{}, assignments:{} },
  'cities/beitar/app/gans': { gans:[ { id:'b1', ganName:'גן ביתר א', age:'3', education:'ח"מ', gender:'בנות', capacity:'12', active:true } ] },
  'cities/beitar/app/staff': { staff:[] },
  ['cities/beitar/app/students_'+YEAR.replace(/[^0-9A-Za-z֐-׿]/g,'_')]: { year:YEAR, students:[ { id:'b-s1', year:YEAR, tz:'42', firstName:'ילדה', lastName:'ביתר', ganId:'', education:'ח"מ', age:'3', placed:false } ] }
};
(async()=>{
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  const b=await chromium.launch({ executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
  const pg=await b.newPage({ viewport:{ width:1280, height:900 } });
  const errors=[];
  pg.on('pageerror',e=>errors.push('pageerror: '+e.message));
  const BENIGN=/Failed to load resource|net::ERR_|leaflet|unpkg/i;
  pg.on('console',m=>{ if(m.type()==='error' && !BENIGN.test(m.text())) errors.push('console: '+m.text()); });
  pg.on('dialog',d=>d.accept());
  await pg.route('**',r=>{ const u=r.request().url(); if(u.startsWith('http://127.0.0.1:'+PORT+'/')) return r.continue(); return r.abort(); });
  await pg.addInitScript((data)=>{ window.__docs=JSON.parse(JSON.stringify(data)); const em=new URLSearchParams(location.search).get('as')||'hq@example.com'; window.__user={ email:em, displayName:'מרכז', getIdToken:()=>Promise.resolve('tok') }; }, DATA);
  await pg.goto('http://127.0.0.1:'+PORT+'/management.html',{ waitUntil:'domcontentloaded', timeout:20000 });
  await pg.waitForTimeout(900);
  let fail=0;
  const step=async(name,fn)=>{ const before=errors.length; let r; try{ r=await fn(); }catch(e){ r='EX: '+e.message; } const newErr=errors.slice(before); const ok=r===true && !newErr.length; if(!ok){ fail++; console.log('❌ '+name+(r!==true?(' → '+r):'')+(newErr.length?('\n   '+newErr.join('\n   ')):'')); } else console.log('✅ '+name); };
  const go=async(v)=>{ await pg.evaluate(v=>window.__central.switchTab(v), v); await pg.waitForTimeout(120); };
  const txt=async(sel)=>pg.evaluate(s=>(document.querySelector(s)||{}).textContent||'', sel);

  await step('כניסה: מצב חי, שתי ערים, המסכים החיים בתפריט ומסכי ההדמיה מסומנים "יופעל בהמשך"', async()=>{
    const r=await pg.evaluate(()=>({ live:window.__central.live, n:window.__central.cities.length, ab:document.getElementById('abLiveTxt').textContent,
      liveNav:[...document.querySelectorAll('#drawerNav .navitem[data-live]')].filter(b=>!b.hidden).length,
      later:[...document.querySelectorAll('#drawerNav .navitem.later')].filter(b=>!b.hidden).map(b=>b.dataset.view).sort(),
      topnav:!!document.querySelector('#topnav .tn-group'), body:document.body.classList.contains('livemode') }));
    return (r.live && r.n===2 && /2 ערים/.test(r.ab) && r.liveNav>=15 && JSON.stringify(r.later)===JSON.stringify(['billing','crm','docs','hours','plan','portal','spec']) && r.topnav && r.body) || JSON.stringify(r);
  });
  await step('מסך הדמיה במצב חי מקבל באנר "יופעל בהמשך" ולא נמחק', async()=>{ await go('crm'); const t=await txt('#view-crm .later-banner'); const has=await pg.evaluate(()=>!!document.getElementById('crmTable')); return (/יופעל בהמשך/.test(t) && has) || t; });
  await step('תלמידים · כל הערים: כל התיקים הפעילים משתי הערים, עם עירייה/שיבוץ/משרד החינוך', async()=>{
    await go('students'); const r=await pg.evaluate(()=>({ rows:document.querySelectorAll('#stuTable tbody tr[data-id]').length, t:document.getElementById('hqStudents').textContent }));
    return (r.rows===4 && /ביתר עילית/.test(r.t) && /מודיעין עילית/.test(r.t) && /קלוט\/ה/.test(r.t) && /ממתין\/ה/.test(r.t) && /מתוקצב\/ת/.test(r.t) && /לא נקלט\/ה/.test(r.t) && /ללא גן/.test(r.t)) || JSON.stringify({rows:r.rows});
  });
  await step('סינון: ממתינים לשיבוץ בלבד, וחיפוש לפי ת"ז', async()=>{
    await pg.selectOption('#hqStudents [data-f="place"]','waiting'); await pg.waitForTimeout(100);
    const n1=await pg.evaluate(()=>document.querySelectorAll('#stuTable tbody tr[data-id]').length);
    await pg.selectOption('#hqStudents [data-f="place"]',''); await pg.waitForTimeout(100);
    await pg.fill('#stuQ','26'); await pg.waitForTimeout(450);
    const n2=await pg.evaluate(()=>document.querySelectorAll('#stuTable tbody tr[data-id]').length);
    await pg.fill('#stuQ',''); await pg.waitForTimeout(450);
    return (n1===1 && n2===1) || JSON.stringify({n1,n2});
  });
  await step('תיק במגירה: כל הקבוצות, הפנייה הפתוחה, ומייל שחזר', async()=>{
    await pg.click('#stuTable tbody tr[data-id="s2"]'); await pg.waitForTimeout(120);
    const t=await txt('#hqDrawerBody'); const open=await pg.evaluate(()=>document.getElementById('hqDrawer').classList.contains('open'));
    return (open && /הורים וכתובת/.test(t) && /ערעור על שיבוץ/.test(t) && /\(חזר\)/.test(t) && /קליטה בעירייה/.test(t)) || t.slice(0,120);
  });
  await step('שיבוץ מרכזי: נכתב לתיק במסמך השנה של העיר, דחוס, בלי לגעת בשאר התיקים', async()=>{
    await pg.click('#sd-place'); await pg.waitForTimeout(100);
    await pg.selectOption('#pl-gan','g2'); await pg.selectOption('#pl-final','1'); await pg.fill('#pl-note','שובץ מהמרכזי');
    await pg.click('#pl-ok'); await pg.waitForTimeout(400);
    const r=await pg.evaluate(()=>{ const w=(window.__txWrites||[]).slice(-1)[0]; if(!w) return {none:true}; const s=w.data.students; const s2=s.find(x=>x.id==='s2'); return { path:w.path, n:s.length, s2, s1:s.find(x=>x.id==='s1'), audit:Object.keys(window.__docs).some(k=>k.startsWith('org/hq/audit/')) }; });
    return (r.path==='app/students_'+YEAR.replace(/[^0-9A-Za-z֐-׿]/g,'_') && r.n===4 && r.s2 && r.s2.ganId==='g2' && !('placed' in r.s2) && /שובץ מהמרכזי/.test(r.s2.notes) && !('docs' in r.s2) && r.s1 && r.s1.absorbedMunicipality===true && r.audit) || JSON.stringify(r);
  });
  await step('ייצוא לפי בחירת שדות: תצוגה מקדימה עם העמודות שנבחרו', async()=>{
    await pg.click('#stuExport'); await pg.waitForTimeout(120);
    const r=await pg.evaluate(()=>({ open:document.getElementById('hqModalWrap').classList.contains('open'), heads:[...document.querySelectorAll('#xp-prev thead th')].map(x=>x.textContent), rows:document.querySelectorAll('#xp-prev tbody tr').length, n:document.getElementById('xp-n').textContent }));
    await pg.click('#xp-none'); await pg.waitForTimeout(50); const h2=await pg.evaluate(()=>document.querySelectorAll('#xp-prev thead th').length);
    await pg.click('#xp-close');
    return (r.open && r.heads.includes('עיר') && r.heads.includes('קלוט בעירייה') && r.heads.includes('משרד החינוך') && r.rows===4 && h2===0) || JSON.stringify(r);
  });
  await step('עובדות: הרשימה החיה עם שיבוצים לפי הקשר, וייצוא', async()=>{
    await go('staff'); const r=await pg.evaluate(()=>({ rows:document.querySelectorAll('#stfTable tbody tr[data-id]').length, t:document.getElementById('hqStaff').textContent, demoHidden:document.getElementById('staffDemoCard').style.display==='none' }));
    await pg.selectOption('#hqStaff [data-f="status"]','all'); await pg.waitForTimeout(100); const all=await pg.evaluate(()=>document.querySelectorAll('#stfTable tbody tr[data-id]').length);
    return (r.rows===2 && all===3 && /גן הדקל · גננת/.test(r.t) && /צהרונים: גן הדקל/.test(r.t) && r.demoHidden) || JSON.stringify({rows:r.rows,all});
  });
  await step('ייבוא מאקסל: מיפוי עמודות, תצוגה מקדימה, וכתיבה למסמך השנה בלי לדרוס קיימים', async()=>{
    await go('import');
    await pg.fill('#impPaste','שם משפחה\tשם פרטי\tת"ז\tגן\tנייד\tקלוט בעירייה\nחדשה\tרחל\t0012345\tהדקל\t521234567\tכן\nכפולה\tילדה\t18\tגן התמר\t\t\n');
    await pg.click('#impPasteBtn'); await pg.waitForTimeout(150);
    const map=await pg.evaluate(()=>[...document.querySelectorAll('.imp-sel')].map(s=>s.value));
    const kp=await txt('#impPreview');
    await pg.click('#impGo'); await pg.waitForTimeout(400);
    const r=await pg.evaluate(()=>{ const w=(window.__txWrites||[]).slice(-1)[0]; const s=w.data.students; const nw=s.find(x=>x.lastName==='חדשה'); return { n:s.length, nw, imp:Object.keys(window.__docs).some(k=>k.startsWith('org/hq/imports/')) }; });
    return (JSON.stringify(map)===JSON.stringify(['lastName','firstName','tz','gan','mobile','absorbed']) && /ייפתחו תיקים/.test(kp) && r.n===5 && r.nw && r.nw.ganId==='g1' && r.nw.tz==='0012345' && r.nw.mobile==='0521234567' && r.nw.absorbedMunicipality===true && r.nw.registeredByUs===undefined && r.imp) || JSON.stringify({map, n:r.n, nw:r.nw});
  });
  await step('פילוחים: מסכם, לפי עיר, רשומות שגויות, ומצבה חודשית נשמרת', async()=>{
    await go('breakdowns'); const t1=await txt('#bdBody');
    await pg.click('#hqBreakdowns [data-t="cities"]'); await pg.waitForTimeout(80); const rows=await pg.evaluate(()=>document.querySelectorAll('#bdCityT tbody tr').length);
    await pg.click('#hqBreakdowns [data-t="errors"]'); await pg.waitForTimeout(80); const te=await txt('#bdBody');
    await pg.click('#hqBreakdowns [data-t="mgmt"]'); await pg.waitForTimeout(80); const tm=await txt('#bdBody');
    await pg.click('#hqBreakdowns [data-t="snap"]'); await pg.waitForTimeout(80); await pg.fill('#snapLabel','מצבת בדיקה'); await pg.click('#snapSave'); await pg.waitForTimeout(250);
    const snap=await pg.evaluate(()=>{ const k=Object.keys(window.__docs).find(k=>k.startsWith('org/hq/snapshots/')); return k?window.__docs[k]:null; });
    return (/לפי גיל/.test(t1) && rows===2 && /בלי ת"ז/.test(te) && /מייל חזר/.test(te) && /חריגה/.test(te)===false && /מי עבד\/ה/.test(tm) && /צ\. שפירא/.test(tm) && snap && snap.label==='מצבת בדיקה' && snap.totals.n===5 && !!snap.perCity.beitar) || JSON.stringify({rows, snap:!!snap});
  });
  await step('רישיון וסייעת ב׳: גן מעל מכסת הרישיון קופץ, ועדכון טיפול נשמר כדגל', async()=>{
    await go('license'); const t=await txt('#hqLicense');
    await pg.click('#hqLicense [data-fl^="license|"]'); await pg.waitForTimeout(80); await pg.selectOption('#pf-status','requested'); await pg.click('#pf-ok'); await pg.waitForTimeout(200);
    const f=await pg.evaluate(()=>window.__docs['org/hq/flags/license_modiin-illit_g1']);
    return (/נדרשת הגדלת רישיון/.test(t) && /גן הדקל/.test(t) && f && f.status==='requested' && f.snapshot>=2) || JSON.stringify({t:t.slice(0,80), f});
  });
  await step('בקרת משרד החינוך: מצב לכל תלמיד/ה והצלבת מצבה מהקובץ', async()=>{
    await go('ministry'); const t=await txt('#hqMinistry');
    const ok=/מתוקצב\/ת/.test(t) && /לא נקלט\/ה/.test(t);
    const r=await pg.evaluate(()=>{ return new Promise(res=>{ const f=new File(['ת"ז,סמל מוסד\n18,111\n26,999\n77,111\n'],'moe.csv',{type:'text/csv'}); const inp=document.getElementById('moeFile'); const dt=new DataTransfer(); dt.items.add(f); inp.files=dt.files; inp.dispatchEvent(new Event('change')); setTimeout(()=>{ res(window.__docs['org/hq/ministry/modiin-illit']); },500); }); });
    return (ok && r && r.students['000000018'].status==='ok' && r.students['000000026'].status==='error' && r.extra.includes('000000077')) || JSON.stringify({ok, r:r&&r.students});
  });
  await step('פניות וערעורים: הפנייה הפתוחה באיחור, ופתיחת פנייה חדשה מהמסך', async()=>{
    await go('requests'); const t=await txt('#hqRequests');
    await pg.click('#rqAdd'); await pg.waitForTimeout(80); await pg.fill('#pf-who','משפחת בדיקה'); await pg.fill('#pf-text','בקשה'); await pg.click('#pf-ok'); await pg.waitForTimeout(200);
    const n=await pg.evaluate(()=>Object.keys(window.__docs).filter(k=>k.startsWith('org/hq/requests/')).length);
    return (/באיחור/.test(t) && /ילדה ב כהן/.test(t) && n===2) || JSON.stringify({n});
  });
  await step('דורש טיפול: רישיון, פנייה באיחור, משרד החינוך, החלטה, רשומות שגויות, ממתינים', async()=>{
    await go('followups'); const t=await txt('#hqFollowups');
    return (/הגדלת רישיון/.test(t) && /פנייה באיחור/.test(t) && /משרד החינוך/.test(t) && /ממתין להחלטה/.test(t) && /רשומות שגויות/.test(t) && /ממתינים לשיבוץ/.test(t) && /מיילים חזרו/.test(t)) || t.slice(0,200);
  });
  await step('ערוצי רישום ואחראיות קליטה: אחראית הקליטה, אופן הקליטה והשיבוץ, ושמירת פרטי נדרים', async()=>{
    await go('channels'); const t=await txt('#hqChannels');
    await pg.fill('#ndContact','נציג נדרים'); await pg.click('#ndSave'); await pg.waitForTimeout(150);
    const nd=await pg.evaluate(()=>window.__docs['org/hq'].nedarim);
    return (/ר\. פלר/.test(t) && /קליטה במשרד הראשי/.test(t) && /שיבוץ במשרד הראשי/.test(t) && /יופעל בהמשך/.test(t) && nd && nd.contact==='נציג נדרים') || JSON.stringify({nd});
  });
  await step('הפצה ופרסום: סימון שלב נשמר עם תאריך ומי סימן', async()=>{
    await go('distribution'); await pg.click('#hqDistribution [data-ds="beitar|design"]'); await pg.waitForTimeout(200);
    const d=await pg.evaluate(()=>window.__docs['org/hq/tracking/dist_beitar']);
    return (d && d.steps.design.done && d.steps.design.by==='hq@example.com') || JSON.stringify(d);
  });
  await step('חוזרי מנכ״ל: "שליחה לרכזים" פותחת את מרכז ההודעות עם הנוסח והנמענים', async()=>{
    await go('circulars'); await pg.click('#hqCirculars [data-cr-send]'); await pg.waitForTimeout(250);
    await pg.click('#cmShowList'); await pg.waitForTimeout(100);
    const r=await pg.evaluate(()=>({ view:window.__central.view, subj:(document.getElementById('cmSubject')||{}).value, t:document.getElementById('hqModalBody').textContent, st:window.__docs['org/hq/circulars/c1'].status }));
    await pg.click('#cmL-c');
    return (r.view==='comm' && /חוזר מנכ״ל/.test(r.subj) && /coord@example.com/.test(r.t) && /רכזת ביתר/.test(r.t) && r.st==='sent') || JSON.stringify({view:r.view,subj:r.subj,st:r.st,t:r.t.slice(0,80)});
  });
  await step('מרכז הודעות: פילוח הורים לפי גן, שדות מיזוג בתצוגה מקדימה, ורשימת נמענים', async()=>{
    await pg.click('#hqComm [data-aud="parents"]'); await pg.waitForTimeout(80);
    await pg.selectOption('#hqComm [data-g="pf"][data-f="gan"]','modiin-illit|g1'); await pg.waitForTimeout(80);
    await pg.click('#hqComm [data-tpl="0"]'); await pg.waitForTimeout(80);
    const r=await pg.evaluate(()=>({ cnt:document.querySelector('#hqComm .hq-count b').textContent, prev:document.getElementById('cmPrev').textContent }));
    /* בגן הדקל: ילדה א, ילדה ג, והתיק שיובא — ילדה ב הועברה לגן התמר בשיבוץ המרכזי */
    return (r.cnt==='3' && /גן הדקל/.test(r.prev) && /שרה לוי/.test(r.prev) && !/\{\{/.test(r.prev)) || JSON.stringify(r);
  });
  await step('Smoove: קובץ הנרשמים ומעקב מיילים חוזרים', async()=>{
    await go('smoove'); const t=await txt('#hqSmoove');
    return (/יופעל בהמשך/.test(t) && /bad@example.com/.test(t) && /הורדת קובץ Smoove/.test(t)) || t.slice(0,120);
  });
  await step('החלטות: הנושא הפתוח מוצג ואפשר להוסיף נושא', async()=>{
    await go('decisions'); const t=await txt('#hqDecisions');
    await pg.click('#dcAdd'); await pg.waitForTimeout(80); await pg.fill('#pf-title','נושא חדש'); await pg.click('#pf-ok'); await pg.waitForTimeout(200);
    const n=await pg.evaluate(()=>Object.keys(window.__docs).filter(k=>k.startsWith('org/hq/decisions/')).length);
    return (/פתיחת גן נוסף בביתר/.test(t) && n===2) || JSON.stringify({n});
  });
  await step('הגדרות והרשאות: מטריצת המודולים למשתמשי המרכז, ספים, ושמירה', async()=>{
    await go('perms'); const t=await txt('#hqSettings');
    await pg.fill('#thLic','33'); await pg.click('#thSave'); await pg.waitForTimeout(150);
    const th=await pg.evaluate(()=>window.__docs['org/hq'].thresholds);
    return (/view@example.com/.test(t) && /מה כל אחד\/ת יכול\/ה לערוך/.test(t) && th && th.license===33) || JSON.stringify(th);
  });
  await step('מפה, עוזר חכם ומדריך נפתחים בלי שגיאות (Leaflet חסום ברשת — הודעה מסודרת)', async()=>{
    await go('map'); await pg.waitForTimeout(300); const tm=await txt('#hqMap');
    await go('assistant'); const ta=await txt('#hqAssistant');
    await go('guide'); const tg=await txt('#hqGuide');
    return (/גן הדקל/.test(tm) && /אין מיקום/.test(tm) && /שלום! אני העוזר/.test(ta) && /מפת הדרישות/.test(tg) && /שיבוץ מרכזי/.test(tg)) || JSON.stringify({tm:tm.slice(0,60),ta:ta.slice(0,40),tg:tg.slice(0,40)});
  });
  await step('הרשאות לפי משתמש/ת: צופה — תלמידים לצפייה בלבד, ייבוא מוסתר', async()=>{
    /* החלפת משתמש/ת = התנתקות וכניסה מחדש (כמו במציאות) */
    await pg.goto('http://127.0.0.1:'+PORT+'/management.html?as=view@example.com',{ waitUntil:'domcontentloaded', timeout:20000 }); await pg.waitForTimeout(900);
    await go('students'); const r=await pg.evaluate(()=>({ ro:/צפייה בלבד/.test(document.getElementById('hqStudents').textContent), impHidden:document.querySelector('#drawerNav [data-view="import"]').hidden, hasBulk:!!document.getElementById('stuBulkPlace') }));
    await go('import'); const ti=await txt('#hqImport');
    return (r.ro && r.impHidden && /אין לך הרשאה/.test(ti)) || JSON.stringify(r);
  });
  if(errors.length){ fail++; console.log('❌ שגיאות דף:\n   '+errors.join('\n   ')); }
  await b.close(); server.close();
  if(fail){ console.log('\n'+fail+' בדיקות נכשלו'); process.exit(1); }
  console.log('\nכל בדיקות המרכזי עברו ✓');
})().catch(e=>{ console.error(e); process.exit(1); });
