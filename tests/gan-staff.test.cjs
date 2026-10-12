/* ============================================================================
   צוות הגן בתיק הגן + "סייעת רפואית" בסיוע והעשרה (Playwright + Chromium)
   ----------------------------------------------------------------------------
     1. תיק הגן מציג את כל הצוות המשובץ בשנה הפעילה — לכל הקשר (פעילות הגן ·
        צהרונים · קייטנות) טבלה משלו: תפקיד · שם · טלפון · ימים · שעות, ומעל
        הכל שורה קבועה: יש / אין סייעת רפואית, מי, באילו ימים וכמה שעות.
     2. בתיק הילדה, ב"סיוע והעשרה", יש "סייעת רפואית" עם צירוף מסמך.
     3. בשיבוץ הסייעת הרפואית מופיעות הילדות המסומנות "סייעת רפואית", וגם
        אלה שסומנו קודם "סל אישי" (כך סומנו עד עכשיו).

   הרצה:  NODE_PATH=$(npm root) node tests/gan-staff.test.cjs
   ============================================================================ */
const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית, לא נדרשת לשימוש בתוכנה).');
  console.log('    הרצה:   NODE_PATH=$(npm root) node tests/gan-staff.test.cjs   [PW_CHROME=/path/to/chrome]');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PORT = 8747;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-ganstaff-'));

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
Object.assign(window,{ route, closeModal, openExportModal, openGan, openGanAssign, openStudent });
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
export const runTransaction=P; export class FieldPath{ constructor(...s){ this.segments=s; } } export const getDocsFromServer=async()=>({forEach(){},docs:[]});
export const initializeAppCheck=()=>({}); export class ReCaptchaV3Provider{}; export const getToken=async()=>({token:""});
`);

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
               '.js':'text/javascript; charset=utf-8', '.woff2':'font/woff2', '.png':'image/png' };
/* השרת מגיש רק קבצים מרשימה שנבנית מראש — הבקשה בוחרת שם מהרשימה, ולעולם
   אינה הופכת בעצמה לנתיב בדיסק (כך גם ../ לא יכול לצאת מהפרויקט). */
const FILES = new Map();
(function walk(dir, prefix) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name === 'node_modules' || d.name.startsWith('.')) continue;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, prefix + d.name + '/');
    else FILES.set(prefix + d.name, full);
  }
})(ROOT, '/');
for (const n of fs.readdirSync(TMP)) FILES.set('/__stub/' + n, path.join(TMP, n));
const server = require('http').createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let body, ext;
  if (url === '/app.html') { body = Buffer.from(buildApp()); ext = '.html'; }
  else {
    const f = FILES.get(url);
    if (!f) { res.writeHead(404); return res.end('nf'); }
    ext = path.extname(f);
    body = fs.readFileSync(f);
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
  /* גן הדקל: גננת · סייעת רפואית (20 ש"ש, ילדה1) · סייעת רפואית משלימה בימי
     שני. בצהרון: סייעת. גן הרימון: גננת בלבד — בלי סייעת רפואית.
     ילדה1 מסומנת "סייעת רפואית", ילדה2 "סל אישי" (הסימון הישן), ילדה3 כלום. */
  await p.evaluate(()=>{
    DB.students.forEach((s,i)=>{ if(i>=4) s.ganId='g2'; });
    DB.students[0].support={ medical:true };
    DB.students[1].support={ salIshi:true };
    DB.assignments['תשפ"ז']={
      activity:{
        g1:{ 'גננת':{staffId:'m1',name:'ברקוביץ שרה'},
             'סייעת רפואית':{staffId:'m2',name:'פישר נחמה',hours:'20',students:['s1']},
             'סייעת רפואית משלימה':{staffId:'m3',name:'נויהאוז אסתי',days:['שני']} },
        g2:{ 'גננת':{name:'כהן מרים'} } },
      tzaharon:{ g1:{ 'סייעת':{staffId:'m2',name:'פישר נחמה'} } } };
  });

  let fail=0;
  const ok  = m => console.log('✅ ' + m);
  const bad = (m,d) => { fail++; console.log('❌ ' + m); if(d!=null) console.log('     ' + d); };


  const gan = id => p.evaluate(async id => {
    openGan(JSON.parse(JSON.stringify(DB.gans.find(g=>g.id===id))));
    await new Promise(r=>setTimeout(r,250));
    const box=document.querySelector('#ganStaffBox');
    const res={ has:!!box, text: box ? box.textContent.replace(/\s+/g,' ').trim() : '',
      rows: box ? [...box.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.replace(/\s+/g,' ').trim())) : [],
      btn: !!document.querySelector('#ganStaffAssign') };
    closeModal(); await new Promise(r=>setTimeout(r,100));
    return res;
  }, id);

  /* ---------- 1. תיק הגן מציג את צוות השנה ---------- */
  const G1 = await gan('g1');
  if(!G1.has) bad('אין מקטע "צוות הגן" בתיק הגן');
  else ok('בתיק הגן יש מקטע "צוות הגן · שנת תשפ"ז"');
  (G1.text.includes('יש סייעת רפואית בגן') && G1.text.includes('פישר נחמה') && G1.text.includes('20 שעות שבועיות'))
    ? ok('שורת הסייעת הרפואית: יש · מי · כמה שעות') : bad('שורת הסייעת הרפואית', G1.text);
  const med = G1.rows.find(r=>r[0]==='סייעת רפואית');
  (med && med[1].includes('פישר נחמה') && med[1].includes('ילדות: כהן ילדה1') && med[3].includes('כל השבוע') && med[3].includes('יום חופשי: שני') && med[4]==='20')
    ? ok('שורת הטבלה: שם · ילדות משויכות · כל השבוע עם יום חופשי בשני · 20 שעות') : bad('שורת הסייעת הרפואית בטבלה', JSON.stringify(med));
  const comp = G1.rows.find(r=>r[0]==='סייעת רפואית משלימה');
  (comp && comp[1].includes('נויהאוז אסתי') && comp[3]==='שני')
    ? ok('המשלימה מופיעה עם הימים שלה (שני)') : bad('שורת המשלימה', JSON.stringify(comp));
  (G1.rows.some(r=>r[0]==='גננת' && r[1].includes('ברקוביץ שרה')))
    ? ok('הגננת מופיעה') : bad('הגננת חסרה', JSON.stringify(G1.rows));
  (G1.text.includes('צהרונים') && G1.rows.filter(r=>r[0]==='סייעת').length===1)
    ? ok('שיבוץ הצהרון מופיע בטבלה נפרדת תחת "צהרונים"') : bad('שיבוץ הצהרון', G1.text);
  G1.btn ? ok('כפתור "לשיבוץ הצוות של הגן" קיים') : bad('אין כפתור לשיבוץ הצוות');

  const G2 = await gan('g2');
  (G2.text.includes('אין סייעת רפואית') && G2.rows.length===1 && !G2.text.includes('צהרונים'))
    ? ok('גן בלי סייעת רפואית: "אין סייעת רפואית", ורק הגננת בטבלה') : bad('גן בלי סייעת רפואית', G2.text);

  const G3 = await gan('g3');
  (G3.text.includes('אין סייעת רפואית') && G3.text.includes('עדיין אין שיבוץ צוות'))
    ? ok('גן בלי שיבוץ בכלל: הודעה מתאימה') : bad('גן בלי שיבוץ', G3.text);

  /* ---------- 2. "סייעת רפואית" בתיק הילדה, עם צירוף מסמך ---------- */
  const S = await p.evaluate(async ()=>{
    openStudent(JSON.parse(JSON.stringify(DB.students[0])));
    await new Promise(r=>setTimeout(r,300));
    const rows=[...document.querySelectorAll('#support-rows .doc-row')];
    const medRow=rows.find(r=>r.textContent.includes('סייעת רפואית'));
    const res={ labels: rows.map(r=>r.textContent.replace(/\s+/g,' ').trim()),
      checked: !!(medRow && medRow.querySelector('.sup-chk[data-k="medical"]:checked')) };
    closeModal(); await new Promise(r=>setTimeout(r,100));
    return res;
  });
  (S.labels.some(l=>l.includes('סייעת רפואית')) && S.labels.some(l=>l.includes('סל אישי')))
    ? ok('בסיוע והעשרה יש "סייעת רפואית" לצד "סל אישי"') : bad('אין "סייעת רפואית" בסיוע והעשרה', S.labels.join(' | '));
  S.checked ? ok('הסימון "סייעת רפואית" נשמר ומוצג בתיק') : bad('הסימון "סייעת רפואית" לא מוצג');

  /* ---------- 3. בשיבוץ הסייעת הרפואית — ילדות "סייעת רפואית" וגם "סל אישי" ישן ---------- */
  const K = await p.evaluate(async ()=>{
    openGanAssign('g1');
    await new Promise(r=>setTimeout(r,300));
    const box=document.querySelector('[data-role="סייעת רפואית"]');
    const ids=box ? [...box.querySelectorAll('.asg-kid')].map(x=>x.value) : null;
    closeModal(); await new Promise(r=>setTimeout(r,100));
    return ids;
  });
  (K && K.includes('s1') && K.includes('s2') && !K.includes('s3'))
    ? ok('בשיבוץ הסייעת הרפואית מופיעות ילדה1 (סייעת רפואית) וילדה2 (סל אישי — תאימות לאחור)') : bad('הילדות בשיבוץ הסייעת הרפואית', JSON.stringify(K));

  errs.length ? bad('נזרקו שגיאות JS', errs.join(' | ')) : ok('אף שגיאת JS לא נזרקה');
  console.log('============================================');
  console.log(fail ? ('תוצאה: '+fail+' בדיקות נכשלו ❌') : 'תוצאה: צוות הגן וסייעת רפואית תקינים ✅');
  await browser.close(); server.close(); process.exit(fail?1:0);
})().catch(async e=>{ console.log('❌ '+(e&&e.stack||e)); process.exit(1); });
