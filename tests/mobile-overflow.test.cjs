/* ============================================================================
   גלישה אופקית בנייד — בדיקת רגרסיה
   ----------------------------------------------------------------------------
   טוענת את index.html האמיתי במעבדה, ברוחב טלפון, ועוברת על כל הלשוניות.
   העמוד לא אמור לגלול לצדדים באף מסך.

   למה זו בדיקה נפרדת: כל השאר רצות ב-1440px, ושם גלישה של 30px נבלעת
   בשוליים ואינה נראית. שני באגים אמיתיים נתפסו כאן:

     · "כלים ושירותים" — grid-template-columns:minmax(420px,1fr) עם auto-fit.
       auto-fit מקטין למסלול אחד, אבל למסלול עצמו נשארת רצפה של 420px, וב-390
       הוא חורג ב-46px. הפתרון: minmax(min(420px,100%),1fr).
     · תיקי התלמידות — ‎#stuSummary.sticky‎ יושב עם ‎margin:0 -18px‎ שמתקזז מול
       ‎padding:0 18px‎ של הפאנל. ‎.lab-bare‎ מאפס את הריפוד, וה-18px בלטו החוצה.

   הרצה:  NODE_PATH=$(npm root) node tests/mobile-overflow.test.cjs
   ============================================================================ */
/* ============================================================================
   בדיקת מסכי המעבדה (Playwright + Chromium)
   ----------------------------------------------------------------------------
   טוענת את index.html האמיתי עם Firebase מדומה **ועם מעבדת העיצוב דלוקה**,
   ומוודאת ארבע התנהגויות שנשברו בעבר ואי אפשר לראות אותן בקוד לבדו:

     1. לוח הגנים בתצוגת כרטיסים — לחיצה על כרטיס פותחת את תיק הגן, בדיוק
        כמו לחיצה על שורה בטבלה. קודם הכרטיס היה לצפייה בלבד, והמעבר בין
        "כרטיסים" ל"טבלה" שינה לא רק את המראה אלא גם את מה שאפשר לעשות.
     2. תיק הילדה שנפתח בצד — הכפתור הדביק שבתחתית חייב לשבת בדיוק על רוחב
        הכרטיס. קודם הוא נמתח החוצה מצד אחד ונשאר קצר מהשני.
     3. אין לשוניות "ייצוא" ו"עירייה" בניווט — שתי הפעולות יושבות בתוך
        לשונית התלמידות.
     4. כפתור "ייצוא" שבלשונית התלמידות פותח את מסך הייצוא בעיצוב שתי
        העמודות, עם הלוח הכהה שמונה את השורות.
     5. "עדכון לפי ת"ז" פותח חלון שבתחתיתו מקטע "רשימת העירייה" — ושהוא
        עובד: הדבקת ת"ז והתאמה מסמנת את התיקים כ"קלוט בעירייה".
     6. ה-"+" שבכותרת הטבלה פותח בורר עמודות: בוחרים עמודה אחת והיא בלבד
        עולה, מורידים אותה והיא בלבד יורדת, והבחירה נשמרת. ה-"+" עצמו נשאר
        גלוי גם כשכל העמודות הנוספות ירדו.
     6. מסך הצוות: הכותרת, סדר כפתורי הפעולה, המשבצת "שאר הצוות", חמש
        עמודות הרשימה, שורת החיפוש שיושבת בתוך עמודת הרשימה (ולכן
        מתכווצת כשנפתח תיק בצד), שבבי התפקיד לבחירה מרובה, התיק שבצד
        והפס הכהה התחתון.
     7. "עדכון לפי ת"ז" שבייבוא הצוות: מחליף ערכים בתיק קיים, אינו נוגע
        בשדות שלא נבחרו, ופותח תיק חדש לת"ז שאינה במאגר.
     8. בורר השנה אינו ברצועה העליונה אלא פאנל ראשון בהגדרות — וכשמחליפים
        בו שנה, שנת העבודה באמת מתחלפת (ה-<select> המקורי נשאר במגירה).
     9. פס הגלילה של הסרגל: צר, בלי חיצים ובגוון הסרגל — ולא המסילה
        הלבנה של מערכת ההפעלה.
    10. מסך שיבוץ הצוות: תת־כותרת מתחת לכותרת, "ייצוא" בכותרת, רצועת
        ההקשרים ולצידה בורר "כרטיסים | טבלה", מקרא בן שלושה מצבים (כולל
        "נעול עד לסף"), סדר הגנים לפי גיל עם צבע הגיל סביבם, הטור שבצד,
        ו"בחירת גן לשיבוץ" שירדה בלי שהבורר יאבד את החיווט.
    11. תיק השיבוץ של איש/אשת צוות: נפתח מחלון החיפוש שבטור, מציג את
        השיבוצים של השנה, חוסם שיבוץ כפול, נועל ימים תפוסים, ושומר.
        ולצידו הכלל החדש: משלימה בכמה גנים בימים זרים אינה התנגשות.

   הרצה:  NODE_PATH=$(npm root) node tests/lab-screens.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית, לא נדרשת לשימוש בתוכנה).');
  console.log('    הרצה:   NODE_PATH=$(npm root) node tests/lab-screens.test.cjs   [PW_CHROME=/path/to/chrome]');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PORT = 8733;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-lab-'));

/* index.html האמיתי, עם Firebase מדומה ובלי CSP (הבדיקה מקומית) */
function buildApp() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/, '');
  html = html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g, '/__stub/fbstub.js');
  html = html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', '/__stub/noop.js');
  /* הקוד רץ כמודול (scope נפרד) — חושפים רק את מה שהבדיקה צריכה */
  const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; else if(k==='currentUser')currentUser=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, closeModal });
window.__ready=true;
`;
  const i = html.lastIndexOf('</script>');
  return html.slice(0, i) + expose + html.slice(i);
}

/* Leaflet מדומה — רק מה שקוד המפה קורא לו. בלעדיו mapInit נופל מיד,
   ומסך המפה לעולם אינו מגיע ל-mapApply (ולכן גם לא לרשימת הצד). */
fs.writeFileSync(path.join(TMP, 'noop.js'), `
(function(){
  const chain=o=>new Proxy(o,{get:(t,k)=> k in t ? t[k] : ()=>chain(t)});
  const layer=()=>chain({ addTo(){return this}, clearLayers(){}, bindTooltip(){return this},
    bindPopup(){return this}, on(){return this}, setLatLng(){return this},
    setContent(){return this}, openOn(){return this}, remove(){} });
  window.L={
    map(){ return chain({ setView(){return this}, remove(){}, invalidateSize(){}, closePopup(){},
      fitBounds(){}, on(){}, off(){}, removeLayer(){},
      getCenter(){ return {lat:31.93,lng:35.04}; }, getZoom(){ return 14; } }); },
    tileLayer(){ return layer(); }, layerGroup(){ return layer(); },
    marker(){ return layer(); }, circleMarker(){ return layer(); }, popup(){ return layer(); },
    divIcon(o){ return o; }, latLngBounds(){ return chain({ pad(){ return this } }); }
  };
})();
`);
fs.writeFileSync(path.join(TMP, 'fbstub.js'), `
const noop=()=>{}; const P=()=>Promise.resolve();
export const initializeApp=()=>({name:'stub'});
export const getAuth=()=>({currentUser:null});
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

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
               '.js':'text/javascript; charset=utf-8', '.woff2':'font/woff2', '.png':'image/png' };
const server = require('http').createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let body, ext;
  if (url === '/app.html') { body = Buffer.from(buildApp()); ext = '.html'; }
  else {
    const f = url.startsWith('/__stub/') ? path.join(TMP, url.slice(8)) : path.join(ROOT, url.replace(/^\/+/, ''));
    ext = path.extname(f);
    try { body = fs.readFileSync(f); } catch (e) { res.writeHead(404); return res.end('nf'); }
  }
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(body);
});

/* נתוני בדיקה — שני קמפוסים, שלושה גנים, שש תלמידות */
const SEED = `(() => {
  DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
  DB.gans=[
    {id:'g1',ganName:'גן הדקל',active:true,education:'רגיל',age:'4',capacity:'30',assignCap:'28',teacherName:'שרה לוי',campus:'קמפוס מרכז',ganSymbol:'567890',address:'הרב שך',building:'5',city:'מודיעין עילית'},
    {id:'g2',ganName:'גן הרימון',active:true,education:'רגיל',age:'4',capacity:'30',assignCap:'',teacherName:'מרים כהן',campus:'קמפוס מרכז',ganSymbol:'567891',address:'רשב"י',building:'3',city:'מודיעין עילית'},
    {id:'g3',ganName:'גן שקד',active:true,education:'ח"מ',age:'5',capacity:'24',assignCap:'',teacherName:'',campus:'קמפוס צפון',ganSymbol:'567892',address:'חזון איש',building:'8',city:'מודיעין עילית'}
  ];
  DB.students=[1,2,3,4,5,6].map(i=>({ id:'s'+i, year:'תשפ"ז', firstName:'ילדה'+i, lastName:'כהן',
    tz:'12345678'+i, age:'4', education:'רגיל', ganId:i<5?'g1':'', placed:i<4, finished:false,
    street:'הרב שך', building:String(i), city:'מודיעין עילית', fatherName:'יעקב', motherName:'רבקה',
    momMobile:'050123456'+i, email:'p'+i+'@example.com', period:'א',
    docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{} }));
  DB.staff=[
    {id:'m1',lastName:'ברקוביץ',firstName:'שרה',tz:'039112881',email:'sara@ganim.org',role:'גננת',
     education:'רגיל',phone:'02-9990001',mobile:'052-8841190',street:'חפץ חיים',building:'18',
     city:'מודיעין עילית',active:true,certificate:true,createdAt:'2012-09-01T00:00:00.000Z',
     movements:[{type:'entry',date:'2012-09-01',detail:'תחילת עבודה'}],
     notesList:['מבקשת לא לשבץ לצהרון בימי חמישי.'],
     absences:[{date:'2025-01-02',reason:'מחלה'}],lateness:[],docFiles:{}},
    {id:'m2',lastName:'פישר',firstName:'נחמה',tz:'039112882',email:'',role:'סייעת',
     education:'רגיל',phone:'',mobile:'053-7781004',city:'מודיעין עילית',active:true,
     certificate:false,createdAt:'2018-09-01T00:00:00.000Z',
     movements:[],notesList:[],absences:[],lateness:[],docFiles:{}},
    {id:'m3',lastName:'נויהאוז',firstName:'אסתי',tz:'039112883',email:'',role:'העשרה',
     education:'ח"מ',phone:'',mobile:'053-8820164',city:'ביתר עילית',active:true,
     certificate:false,createdAt:'2020-09-01T00:00:00.000Z',
     movements:[],notesList:[],absences:[],lateness:[],docFiles:{}},
    {id:'m4',lastName:'כהן',firstName:'רבקה',tz:'039112884',email:'',role:'גננת',
     education:'רגיל',phone:'',mobile:'050-1112223',city:'מודיעין עילית',active:false,
     certificate:false,createdAt:'2015-09-01T00:00:00.000Z',
     movements:[],notesList:[],absences:[],lateness:[],docFiles:{}}
  ];
  DB.assignments={'תשפ"ז':{activity:{ g1:{'גננת':{staffId:'m1',name:'ברקוביץ שרה'}} }}};
  DB.management=[]; DB.settings=DB.settings||{};
  __set('eduPicked',true); __set('activeEdu',null);
  document.body.classList.remove('locked');
  return 'ok';
})()`;

let fail = 0;
const ok  = m => console.log('✅ ' + m);
const bad = (m, d) => { fail++; console.log('❌ ' + m); (d || []).forEach(x => console.log('     ' + x)); };
const goTab = (p, tab) => p.evaluate(t => { __set('active', t); route(); }, tab);

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  /* הדגל נכתב לפני שסקריפט העמוד רץ — כך המעבדה נדלקת בטעינה, כמו ?ui=new */
  await ctx.addInitScript(() => { try { localStorage.setItem('uiLab', 'new'); } catch (e) {} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:' + PORT + '/app.html', { waitUntil: 'load' });
  await p.waitForTimeout(1100);

  if (!await p.evaluate(() => !!window.__ready)) {
    console.log('❌ טעינת האפליקציה נכשלה'); errs.forEach(e => console.log('   ' + e));
    await browser.close(); server.close(); process.exit(1);
  }
  if (!await p.evaluate(() => document.documentElement.classList.contains('ui-lab'))) {
    console.log('❌ המעבדה לא נדלקה'); await browser.close(); server.close(); process.exit(1);
  }
  await p.evaluate(SEED);

  const TABS=['home','students','gans','staff','assign','map','tzaharon','reports',
              'messages','docs','export','settings','tools','management','guide'];
  let bad=0, n=0;
  for(const t of TABS){
    try{ await goTab(p,t); }catch(e){ continue; }
    await p.waitForTimeout(550);
    const r=await p.evaluate(()=>{
      const W=document.documentElement.clientWidth;
      const main=document.querySelector('main');
      const who=[];
      main.querySelectorAll('*').forEach(e=>{
        const b=e.getBoundingClientRect();
        if(b.width<=0) return;
        const spill=Math.round(Math.max(-b.left, b.right-W));
        if(spill>2) who.push((e.className||e.tagName).toString().split(' ').slice(0,2).join('.')+' +'+spill+'px');
      });
      return { scroll:main.scrollWidth, W, who:[...new Set(who)].slice(0,3) };
    });
    n++;
    if(r.scroll > r.W+1){ bad++; console.log('❌ '+t+' — העמוד גולש '+(r.scroll-r.W)+'px  '+r.who.join(' · ')); }
  }
  if(!bad) console.log('✅ כל '+n+' המסכים ללא גלילה אופקית ברוחב 390px');

  /* ---- הטבעת שבכרטיס "סה״כ רשומות" נשארת בתוך הכרטיס ------------------
     גלישה בתוך כרטיס אינה מזיזה את העמוד, ולכן הבדיקה שלמעלה אינה רואה
     אותה: הטבעת הזהובה בלטה מהרקע הירוק החוצה. היא מופיעה רק כשהמספר
     תופס מקום — עם שש תלמידות בזרע הכרטיס מרווח, ולכן המספר נדרס ל-905. */
  await goTab(p, 'students');
  await p.waitForTimeout(700);
  for(const W of [320, 360, 390, 430, 768, 1024]){
    await p.setViewportSize({ width:W, height:844 });
    await p.waitForTimeout(300);
    await p.evaluate(()=>{
      const h = document.querySelector('#stuSummary .stat.lab-hero');
      if(h) h.querySelector('.v').textContent = '905';
    });
    await p.waitForTimeout(200);
    const r = await p.evaluate(()=>{
      const h = document.querySelector('#stuSummary .stat.lab-hero');
      if(!h) return { err:'אין כרטיס כהה' };
      const hb = h.getBoundingClientRect(), out = { v:h.querySelector('.v').textContent, spill:0, who:[] };
      h.querySelectorAll('*').forEach(e=>{
        const b = e.getBoundingClientRect();
        if(b.width <= 0) return;
        const sp = Math.round(Math.max(hb.left - b.left, b.right - hb.right));
        if(sp > 0){ out.spill = Math.max(out.spill, sp); out.who.push((e.className||'')+' +'+sp+'px'); }
      });
      const v = h.querySelector('.v');
      out.num = v.scrollWidth - v.clientWidth;       /* המספר חורג מהעמודה */
      return out;
    });
    n++;
    if(r.err){ bad++; console.log('❌ ' + W + 'px — ' + r.err); continue; }
    if(r.v !== '905'){ bad++; console.log('❌ ' + W + 'px — המספר לא נקבע לבדיקה'); continue; }
    if(r.spill > 0){ bad++; console.log('❌ ' + W + 'px — הטבעת חורגת מהכרטיס: ' + r.who.join(' · ')); }
    else if(r.num > 0){ bad++; console.log('❌ ' + W + 'px — המספר חורג מעמודתו ב-' + r.num + 'px'); }
  }
  if(!bad) console.log('✅ הטבעת והמספר שבכרטיס הכהה נשארים בתוכו בכל רוחב');

  console.log('============================================');
  console.log(bad ? 'תוצאה: '+bad+' ממצאי גלישה ❌' : 'תוצאה: אין גלישה אופקית בנייד ✅');
  await browser.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
