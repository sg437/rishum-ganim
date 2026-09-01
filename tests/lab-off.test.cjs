/* ============================================================================
   העיצוב הקודם — בדיקת דרך היציאה (Playwright + Chromium)
   ----------------------------------------------------------------------------
   ⚠️ הבדיקה הזאת התהפכה עם שחרור העיצוב החדש לכולם. עד השחרור היא טענה את
   index.html **בלי דגל** — וזה היה מה שכל משתמש רואה — וּודאה שהמעבדה אינה
   דולפת אליו. עכשיו "בלי דגל" הוא העיצוב החדש, והעיצוב הקודם הוא בחירה
   מפורשת: ‎?ui=old‎. לכן הבדיקה נכנסת דרכה, ושואלת שתי שאלות במקום אחת:

     א. שהיציאה באמת יוצאת — אין מחלקת ui-lab, אין ui-lab.css, אין ui-lab.js
        ואין וו __uiLab, ושבורר העיצוב מוצע בחזרה פנימה.
     ב. ⭐ שהיציאה אינה עולה ביכולת. מה שנבנה בתקופת המעבדה — ייצוא הצוות,
        "עדכון לפי ת"ז" — קיים גם כאן. זה הלב של השחרור: העיצוב הקודם הוא
        מראה אחר לאותה תוכנה, לא גרסה מקוצצת שלה.

   ומה שנשאר שייך לעיצוב החדש בלבד (בורר העמודות) — נבדק שאינו דולף לכאן.

   הרצה:  NODE_PATH=$(npm root) node tests/lab-off.test.cjs
   ============================================================================ */
const fs=require('fs'),path=require('path'),os=require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית, לא נדרשת לשימוש בתוכנה).');
  process.exit(0);
}
const ROOT=path.join(__dirname,'..'), PORT=8766;
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rg-off-'));
function buildApp(){
  let h=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  h=h.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/,'');
  h=h.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g,'/__stub/fbstub.js');
  h=h.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','/__stub/noop.js');
  const e=`
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, closeModal }); window.__ready=true;
`;
  const i=h.lastIndexOf('</script>'); return h.slice(0,i)+e+h.slice(i);
}
fs.writeFileSync(path.join(TMP,'noop.js'),'window.L=window.L||{};');
fs.writeFileSync(path.join(TMP,'fbstub.js'),`
const noop=()=>{}; const P=()=>Promise.resolve();
export const initializeApp=()=>({name:'stub'}); export const getAuth=()=>({currentUser:null});
export const onAuthStateChanged=(a,cb)=>{ setTimeout(()=>cb(null),0); return noop; };
export const signInWithEmailAndPassword=P, signOut=P, sendPasswordResetEmail=P, signInWithPopup=P;
export class GoogleAuthProvider{ setCustomParameters(){} }
export const initializeFirestore=()=>({stub:true});
export const persistentLocalCache=()=>({}), persistentMultipleTabManager=()=>({});
export const doc=()=>({}), setDoc=P, deleteDoc=P, collection=()=>({}), terminate=P,
  clearIndexedDbPersistence=P, disableNetwork=P, enableNetwork=P;
export const onSnapshot=()=>noop;
export const writeBatch=()=>({set:noop,delete:noop,commit:P});
export const runTransaction=P;
export const initializeAppCheck=()=>({}); export class ReCaptchaV3Provider{}
`);
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.woff2':'font/woff2','.png':'image/png'};
const server=require('http').createServer((req,res)=>{
  const u=decodeURIComponent(req.url.split('?')[0]); let body,ext;
  if(u==='/app.html'){ body=Buffer.from(buildApp()); ext='.html'; }
  else{ const f=u.startsWith('/__stub/')?path.join(TMP,u.slice(8)):path.join(ROOT,u.replace(/^\/+/,''));
    ext=path.extname(f); try{ body=fs.readFileSync(f); }catch(e){ res.writeHead(404); return res.end('nf'); } }
  res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'}); res.end(body);
});
const SEED=`(()=>{ DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
  DB.gans=[{id:'g1',ganName:'גן הדקל',active:true,education:'רגיל',age:'4',teacherName:'שרה לוי'}];
  DB.students=[1,2].map(i=>({ id:'s'+i, year:'תשפ"ז', firstName:'ילדה'+i, lastName:'כהן',
    tz:'12345678'+i, age:'4', education:'רגיל', ganId:'g1', placed:true, finished:false,
    street:'הרב שך', building:String(i), city:'מודיעין עילית', period:'א',
    docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{} }));
  DB.staff=[{id:'m1',lastName:'ברקוביץ',firstName:'שרה',tz:'039112881',role:'גננת',education:'רגיל',
             phone:'02-9990001',mobile:'052-8841190',city:'מודיעין עילית',email:'s@x.org',active:true,
             movements:[],notesList:[],absences:[],lateness:[],docFiles:{}}];
  DB.management=[]; DB.settings=DB.settings||{};
  __set('eduPicked',true); __set('activeEdu',null);
  document.body.classList.remove('locked'); return 'ok'; })()`;
let fail=0;
const ok=m=>console.log('✅ '+m), bad=(m,d)=>{fail++;console.log('❌ '+m);(d||[]).forEach(x=>console.log('     '+x));};
(async()=>{
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  const b=await chromium.launch({executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  /* ⚠️ ‎?ui=old‎ — בחירה מפורשת בעיצוב הקודם. "בלי דגל" כבר אינו הכיבוי. */
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:'+PORT+'/app.html?ui=old',{waitUntil:'load'});
  await p.waitForTimeout(1200);
  await p.evaluate(SEED);

  const shell=await p.evaluate(()=>({
    labClass: document.documentElement.classList.contains('ui-lab'),
    labCss:   !!document.querySelector('link[href*="ui-lab.css"]'),
    labJs:    !!document.querySelector('script[src*="ui-lab.js"]'),
    hook:     typeof window.__uiLab
  }));
  if(shell.labClass||shell.labCss||shell.labJs) bad('העיצוב החדש נטען למרות ?ui=old',[JSON.stringify(shell)]);
  else if(shell.hook!=='undefined') bad('וו __uiLab נחשף בעיצוב הקודם',['typeof = '+shell.hook]);
  else ok('?ui=old: אין מחלקה, אין CSS, אין JS ואין וו __uiLab');

  /* --- 0ב. הדרך חזרה — השבב בפינה והבורר שבהגדרות ---------------------- */
  const sw=await p.evaluate(()=>{
    const a=document.querySelector('.skin-switch');
    return a ? { txt:a.textContent.trim(), q:new URL(a.href,location.href).searchParams.get('ui'),
                 pos:getComputedStyle(a).position } : null;
  });
  if(!sw)             bad('אין שבב בורר עיצוב — מי שיצאה לעיצוב הקודם אינה יכולה לחזור');
  else if(sw.q!=='new') bad('השבב אינו מחזיר לעיצוב החדש',[JSON.stringify(sw)]);
  else if(sw.pos!=='fixed') bad('השבב אינו מעוצב — ui-lab.css אינו נטען כאן, והעיצוב חייב להיות מקומי',[sw.pos]);
  else ok('שבב בורר העיצוב קיים, מעוצב, ומחזיר ל-?ui=new: '+sw.txt);

  await p.evaluate(t=>{ __set('active',t); route(); },'staff'); await p.waitForTimeout(700);
  const st=await p.evaluate(()=>({
    h2:   (document.querySelector('#view h2')||{}).textContent,
    cols: [...document.querySelectorAll('#staffTable th')].map(t=>t.textContent.replace(/[▲▼]/g,'').trim()),
    rows: document.querySelectorAll('#staffTable tbody tr').length,
    btns: [...document.querySelectorAll('#view .row .btn')].map(x=>x.id),
    fab:  [...document.querySelectorAll('#fabMenu .fab-item, #fabBtn')].length,
    fabLbl: (document.querySelector('#fabBtn')||{}).title,
    fabOn: !(document.querySelector('#fabWrap')||{hidden:true}).hidden,
    lab:  document.querySelectorAll('[class*="lab-"]').length,
    stage:!!document.querySelector('.lab-ststage'),
    hidden: !!(document.querySelector('#staffTable')||{}).classList.contains('lab-hidden')
  }));
  if(st.h2!=='רשימת צוות הגנים') bad('הכותרת בעיצוב הקודם השתנתה',['התקבל: '+st.h2]);
  else if(st.cols.join('|')!=='שם משפחה|שם פרטי|ת"ז|תפקיד|חינוך|טלפון|נייד|מייל|עיר')
    bad('עמודות הטבלה בעיצוב הקודם השתנו',[st.cols.join(' · ')]);
  /* ⭐ ייצוא הצוות נבנה בתקופת המעבדה ורץ בה בלבד. עם השחרור הוא נולד
     ב-index.html עצמו, ולכן הוא חייב להיות כאן — אחרת החזרה לעיצוב הקודם
     גובה יכולת. */
  else if(st.btns.join(',')!=='impStaff,labStaffExp')
    bad('כפתורי המסך אינם ייבוא + ייצוא',[st.btns.join(' · ')])
  else if(!st.fabOn || st.fabLbl!=='הוספת איש/אשת צוות')
    bad('הכפתור המרחף אינו מציע "הוספת איש/אשת צוות"',[JSON.stringify(st)]);
  else if(st.stage||st.hidden) bad('אלמנטים של העיצוב החדש נכנסו לעיצוב הקודם',[JSON.stringify(st)]);
  else if(st.rows!==1) bad('הרשימה אינה מציגה את הרשומה',['שורות: '+st.rows]);
  else ok('מסך הצוות בעיצוב הקודם: כותרת, 9 עמודות, ייבוא *וייצוא* בסרגל, וההוספה בכפתור המרחף');

  /* חלון הייצוא עצמו נפתח — לא רק הכפתור קיים */
  await p.evaluate(()=>{ document.querySelector('#labStaffExp').click(); }); await p.waitForTimeout(500);
  const xp=await p.evaluate(()=>({
    h3:(document.querySelector('#modal h3')||{}).textContent||'',
    cols:document.querySelectorAll('#modal .sx-col').length }));
  if(!/ייצוא/.test(xp.h3)||!xp.cols) bad('חלון ייצוא הצוות לא נפתח בעיצוב הקודם',[JSON.stringify(xp)]);
  else ok('ייצוא הצוות עובד בעיצוב הקודם: '+xp.cols+' שדות לבחירה');
  await p.evaluate(()=>closeModal()); await p.waitForTimeout(400);
  await p.evaluate(()=>{ __set('active','staff'); route(); }); await p.waitForTimeout(700);

  /* ⭐ "עדכון לפי ת"ז" — גם הוא נבנה במעבדה, וגם הוא חייב להיות כאן.
     שתי המחלקות lab-modes/lab-mode נשארו בשמן, ולכן צריך גם לוודא שיש
     להן עיצוב: ui-lab.css אינו נטען כאן, וכללי הבסיס יושבים ב-<style>
     של העמוד. בלעדיהם הבורר היה שתי מילים ערומות. */
  await p.evaluate(()=>{ document.querySelector('#impStaff').click(); }); await p.waitForTimeout(600);
  const im=await p.evaluate(()=>{
    const b=document.querySelector('#modal .lab-mode');
    return { h3:(document.querySelector('#modal h3')||{}).textContent,
      modes:document.querySelectorAll('#modal .lab-mode').length,
      tzPane:!!document.querySelector('#modal #stu-pane-tz'),
      wrap:!!document.querySelector('#modal .lab-modes'),
      styled:b?getComputedStyle(b).borderRadius:'',
      fields:document.querySelectorAll('#modal fieldset').length };
  });
  if(im.h3!=='ייבוא ועדכון אנשי צוות') bad('כותרת חלון הייבוא אינה מדברת בעד שני המצבים',['התקבל: '+im.h3]);
  else if(im.modes!==2||!im.tzPane) bad('מצב "עדכון לפי ת"ז" חסר בעיצוב הקודם',[JSON.stringify(im)]);
  else if(!im.wrap||im.styled==='0px') bad('בורר המצבים אינו מעוצב — חסרים כללי הבסיס ב-<style>',[JSON.stringify(im)]);
  else ok('חלון ייבוא הצוות בעיצוב הקודם: שני מצבים, מקטע ת"ז, ובורר מעוצב');
  await p.evaluate(()=>closeModal()); await p.waitForTimeout(300);

  /* --- מקטעי ההגדרות בסרגל הניווט ------------------------------------- */
  await p.evaluate(()=>{ DB.settings.admins=['x@y.z']; __set('active','settings'); route(); });
  await p.waitForTimeout(700);
  const nv=await p.evaluate(()=>{
    const car=document.querySelector('.drawer-nav [data-setnav]');
    const sub=document.querySelector('#setSubnav');
    const items=[...document.querySelectorAll('#setSubnav .subnav-i')].map(b=>b.dataset.setjump);
    return { car:!!car, closed: sub? sub.hidden : null, items,
             groups:[...document.querySelectorAll('#setSubnav .subnav-g')].length,
             /* פריט אחד ברשימה עשוי לכסות כמה פאנלים — די באחד מהם */
             dead: items.filter(k=>!document.querySelector(
               k.trim().split(/\s+/).map(x=>'#view [data-set~="'+x+'"]').join(','))),
             /* מקטעי מנהל בלבד אינם מוצגים למי שאינו מנהל */
             admOnly: items.filter(k=>k==='users'||k==='feedback') };
  });
  if(!nv.car)            bad('אין חץ פתיחה ללשונית ההגדרות');
  else if(nv.closed!==true) bad('רשימת המקטעים פרושה בלי שנלחץ החץ');
  else if(!nv.items.length) bad('רשימת המקטעים ריקה');
  else if(nv.dead.length)   bad('מקטעים בסרגל שאין להם יעד במסך',[nv.dead.join(' · ')]);
  else if(nv.admOnly.length) bad('מקטעי מנהל־בלבד הוצגו למי שאינו מנהל',[nv.admOnly.join(' · ')]);
  else ok('סרגל הניווט: '+nv.groups+' קבוצות ו-'+nv.items.length+' מקטעי הגדרות, כולם מובילים לפאנל');

  /* --- בורר העיצוב שבהגדרות — המקום הקבוע שלו, בשני העיצובים ---------- */
  const sk=await p.evaluate(()=>{
    const pan=document.querySelector('#view [data-set="skin"]');
    if(!pan) return null;
    const b=id=>{ const e=pan.querySelector('#'+id); return e?{txt:e.textContent.trim(),ghost:e.classList.contains('ghost')}:null; };
    return { nw:b('skin-new'), od:b('skin-old') };
  });
  if(!sk||!sk.nw||!sk.od) bad('אין בורר עיצוב במסך ההגדרות');
  else if(sk.od.ghost||!sk.nw.ghost)
    bad('הבורר אינו מסמן שהעיצוב הקודם הוא הנבחר',[JSON.stringify(sk)]);
  else ok('בורר העיצוב בהגדרות מסמן את הנבחר: '+sk.od.txt);

  const jump=await p.evaluate(async()=>{
    document.querySelector('.drawer-nav [data-setnav]').click();
    const open=!document.querySelector('#setSubnav').hidden;
    const b=document.querySelector('#setSubnav [data-setjump="tzmin"]');
    if(b) b.click();
    await new Promise(r=>setTimeout(r,700));
    const el=document.querySelector('#view [data-set~="tzmin"]');
    return { open, top: el? Math.round(el.getBoundingClientRect().top) : null,
             drawer: document.querySelector('#drawer').classList.contains('open') };
  });
  if(!jump.open)                       bad('החץ לא פרש את רשימת המקטעים');
  else if(jump.drawer)                 bad('המגירה נשארה פתוחה אחרי בחירת מקטע');
  else if(!(jump.top>0 && jump.top<220)) bad('הבחירה לא גיללה אל המקטע',['top='+jump.top]);
  else ok('בחירת מקטע גוללת אליו מתחת לכותרת הדביקה, וסוגרת את המגירה');

  /* --- 4. העמודות הנוספות: כפתור אחד, הכל או כלום -------------------- */
  await p.evaluate(t=>{ __set('active',t); route(); },'students'); await p.waitForTimeout(800);
  const snap=()=>p.evaluate(()=>{
    const head=document.querySelector('.stu-table thead tr'), row=document.querySelector('.stu-table tbody tr');
    const vis=el=>getComputedStyle(el).display!=='none';
    return { cols:[...head.children].filter(vis).length, cells:[...row.children].filter(vis).length,
             btn:((document.querySelector('#stuColsBtn')||{}).textContent||'').trim(),
             btnVisible:!!(document.querySelector('#stuColsBtn')&&vis(document.querySelector('#stuColsBtn'))),
             menu:!!document.querySelector('.lab-colmenu'),
             xoff:[...document.documentElement.classList].some(c=>c.indexOf('lab-xoff')===0) };
  });
  const c0=await snap();
  await p.evaluate(()=>document.querySelector('#stuColsBtn').click()); await p.waitForTimeout(500);
  const c1=await snap();
  await p.evaluate(()=>document.querySelector('#stuColsBtn').click()); await p.waitForTimeout(500);
  const c2=await snap();
  if(c0.menu||c1.menu)      bad('בורר העמודות של העיצוב החדש הופיע בעיצוב הקודם');
  else if(c0.xoff||c1.xoff) bad('מחלקות lab-xoff נכתבו על <html> בעיצוב הקודם');
  else if(!c0.btnVisible)   bad('כפתור "עמודות נוספות" נעלם');
  else if(c0.cols!==6||c0.cells!==6) bad('ברירת המחדל אינה שש עמודות',[JSON.stringify(c0)]);
  else if(c1.cols!==13||c1.cells!==13) bad('הכפתור לא פתח את כל שבע הנוספות',[JSON.stringify(c1)]);
  else if(!/הסתרת/.test(c1.btn)) bad('הכפתור לא התחלף ל"הסתרה"',[c1.btn]);
  else if(c2.cols!==6)      bad('הכפתור לא סגר אותן חזרה',[JSON.stringify(c2)]);
  else ok('העמודות הנוספות כשהיו: 6 → 13 → 6, בכפתור אחד, בלי בורר ובלי lab-xoff');

  const real=errs.filter(e=>!/Failed to load resource|net::ERR_/.test(e));
  if(real.length) bad('נזרקו שגיאות JS',real.slice(0,5)); else ok('אף שגיאת JS לא נזרקה');
  console.log('============================================');
  console.log(fail? 'תוצאה: '+fail+' נכשלו' : 'תוצאה: העיצוב הקודם שלם — יוצא באמת, ולא גובה אף יכולת ✅');
  await b.close(); server.close(); process.exit(fail?1:0);
})();
