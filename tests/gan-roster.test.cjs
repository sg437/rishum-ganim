/* ============================================================================
   רשימת גן · מספור ביצוא — בדיקת רגרסיה
   ----------------------------------------------------------------------------
   טוענת את index.html האמיתי עם Firebase מדומה, ובודקת שלוש התנהגויות
   שנוספו יחד ואי אפשר לראות אותן בקוד לבדו:

     1. "מסמכים ותבניות → רשימת גן" — בורר גנים מרובה (אפשר לבחור כמה גנים
        יחד), בורר תבנית, וארבעה כפתורי הפקה: הדפסה · אקסל צבעוני ·
        אקסל (CSV) · שיתוף מסמך.
     2. התבנית הקבועה — מספור · מספר זהות · שם משפחה · שם פרטי · כתובת ·
        מספר בניין · טלפון · טלפון הורה. בכמה גנים יחד נוספת עמודת "גן",
        המספור מתחיל מ-1 בכל גן, ובהדפסה כל גן מקבל בלוק משלו.
     3. טור המספור בכל יצוא של רשימת התלמידות — תצוגה מקדימה, CSV, אקסל,
        הדפסה ושיתוף — תמיד ראשון ותמיד מ-1 ומעלה.

   הרצה:  NODE_PATH=$(npm root) node tests/gan-roster.test.cjs
   ============================================================================ */
const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית, לא נדרשת לשימוש בתוכנה).');
  console.log('    הרצה:   NODE_PATH=$(npm root) node tests/gan-roster.test.cjs   [PW_CHROME=/path/to/chrome]');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PORT = 8741;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-roster-'));

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
Object.assign(window,{ route, closeModal, openExportModal });
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
  /* שני גנים עם תלמידות — כדי לבדוק גם בחירה מרובה */
  await p.evaluate(()=>{ DB.students.forEach((s,i)=>{ if(i>=4) s.ganId='g2'; }); });

  let fail=0;
  const ok  = m => console.log('✅ ' + m);
  const bad = (m,d) => { fail++; console.log('❌ ' + m); if(d!=null) console.log('     ' + d); };

  /* ---------- מסמכים ותבניות · רשימת גן ---------- */
  const R = await p.evaluate(async ()=>{
    const res={ errs:[] };
    const opened=[];
    window.open=function(){ return { document:{ write(h){ opened.push(h); }, close(){} }, focus(){}, print(){} }; };
    const blobs=[];
    URL.createObjectURL=function(b){ blobs.push(b); return "blob:stub"; };
    URL.revokeObjectURL=function(){};
    __set('active','templates'); route();
    await new Promise(r=>setTimeout(r,300));
    const box=document.querySelector('#tpl-roster-gan');
    res.hasBox=!!box;
    res.buttons=['tpl-roster-go','tpl-roster-xls','tpl-roster-csv','tpl-roster-share']
      .filter(id=>!!document.getElementById(id));
    if(!box) return res;
    const cbs=[...box.querySelectorAll('input[data-rgan]')];
    res.ganCount=cbs.length;
    res.tplOpts=[...document.querySelectorAll('#tpl-roster-tpl option')].map(o=>o.value);

    cbs[0].checked=true; cbs[0].dispatchEvent(new Event('change'));
    res.sum1=document.querySelector('#tpl-roster-sum').textContent.trim();
    document.querySelector('#tpl-roster-csv').click();
    await new Promise(r=>setTimeout(r,150));
    res.csv1=blobs.length?await blobs[blobs.length-1].text():"";

    cbs[1].checked=true; cbs[1].dispatchEvent(new Event('change'));
    res.sum2=document.querySelector('#tpl-roster-sum').textContent.trim();
    document.querySelector('#tpl-roster-csv').click();
    await new Promise(r=>setTimeout(r,150));
    res.csv2=blobs.length?await blobs[blobs.length-1].text():"";
    document.querySelector('#tpl-roster-go').click();
    await new Promise(r=>setTimeout(r,200));
    res.printBlocks=(opened.length?(opened[opened.length-1].match(/<h3>[^<]*<\/h3>/g)||[]):[]).length;
    return res;
  });

  if(!R.hasBox) bad('בורר הגנים המרובה קיים במסך "מסמכים ותבניות"');
  else ok('בורר הגנים המרובה קיים במסך "מסמכים ותבניות"');
  if(R.buttons.length===4) ok('ארבעה כפתורי הפקה: הדפסה · אקסל צבעוני · CSV · שיתוף');
  else bad('ארבעה כפתורי הפקה', 'נמצאו: '+R.buttons.join(', '));
  if(R.ganCount===3) ok('כל הגנים הפעילים ברשימת הסימון ('+R.ganCount+')');
  else bad('כל הגנים הפעילים ברשימת הסימון', R.ganCount);
  if((R.tplOpts||[]).join(',')==='fixed,full') ok('שתי תבניות עמודות — קבועה ומורחבת');
  else bad('שתי תבניות עמודות', (R.tplOpts||[]).join(','));
  if(R.sum1==='גן הדקל' && R.sum2==='2 גנים נבחרו') ok('תקציר הבורר משתנה: גן אחד → "2 גנים נבחרו"');
  else bad('תקציר הבורר', R.sum1+' / '+R.sum2);

  const head1=(R.csv1||'').split('\r\n')[0];
  const WANT = "מס',מספר זהות,שם משפחה,שם פרטי,כתובת,מספר בניין,טלפון,טלפון הורה";
  if(head1===WANT) ok('התבנית הקבועה: '+WANT);
  else bad('התבנית הקבועה', head1);

  const lines2=(R.csv2||'').split('\r\n');
  const head2=lines2[0];
  const nums=lines2.slice(1).map(l=>l.split(',')[0]);
  if(head2==="מס',גן,"+WANT.split(',').slice(1).join(',')) ok('בכמה גנים יחד נוספת עמודת "גן" אחרי המספור');
  else bad('עמודת "גן" בבחירה מרובה', head2);
  if(nums.join(',')==='1,2,3,4,1,2') ok('המספור מתחיל מ-1 בכל גן (1,2,3,4 · 1,2)');
  else bad('המספור לכל גן', nums.join(','));
  if(R.printBlocks===2) ok('בהדפסה כל גן מקבל בלוק משלו (2 גנים = 2 כותרות)');
  else bad('בלוק לכל גן בהדפסה', R.printBlocks);

  /* ---------- טור המספור ביצוא רשימת התלמידות ---------- */
  const X = await p.evaluate(async ()=>{
    const res={};
    const blobs=[];
    URL.createObjectURL=function(b){ blobs.push(b); return "blob:stub"; };
    URL.revokeObjectURL=function(){};
    const opened=[];
    window.open=function(){ return { document:{ write(h){ opened.push(h); }, close(){} }, focus(){}, print(){} }; };
    __set('active','students'); route();
    await new Promise(r=>setTimeout(r,250));
    openExportModal();
    await new Promise(r=>setTimeout(r,250));
    res.preview=[...document.querySelectorAll('#x-out thead th')].map(t=>t.textContent);
    res.firstCells=[...document.querySelectorAll('#x-out tbody tr')].map(tr=>tr.firstElementChild.textContent);
    document.querySelector('#x-csv').click();
    await new Promise(r=>setTimeout(r,150));
    res.csv=blobs.length?await blobs[blobs.length-1].text():"";
    document.querySelector('#x-pdf').click();
    await new Promise(r=>setTimeout(r,200));
    res.pdfHead=(opened.length?(opened[opened.length-1].match(/<th>[^<]*<\/th>/)||[])[0]:"")||"";
    closeModal();
    return res;
  });
  if((X.preview||[])[0]==="מס'") ok('תצוגת הייצוא: טור המספור ראשון');
  else bad('תצוגת הייצוא', (X.preview||[]).slice(0,3).join(' · '));
  if((X.firstCells||[]).join(',')==='1,2,3,4,5,6') ok('המספור רץ מ-1 עד מספר התלמידות');
  else bad('המספור בתצוגה', (X.firstCells||[]).join(','));
  if((X.csv||'').split('\r\n')[0].indexOf("מס',")===0) ok('CSV: טור המספור ראשון');
  else bad('CSV', (X.csv||'').split('\r\n')[0]);
  if(/<th>מס(&#39;|')<\/th>/.test(X.pdfHead)) ok('הדפסה / PDF: טור המספור ראשון');
  else bad('הדפסה / PDF', X.pdfHead);

  if(errs.length){ errs.forEach(e=>bad('שגיאת JS', e)); }
  else ok('אף שגיאת JS לא נזרקה');

  console.log('============================================');
  console.log(fail ? ('תוצאה: '+fail+' בדיקות נכשלו ❌') : 'תוצאה: רשימת הגן והמספור ביצוא תקינים ✅');
  await browser.close(); server.close();
  process.exit(fail ? 1 : 0);
})();
