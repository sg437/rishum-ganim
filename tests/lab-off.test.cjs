/* ============================================================================
   העיצוב הקיים — בדיקת אי-השפעה (Playwright + Chromium)
   ----------------------------------------------------------------------------
   טוענת את index.html האמיתי **בלי דגל המעבדה**, כלומר בדיוק כמו שמשתמש
   רגיל רואה אותו, ומוודאת שמה שנבנה למעבדה אינו דולף אליו:

     1. אין מחלקת ui-lab, אין ui-lab.css, אין ui-lab.js ואין וו __uiLab.
     2. מסך הצוות נשאר כפי שהיה — הכותרת "רשימת צוות הגנים", תשע עמודות
        בטבלה ושלושת הכפתורים המקוריים. אף אלמנט של המעבדה אינו נכנס.
     3. חלון ייבוא הצוות נשאר בלי מצב "עדכון לפי ת"ז" ובלי שינוי כותרת.

   למה זו בדיקה נפרדת: כל שאר הבדיקות רצות עם המעבדה דלוקה, ולכן אף אחת
   מהן לא הייתה מגלה דליפה לעיצוב שכל המשתמשים רואים.

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
  DB.students=[];
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
  /* ⚠️ בלי addInitScript — כלומר בלי דגל המעבדה. זה בדיוק מה שרואה משתמש רגיל. */
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:'+PORT+'/app.html',{waitUntil:'load'});
  await p.waitForTimeout(1200);
  await p.evaluate(SEED);

  const shell=await p.evaluate(()=>({
    labClass: document.documentElement.classList.contains('ui-lab'),
    labCss:   !!document.querySelector('link[href*="ui-lab.css"]'),
    labJs:    !!document.querySelector('script[src*="ui-lab.js"]'),
    hook:     typeof window.__uiLab
  }));
  if(shell.labClass||shell.labCss||shell.labJs) bad('המעבדה נדלקה בלי הדגל',[JSON.stringify(shell)]);
  else if(shell.hook!=='undefined') bad('וו __uiLab נחשף למשתמש רגיל',['typeof = '+shell.hook]);
  else ok('בלי הדגל: אין מחלקה, אין CSS, אין JS ואין וו __uiLab');

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
  if(st.h2!=='רשימת צוות הגנים') bad('הכותרת בעיצוב הקיים השתנתה',['התקבל: '+st.h2]);
  else if(st.cols.join('|')!=='שם משפחה|שם פרטי|ת"ז|תפקיד|חינוך|טלפון|נייד|מייל|עיר')
    bad('עמודות הטבלה בעיצוב הקיים השתנו',[st.cols.join(' · ')]);
  else if(st.btns.join(',')!=='impStaff') bad('כפתורי המסך השתנו',[st.btns.join(' · ')])
  else if(!st.fabOn || st.fabLbl!=='הוספת איש/אשת צוות')
    bad('הכפתור המרחף אינו מציע "הוספת איש/אשת צוות"',[JSON.stringify(st)]);
  else if(st.lab||st.stage||st.hidden) bad('אלמנטים של המעבדה נכנסו לעיצוב הקיים',[JSON.stringify(st)]);
  else if(st.rows!==1) bad('הרשימה אינה מציגה את הרשומה',['שורות: '+st.rows]);
  else ok('מסך הצוות בעיצוב הקיים: כותרת, 9 עמודות, "ייבוא" בסרגל וההוספה בכפתור המרחף');

  await p.evaluate(()=>{ document.querySelector('#impStaff').click(); }); await p.waitForTimeout(600);
  const im=await p.evaluate(()=>({
    h3:(document.querySelector('#modal h3')||{}).textContent,
    modes:document.querySelectorAll('#modal .lab-mode').length,
    tzPane:!!document.querySelector('#modal #stu-pane-tz'),
    fields:document.querySelectorAll('#modal fieldset').length
  }));
  if(im.h3!=='ייבוא אנשי צוות מקובץ') bad('כותרת חלון הייבוא השתנתה',['התקבל: '+im.h3]);
  else if(im.modes||im.tzPane) bad('מצב "עדכון לפי ת"ז" דלף לעיצוב הקיים',[JSON.stringify(im)]);
  else ok('חלון ייבוא הצוות בעיצוב הקיים: אותה כותרת, בלי מצבים ובלי מקטע ת"ז');

  const real=errs.filter(e=>!/Failed to load resource|net::ERR_/.test(e));
  if(real.length) bad('נזרקו שגיאות JS',real.slice(0,5)); else ok('אף שגיאת JS לא נזרקה');
  console.log('============================================');
  console.log(fail? 'תוצאה: '+fail+' נכשלו' : 'תוצאה: העיצוב הקיים לא השתנה בכלל ✅');
  await b.close(); server.close(); process.exit(fail?1:0);
})();
