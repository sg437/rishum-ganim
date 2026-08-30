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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

  /* --- 1. כרטיס גן פותח את תיק הגן ------------------------------------- */
  await goTab(p, 'gans'); await p.waitForTimeout(900);
  const toCards = await p.evaluate(() => {
    const t = [...document.querySelectorAll('.lab-gtoggle .lg-tab')].find(b => /כרטיס/.test(b.textContent));
    if (t) t.click(); return !!t;
  });
  await p.waitForTimeout(700);
  const cardInfo = await p.evaluate(() => {
    const c = document.querySelector('.lg-card');
    return c ? { role: c.getAttribute('role'), tabIndex: c.tabIndex,
                 cursor: getComputedStyle(c).cursor, name: (c.querySelector('.lg-ttl b') || {}).textContent } : null;
  });
  if (!toCards)        bad('לא נמצא מתג "כרטיסים" בלוח הגנים');
  else if (!cardInfo)  bad('תצוגת הכרטיסים לא רונדרה');
  else {
    await p.evaluate(() => { const c = document.querySelector('.lg-card'); if (c) c.click(); });
    await p.waitForTimeout(600);
    const m = await p.evaluate(() => {
      const h = document.querySelector('#modal h3');
      const n = document.querySelector('#modal #g-ganName');
      return { title: h ? h.textContent.trim() : null, name: n ? n.value : null };
    });
    if (m.title !== 'עריכת גן') bad('לחיצה על כרטיס גן לא פתחה את תיק הגן', ['התקבל: ' + m.title]);
    else if (m.name !== cardInfo.name) bad('נפתח גן אחר מזה שנלחץ', ['כרטיס: ' + cardInfo.name + ' · נפתח: ' + m.name]);
    else if (cardInfo.role !== 'button' || cardInfo.tabIndex !== 0) bad('הכרטיס לחיץ אך אינו נגיש למקלדת',
      ['role=' + cardInfo.role + ' tabindex=' + cardInfo.tabIndex]);
    else if (cardInfo.cursor !== 'pointer') bad('הכרטיס לחיץ אך הסמן אינו מסגיר זאת', ['cursor=' + cardInfo.cursor]);
    else ok('כרטיס גן פותח את תיק הגן הנכון (' + m.name + '), לחיץ במקלדת ובעכבר');
    await p.evaluate(() => closeModal()); await p.waitForTimeout(300);
  }

  /* --- 2. הכפתור הדביק בתיק הילדה יושב על רוחב הכרטיס ------------------ */
  await goTab(p, 'students'); await p.waitForTimeout(900);
  await p.evaluate(() => { const r = document.querySelector('.stu-table tbody tr'); if (r) r.click(); });
  await p.waitForTimeout(700);
  const q = await p.evaluate(() => {
    const card = document.querySelector('.stu-quick .qcard');
    const btn = card && card.querySelector(':scope > .btn.full');
    if (!btn) return null;
    const c = card.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const bw = parseFloat(getComputedStyle(card).borderInlineStartWidth) || 0;
    return { startGap: Math.round(b.left - c.left), endGap: Math.round(c.right - b.right),
             border: bw, cardOverflow: getComputedStyle(card).overflow, position: getComputedStyle(btn).position };
  });
  if (!q) bad('לא נמצא הכפתור "פתיחת התיק המלא" בתיק הילדה');
  else if (Math.abs(q.startGap - q.endGap) > 1)
    bad('הפס התחתון אינו מרוכז על הכרטיס', ['מרווח בהתחלה ' + q.startGap + 'px · בסוף ' + q.endGap + 'px']);
  else if (q.startGap > 2)
    bad('הפס התחתון אינו נמתח לרוחב הכרטיס', ['מרווח של ' + q.startGap + 'px משני הצדדים']);
  else if (q.cardOverflow !== 'visible')
    bad('הכרטיס עדיין מכל־גלילה (overflow:' + q.cardOverflow + ') — זה מבטל את ההצמדה של הכפתור');
  else if (q.position !== 'sticky')
    bad('הכפתור אינו דביק', ['position=' + q.position]);
  else ok('הפס התחתון בתיק הילדה יושב בדיוק על רוחב הכרטיס ונשאר דביק');

  /* --- 3. אין לשוניות "ייצוא" ו"עירייה" בניווט -------------------------- */
  const navTabs = await p.evaluate(() => [...document.querySelectorAll('#tabs [data-tab]')].map(b => b.dataset.tab));
  if (navTabs.includes('export')) bad('לשונית "ייצוא" חזרה לניווט', [navTabs.join(' · ')]);
  else if (navTabs.includes('municipality')) bad('לשונית "עירייה" חזרה לניווט', [navTabs.join(' · ')]);
  else if (navTabs.length < 10)   bad('הניווט נראה חסר — ' + navTabs.length + ' לשוניות בלבד', [navTabs.join(' · ')]);
  else ok(navTabs.length + ' לשוניות בניווט, בלי "ייצוא" ובלי "עירייה" — שתיהן יושבות בתוך לשונית התלמידות');

  /* --- 4. "ייצוא" בלשונית התלמידות פותח את המסך המעוצב ----------------- */
  await p.evaluate(() => { const b = document.querySelector('#exportStu'); if (b) b.click(); });
  await p.waitForTimeout(800);
  const x = await p.evaluate(() => {
    const m = document.querySelector('#modal');
    if (!m) return null;
    const panel = m.querySelector('.panel');
    const big = m.querySelector('.lab-bignum');
    return {
      title: m.querySelector('h2') ? m.querySelector('h2').textContent.trim() : null,
      work: !!m.querySelector('.lab-work'), side: !!m.querySelector('.lab-wside .lab-send'),
      bare: !!(panel && panel.classList.contains('lab-bare')),
      big: big ? big.textContent.trim() : null,
      primary: (() => { const b = m.querySelector('.lab-sendacts .btn:not(.ghost)'); return b ? b.textContent.trim() : null; })(),
      fields: m.querySelectorAll('.lab-wmain .check').length,
    };
  });
  if (!x)                bad('כפתור "ייצוא" לא פתח דבר');
  else if (x.title !== 'ייצוא רשימות') bad('נפתח חלון אחר', ['כותרת: ' + x.title]);
  else if (!x.work || !x.side || !x.bare)
    bad('חלון הייצוא נפתח בעיצוב הישן', ['lab-work=' + x.work + ' lab-wside=' + x.side + ' lab-bare=' + x.bare]);
  else if (!x.fields)    bad('רשימת השדות לייצוא ריקה');
  else {
    /* התצוגה המקדימה חייבת להזין את המספר הגדול שבלוח הכהה */
    await p.evaluate(() => { const b = document.querySelector('#modal #x-preview'); if (b) b.click(); });
    await p.waitForTimeout(600);
    const after = await p.evaluate(() => {
      const n = document.querySelector('.lab-bignum'), c = document.querySelector('.lab-cntline');
      return { big: n ? n.textContent.trim() : null, meta: c ? c.textContent.trim() : null };
    });
    if (after.big !== '6') bad('המונה שבלוח הכהה אינו עוקב אחרי התצוגה המקדימה', ['התקבל: ' + after.big + ' (צפוי 6)']);
    else ok('"ייצוא" פותח את מסך שתי העמודות — ' + x.fields + ' שדות, מונה חי (' + after.big + ' ' + after.meta + ')');
  }

  await p.evaluate(() => closeModal()); await p.waitForTimeout(400);

  /* --- 5. "עדכון לפי ת"ז" מכיל את רשימת העירייה, והיא עובדת ------------ */
  await goTab(p, 'students'); await p.waitForTimeout(900);
  /* "עדכון לפי מ.ז." יושב בכפתור המרחף */
  await p.evaluate(() => { document.querySelector('#fabBtn').click(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const it = [...document.querySelectorAll('#fabMenu .fab-item')]
                 .find(b => b.textContent.indexOf('מ.ז.') >= 0);
    if (it) it.click();
  });
  await p.waitForTimeout(700);
  const bi = await p.evaluate(() => {
    const m = document.querySelector('#modal');
    if (!m || !m.querySelector('#bi-text')) return null;
    const fs = m.querySelector('#bi-muni');
    const kids = [...m.children];
    const cancel = m.querySelector('#bi-cancel');
    return {
      title:  (m.querySelector('h3') || {}).textContent,
      muni:   !!fs,
      legend: fs ? (fs.querySelector('legend') || {}).textContent : null,
      /* המקטע חייב להיות *מתחת* למקטע העדכון לפי שדה, לא לפניו */
      afterOut: fs ? kids.indexOf(fs) > kids.indexOf(m.querySelector('#bi-text').closest('fieldset')) : false,
      /* ו"עדכן" יושב בתוך המקטע שלו, לא בין השניים */
      doInList: !!(m.querySelector('#bi-text').closest('fieldset').querySelector('#bi-do')),
      /* ו"סגירה" מתחתיו — הוא סוגר את החלון כולו */
      cancelLast: !!(cancel && fs && kids.indexOf(cancel.parentNode) > kids.indexOf(fs)),
      run:    !!(fs && fs.querySelector('#muni-run')),
      csv:    !!(fs && fs.querySelector('#muni-file')),
    };
  });
  if (!bi)             bad('כפתור "עדכון לפי ת"ז" לא פתח את החלון');
  else if (!bi.muni)   bad('אין מקטע "רשימת העירייה" בחלון "עדכון לפי ת"ז"');
  else if (!bi.run || !bi.csv) bad('מקטע העירייה חסר פקדים', ['התאמה=' + bi.run + ' CSV=' + bi.csv]);
  else if (!bi.doInList)   bad('"עדכן" נשאר בין שני המקטעים ולא בתוך המקטע שלו');
  else if (!bi.afterOut)   bad('מקטע העירייה אינו בתחתית החלון');
  else if (!bi.cancelLast) bad('"סגירה" נשאר באמצע החלון, מעל מקטע העירייה');
  else {
    /* לא רק שהוא שם — הוא גם מסמן. שתי ת"ז מתוך השש שבנתוני הבדיקה. */
    const before = await p.evaluate(() => DB.students.filter(s => s.absorbedMunicipality).length);
    await p.evaluate(() => {
      document.querySelector('#modal #muni-text').value = '123456781\n123456782';
      document.querySelector('#modal #muni-run').click();
    });
    await p.waitForTimeout(500);
    const after = await p.evaluate(() => ({
      marked: DB.students.filter(s => s.absorbedMunicipality).map(s => s.tz),
      result: (document.querySelector('#modal #muni-result .stat.hero .v') || {}).textContent,
    }));
    if (before !== 0)              bad('נתוני הבדיקה כבר סומנו — הבדיקה אינה אומרת דבר');
    else if (after.marked.length !== 2)
      bad('ההתאמה מהחלון לא סימנה את התיקים', ['סומנו: ' + after.marked.join(', ')]);
    else if (after.result !== '2') bad('לוח התוצאה אינו מדווח נכון', ['התקבל: ' + after.result]);
    else ok('"רשימת העירייה" יושב בתחתית "עדכון לפי ת"ז" ומסמן (' + after.marked.join(', ') + ')');
  }
  await p.evaluate(() => closeModal()); await p.waitForTimeout(300);

  /* --- 6. מסך הצוות — מבנה, חמש עמודות, תיק בצד ופס תחתון ------------- */
  /* שיבוצי הצוות נזרעים כאן ולא ב-SEED: החלונות שנפתחו בבדיקות שמעל קוראים
     ל-save(), והוא מריץ את מיזוג-הכתיבה שמחזיר את השנה ואת מפת השיבוצים
     למצב שבמסד המדומה. */
  await p.evaluate(() => {
    DB.activeYear = 'תשפ"ז';
    DB.assignments = { 'תשפ"ז': { activity: { g1: { 'גננת': { staffId:'m1', name:'ברקוביץ שרה' } } } } };
  });
  await goTab(p, 'staff'); await p.waitForTimeout(1000);
  const st = await p.evaluate(() => ({
    title: (document.querySelector('.lab-shead h2') || {}).textContent,
    sub:   (document.querySelector('.lab-ssub') || {}).textContent,
    acts:  [...document.querySelectorAll('.lab-sacts .btn')].map(b => b.id),
    kpis:  [...document.querySelectorAll('.lab-stkpis .lh-k')].map(x => x.textContent.trim()),
    cols:  [...document.querySelectorAll('.lab-strows th')].map(t => t.textContent.replace(/[▲▼]/g, '').trim()),
    rows:  document.querySelectorAll('.lab-strows tbody tr').length,
    /* שורת החיפוש חייבת לשבת בתוך עמודת הרשימה, לא מעל הבמה */
    sbIn:  !!document.querySelector('.lab-stmain > .searchbar'),
    chips: [...document.querySelectorAll('.lab-rchip')].map(b => b.dataset.role),
    /* הטבלה של התוכנה נשארת כמקור נתונים, מוסתרת */
    appTableHidden: !!(document.querySelector('#staffTable') || {}).classList.contains('lab-hidden'),
  }));
  if (st.title !== 'צוות הגנים')
    bad('כותרת מסך הצוות אינה "צוות הגנים"', ['התקבל: ' + st.title]);
  else if (st.acts.join(',') !== 'impStaff,labStaffExp')
    bad('סדר כפתורי הפעולה אינו: ייבוא · ייצוא', [st.acts.join(' · ')]);
  else if (st.kpis[3] !== 'שאר הצוות')
    bad('המשבצת הרביעית אינה "שאר הצוות"', ['התקבל: ' + st.kpis[3]]);
  else if (st.cols.join('|') !== 'שם משפחה ופרטי|טלפון|תפקיד|משובצת ב־|סטטוס')
    bad('עמודות הרשימה אינן חמש המבוקשות', [st.cols.join(' · ')]);
  else if (!st.sbIn)
    bad('שורת החיפוש אינה יושבת בתוך עמודת הרשימה — היא לא תתכווץ כשייפתח תיק בצד');
  else if (!st.appTableHidden)
    bad('הטבלה של התוכנה לא הוסתרה — שתי רשימות מוצגות זו על זו');
  else if (st.rows !== 3)
    bad('הרשימה אינה מציגה את שלושת הפעילים', ['מוצגות ' + st.rows + ' שורות']);
  else ok('מסך הצוות: ' + st.cols.length + ' עמודות, ' + st.kpis.length + ' משבצות (' + st.kpis[3] + '), חיפוש בתוך עמודת הרשימה');

  /* שבבי התפקיד — בחירה מרובה */
  const roleFilter = await p.evaluate(async () => {
    const wait = () => new Promise(r => setTimeout(r, 450));
    const hit = r => [...document.querySelectorAll('.lab-rchip')].find(b => b.dataset.role === r);
    hit('גננת').click(); await wait();
    const one = document.querySelectorAll('.lab-strows tbody tr').length;
    hit('סייעת').click(); await wait();
    const two = document.querySelectorAll('.lab-strows tbody tr').length;
    const extra = [...document.querySelectorAll('.lab-rmore input')].find(c => c.value === 'העשרה');
    extra.click(); await wait();
    const three = document.querySelectorAll('.lab-strows tbody tr').length;
    document.querySelector('.lab-rclear').click(); await wait();
    return { one, two, three, all: document.querySelectorAll('.lab-strows tbody tr').length,
             num: (document.querySelector('.lab-mnum') || {}).textContent };
  });
  if (roleFilter.one !== 1 || roleFilter.two !== 2 || roleFilter.three !== 3)
    bad('שבבי התפקיד אינם מצטברים', ['גננת=' + roleFilter.one + ' +סייעת=' + roleFilter.two + ' +העשרה=' + roleFilter.three]);
  else if (roleFilter.all !== 3)
    bad('"נקה" לא החזיר את הרשימה המלאה', ['נשארו ' + roleFilter.all]);
  else ok('שבבי התפקיד מצטברים (1 → 2 → 3) ו"נקה" מחזיר הכול');

  /* התיק בצד — נפתח, מצטמצם על הרשימה, ומביא נתונים אמיתיים */
  const before = await p.evaluate(() => document.querySelector('.searchbar').getBoundingClientRect().width);
  await p.evaluate(() => { const r = document.querySelector('.lab-strows tbody tr'); if (r) r.click(); });
  await p.waitForTimeout(700);
  const dossier = await p.evaluate(() => {
    const q = document.querySelector('.lab-stquick');
    if (!q || q.classList.contains('empty-state')) return null;
    return {
      name: (q.querySelector('.qname') || {}).textContent,
      sub:  (q.querySelector('.qtz') || {}).textContent,
      acts: [...q.querySelectorAll('.lab-stqact')].map(a => a.textContent.trim()),
      docs: [...q.querySelectorAll('.qdoc')].map(d => d.textContent.trim()),
      att:  [...q.querySelectorAll('.lab-stattc .v')].map(v => v.textContent),
      hist: q.querySelectorAll('.lab-sthist').length,
      note: !!q.querySelector('.lab-stnote'),
      full: !!q.querySelector('.btn.full'),
      sbW:  document.querySelector('.searchbar').getBoundingClientRect().width,
      bot:  (document.querySelector('.lab-stbot .lab-stbname') || {}).textContent,
      botBtns: document.querySelectorAll('.lab-stbot .btn').length,
    };
  });
  if (!dossier)                    bad('לחיצה על שורה לא פתחה את התיק בצד');
  else if (!/ברקוביץ/.test(dossier.name)) bad('נפתח תיק של מישהו אחר', ['התקבל: ' + dossier.name]);
  else if (!/גננת/.test(dossier.sub) || !/ותק/.test(dossier.sub))
    bad('שורת המשנה בתיק אינה "תפקיד · גן · ותק"', ['התקבל: ' + dossier.sub]);
  else if (dossier.acts.length !== 3)
    bad('אין שלוש פעולות קשר בתיק', [dossier.acts.join(' · ')]);
  else if (dossier.att.join(',') !== '1,0')
    bad('משבצות הנוכחות אינן קוראות מהנתונים', ['התקבל: ' + dossier.att.join(', ')]);
  else if (!dossier.hist)          bad('אין "תנועות בשנים קודמות" למי שמשובצת');
  else if (!dossier.note)          bad('ההערה שבתיק אינה מוצגת');
  else if (!dossier.full)          bad('אין כפתור "פתיחת תיק העובדת המלא"');
  else if (!(dossier.sbW < before - 100))
    bad('שורת החיפוש לא התכווצה כשנפתח התיק', ['לפני ' + Math.round(before) + 'px · אחרי ' + Math.round(dossier.sbW) + 'px']);
  else if (!/ברקוביץ/.test(dossier.bot) || dossier.botBtns !== 3)
    bad('הפס הכהה התחתון אינו מציג את הבחירה עם שלוש הפעולות', [dossier.bot + ' · ' + dossier.botBtns + ' כפתורים']);
  else ok('התיק בצד נפתח על ' + dossier.name.trim() + ', החיפוש התכווץ ל-' + Math.round(dossier.sbW) + 'px, והפס התחתון מציג את הבחירה');

  /* --- 7. "עדכון לפי ת"ז" בייבוא הצוות מעדכן תיקים ופותח חדשים -------- */
  await p.evaluate(() => { const b = document.querySelector('#impStaff'); if (b) b.click(); });
  await p.waitForTimeout(700);
  const tz = await p.evaluate(async () => {
    const m = document.querySelector('#modal');
    const mode = [...m.querySelectorAll('.lab-mode')].find(b => b.dataset.m === 'tz');
    if (!mode) return { noMode: true };
    mode.click();
    m.querySelector('#stu-text').value = 'ת"ז,נייד,עיר\n039112881,050-9999999,ביתר עילית\n888888888,050-7777777,אלעד';
    m.querySelector('#stu-preview').click();
    await new Promise(r => setTimeout(r, 350));
    const stats = [...m.querySelectorAll('#stu-out .stat .v')].map(x => x.textContent);
    /* ⚠️ נקרא מיד אחרי הלחיצה, בלי המתנה: save() מתזמן דחיפה אחרי 250ms,
       ומול ה-Firestore המדומה היא מנקה את הרשומות שנכתבו. */
    m.querySelector('#stu-do').click();
    const a = DB.staff.find(x => x.tz === '039112881');
    const n = DB.staff.find(x => x.tz === '888888888');
    return { stats, mobile: a && a.mobile, city: a && a.city, name: a && a.lastName,
             created: !!n, newMobile: n && n.mobile, out: (m.querySelector('#stu-out') || {}).textContent };
  });
  if (tz.noMode)                bad('אין מצב "עדכון לפי ת"ז" בחלון ייבוא הצוות');
  else if (tz.stats.join(',') !== '1,1,2')
    bad('התצוגה המקדימה של העדכון אינה מדווחת נכון', ['התקבל: ' + tz.stats.join(' · ') + ' (צפוי 1 · 1 · 2)']);
  else if (tz.mobile !== '050-9999999' || tz.city !== 'ביתר עילית')
    bad('העדכון לא החליף את הערכים הקיימים', ['נייד=' + tz.mobile + ' עיר=' + tz.city]);
  else if (tz.name !== 'ברקוביץ')
    bad('העדכון דרס שדה שלא נבחר', ['שם משפחה=' + tz.name]);
  else if (!tz.created || tz.newMobile !== '050-7777777')
    bad('ת"ז שאינה במאגר לא נפתחה כתיק חדש', ['נוצר=' + tz.created + ' נייד=' + tz.newMobile]);
  else ok('"עדכון לפי ת"ז" החליף נייד ועיר בתיק קיים, ופתח תיק חדש לת"ז שאינה במאגר');
  await p.evaluate(() => closeModal()); await p.waitForTimeout(400);

  /* --- 8. מסך ההגדרות: הכול במקום אחד, מקובץ ומאוחד ---------------------- */
  await p.evaluate(() => {
    DB.years = ['תשפ"ו', 'תשפ"ז', 'תשפ"ח']; DB.activeYear = 'תשפ"ז';
    DB.settings.admins = ['admin@ganim.org'];
    DB.settings.campuses = ['קמפוס מרכז', 'קמפוס צפון'];
    __set('currentUser', { email: 'sg@taharat.org' });   /* בעלים — מנהל תמיד */
    route();
  });
  await goTab(p, 'settings'); await p.waitForTimeout(1100);
  const sg = await p.evaluate(() => {
    const col   = document.querySelector('.lab-setcol');
    const cards = col ? [...col.querySelectorAll(':scope > .panel.lab-made')].map(n => n.dataset.lab) : [];
    /* רשימת המקטעים עברה לסרגל הניווט, מתחת ל"הגדרות" */
    const toc   = [...document.querySelectorAll('#setSubnav .subnav-g')].map(a => a.textContent.trim());
    const jumps = [...document.querySelectorAll('#setSubnav .subnav-i')].map(b => b.dataset.setjump);
    /* פריט אחד ברשימה עשוי לכסות כמה פאנלים — די באחד מהם */
    const dead  = jumps.filter(k => !document.querySelector(
      k.trim().split(/\s+/).map(x => '#view [data-set~="' + x + '"]').join(',')));
    const yearC = col && col.querySelector('[data-lab="year"]');
    return {
      inTop:      !!document.querySelector('header.top .lab-yearpick, header.top #yearSelect'),
      inTopChips: !!document.querySelector('.top-chips #yearSelect'),
      realHome:   (document.getElementById('yearSelect') || {}).parentElement
                    ? document.getElementById('yearSelect').parentElement.className : null,
      cards, groups: toc, jumps, dead,
      sideToc:    !!document.querySelector('.lab-toc'),
      caret:      !!document.querySelector('.drawer-nav .nav-caret'),
      firstCard:  cards[0] || null,
      /* שנים ומעבר שנה — שבבים, השנה הפעילה מסומנת, ומעבר השנה בפנים */
      chips:      yearC ? [...yearC.querySelectorAll('.lab-yearchip')].map(c => ({
                    y: (c.querySelector('.lab-chiptxt') || {}).textContent,
                    on: c.classList.contains('on') })) : [],
      hasAdd:     !!(yearC && yearC.querySelector('.lab-chipadd')),
      promoteIn:  !!(yearC && yearC.querySelector('#pr-from')),
      promoteHid: !!(yearC && yearC.querySelector('.lab-setsubbody.lab-hidden')),
      skipGrad:   !!(yearC && yearC.querySelector('#pr-skipgrad')),
      /* נתונים היסטוריים — שתי רשימות סגורות */
      folds:      [...document.querySelectorAll('[data-lab="hist"] details.lab-fold')].map(d => d.open),
      histIn:     !!document.querySelector('[data-lab="hist"] #hist-box'),
      histGanIn:  !!document.querySelector('[data-lab="hist"] #hist-gans-box'),
      /* רשימות המערכת — שבבים ושורות */
      ages:       [...document.querySelectorAll('[data-lab="ages"] .lab-chip[data-v]')].map(c => c.dataset.v),
      camps:      [...document.querySelectorAll('[data-lab="campus"] .lab-chip[data-v]')].map(c => c.dataset.v),
      roles:      [...document.querySelectorAll('[data-lab="roles"] .lab-rolerow')].map(r => r.dataset.v),
      roleGrip:   !!document.querySelector('[data-lab="roles"] .lab-rolerow .lab-grip'),
      roleColor:  !!document.querySelector('[data-lab="roles"] .lab-rolerow .lab-rolecolor'),
      roleDel:    !!document.querySelector('[data-lab="roles"] .lab-rolerow .lab-rowx'),
      /* איחודים */
      halves:     [...document.querySelectorAll('[data-lab="presence"] .lab-half')].length,
      presIn:     !!document.querySelector('[data-lab="presence"] #presenceBox'),
      actIn:      !!document.querySelector('[data-lab="presence"] #activityBox'),
      usersIn:    !!document.querySelector('[data-lab="users"] #users-box'),
      adminsIn:   !!document.querySelector('[data-lab="users"] #admins-box'),
      brandIn:    !!document.querySelector('[data-lab="brand"] #br-title'),
      subIn:      !!document.querySelector('[data-lab="brand"] #br-sub'),
      installIn:  !!document.querySelector('[data-lab="brand"] #install-box'),
      capsIn:     !!document.querySelector('[data-lab="caps"] #ac-reg'),
      tzIn:       document.querySelectorAll('[data-lab="tzmin"] .lab-tzrow input.tzlim').length === 4,
      fbIn:       !!document.querySelector('[data-lab="feedback"] #feedback-box'),
      /* עמודת המשתמש בטבלה — עיגול ראשי תיבות, שם ומייל בתא אחד */
      uCell:      !!document.querySelector('table.lab-users .lab-ucell .lab-uini')
    };
  });
  const GROUPS = ['שנה ונתונים', 'רשימות המערכת', 'מערכת ומשתמשים', 'מראה והתקנה'];
  const CARDS  = ['year','hist','ages','roles','campus','caps','tzmin','presence','users','auth','feedback','brand'];
  if (sg.inTop || sg.inTopChips)
    bad('בורר השנה עדיין יושב ברצועה העליונה');
  else if (sg.realHome !== 'drawer-year')
    bad('ה-<select> המקורי אינו במגירה — הוא לא ישרוד בניית מסך מחדש', ['הורה: ' + sg.realHome]);
  else if (sg.sideToc)
    bad('רשימת הניווט הצדדית עדיין במסך ההגדרות');
  else if (!sg.caret)
    bad('אין חץ פתיחה ללשונית ההגדרות בסרגל הניווט');
  else if (sg.groups.join(' · ') !== GROUPS.join(' · '))
    bad('קבוצות ההגדרות בסרגל אינן לפי הסדר', ['התקבל: ' + sg.groups.join(' · ')]);
  else if (sg.dead.length)
    bad('מקטעים בסרגל שאין להם יעד במסך', [sg.dead.join(' · ')]);
  else if (sg.cards.join(',') !== CARDS.join(','))
    bad('כרטיסי ההגדרות אינם לפי הסדר', ['התקבל: ' + sg.cards.join(' · ')]);
  else ok('הגדרות: ' + sg.groups.length + ' קבוצות ו-' + sg.jumps.length +
          ' מקטעים בסרגל הניווט · ' + sg.cards.length + ' כרטיסים, בסדר הנכון');

  if (sg.firstCard !== 'year')
    bad('"שנים ומעבר שנה" אינו הכרטיס הראשון בהגדרות', ['ראשון: ' + sg.firstCard]);
  else if (sg.chips.map(c => c.y).join(',') !== 'תשפ"ו,תשפ"ז,תשפ"ח')
    bad('שבבי השנים אינם משקפים את רשימת השנים', ['שבבים: ' + sg.chips.map(c => c.y).join(' · ')]);
  else if (sg.chips.filter(c => c.on).map(c => c.y).join(',') !== 'תשפ"ז')
    bad('השנה הפעילה אינה מסומנת בשבבים', ['מסומן: ' + sg.chips.filter(c => c.on).map(c => c.y).join(' · ')]);
  else if (!sg.hasAdd)
    bad('אין שבב "+ הוספת שנה"');
  else if (!sg.promoteIn || !sg.skipGrad)
    bad('"מעבר שנה" אינו בתוך כרטיס השנים', ['מעבר=' + sg.promoteIn + ' סימון מסיימות=' + sg.skipGrad]);
  else if (!sg.promoteHid)
    bad('תהליך מעבר השנה אינו מקופל מאחורי "התחלת תהליך"');
  else ok('שנים ומעבר שנה: 3 שבבים (תשפ"ז פעילה) · הוספת שנה · מעבר שנה מקופל בפנים');

  if (!sg.histIn || !sg.histGanIn)
    bad('שני פאנלי הנתונים ההיסטוריים לא נכנסו לכרטיס אחד');
  else if (sg.folds.length !== 2 || sg.folds.some(Boolean))
    bad('הנתונים ההיסטוריים אינם שתי רשימות סגורות', ['פתוחות: ' + JSON.stringify(sg.folds)]);
  else ok('נתונים היסטוריים: שתי רשימות שנפתחות, סגורות כברירת מחדל');

  if (!sg.ages.length || !sg.camps.length)
    bad('גילי הילדים / הקמפוסים אינם מוצגים כשבבים', ['גילים=' + sg.ages.length + ' קמפוסים=' + sg.camps.length]);
  else if (!sg.roles.length || !sg.roleGrip || !sg.roleColor || !sg.roleDel)
    bad('שורות התפקידים חסרות ידית גרירה / צבע / מחיקה',
        ['שורות=' + sg.roles.length + ' ידית=' + sg.roleGrip + ' צבע=' + sg.roleColor + ' מחיקה=' + sg.roleDel]);
  else if (!sg.capsIn || !sg.tzIn)
    bad('רף השיבוץ / מגבלות הצהרון אינם בכרטיסים שלהם', ['רף=' + sg.capsIn + ' צהרון=' + sg.tzIn]);
  else ok('רשימות המערכת: ' + sg.ages.length + ' גילים · ' + sg.camps.length + ' קמפוסים · '
          + sg.roles.length + ' תפקידים (גרירה · צבע · מחיקה)');

  if (sg.halves !== 2 || !sg.presIn || !sg.actIn)
    bad('"מי מחובר" ו"יומן פעילות" לא אוחדו לכרטיס אחד בשני טורים', ['טורים: ' + sg.halves]);
  else if (!sg.usersIn || !sg.adminsIn)
    bad('"ניהול משתמשים" ו"מנהלי מערכת" לא אוחדו', ['משתמשים=' + sg.usersIn + ' מנהלים=' + sg.adminsIn]);
  else if (!sg.uCell)
    bad('טבלת המשתמשים לא קיבלה עמודת "משתמש" עם עיגול ראשי תיבות');
  else if (!sg.brandIn || !sg.subIn || !sg.installIn)
    bad('"מיתוג" ו"התקנה כאפליקציה" לא אוחדו, או שחסרה כותרת המשנה',
        ['מיתוג=' + sg.brandIn + ' כותרת משנה=' + sg.subIn + ' התקנה=' + sg.installIn]);
  else if (!sg.fbIn)
    bad('"פניות והצעות שיפור" אינו בכרטיס משלו');
  else ok('איחודים: מי מחובר + יומן · משתמשים + מנהלים · מיתוג + התקנה (עם כותרת משנה)');

  /* לחיצה על שבב שנה — חייבת להזיז את DB.activeYear דרך המאזין המקורי */
  const sw = await p.evaluate(async () => {
    const chip = [...document.querySelectorAll('.lab-yearchip')]
      .find(c => (c.querySelector('.lab-chiptxt') || {}).textContent === 'תשפ"ח');
    if (!chip) return null;
    chip.querySelector('.lab-chiptxt').click();
    await new Promise(r => setTimeout(r, 700));
    return { active: DB.activeYear,
             real: (document.getElementById('yearSelect') || {}).value,
             on: [...document.querySelectorAll('.lab-yearchip.on .lab-chiptxt')].map(t => t.textContent).join(',') };
  });
  if (!sw)                        bad('שבב השנה לא נמצא');
  else if (sw.active !== 'תשפ"ח') bad('לחיצה על שבב שנה לא שינתה את שנת העבודה', ['DB.activeYear=' + sw.active]);
  else if (sw.real !== 'תשפ"ח')   bad('ה-<select> המקורי לא סונכרן', ['ערך=' + sw.real]);
  else if (sw.on !== 'תשפ"ח')     bad('הסימון "פעילה" לא עבר לשנה החדשה', ['מסומן=' + sw.on]);
  else ok('לחיצה על שבב שנה מחליפה את שנת העבודה (תשפ"ז ← תשפ"ח) והסימון עובר איתה');
  await p.evaluate(() => { DB.activeYear = 'תשפ"ז'; DB.years = ['תשפ"ז']; route(); });
  await p.waitForTimeout(400);

  /* --- 8ב. מרכז ההודעות: הודעה קולית מטקסט ------------------------------ */
  await goTab(p, 'messages'); await p.waitForTimeout(700);
  const vc = await p.evaluate(async () => {
    const btn = [...document.querySelectorAll('.msg-ch')].find(b => b.dataset.v === 'voice');
    if (!btn) return null;
    btn.click();
    await new Promise(r => setTimeout(r, 600));
    const spoken = [];
    /* מנוע דיבור מדומה — speechSynthesis הוא accessor על window ולכן חייב defineProperty */
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak: u => spoken.push(u.text), cancel(){}, getVoices: () => [
        { name: 'Daniel', lang: 'en-GB' }, { name: 'Carmit', lang: 'he-IL' } ] } });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true,
      value: function (t) { this.text = t; } });
    const box = document.querySelector('#msg-voice-wrap');
    if (!box) return { wrap: false };
    /* בניית המסך מחדש כדי שרשימת הקולות תיקרא מהמנוע המדומה */
    route(); await new Promise(r => setTimeout(r, 600));
    const sel = document.querySelector('#msg-voice');
    const opts = sel ? [...sel.options].map(o => o.value) : [];
    document.querySelector('#msg-voice-rate').value = '1.2';
    document.querySelector('#msg-voice-rate').dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#msg-voice-play').click();
    return { wrap: true, opts, spoken, inMain: !!document.querySelector('.lab-wmain #msg-voice-wrap'),
             saved: (DB.settings.msgVoice || {}) };
  });
  if (!vc)              bad('אין כפתור ערוץ "הודעה קולית" במרכז ההודעות');
  else if (!vc.wrap)    bad('בחירת הערוץ הקולי לא פתחה את כרטיס "הקול של ההודעה"');
  else if (vc.opts.join(',') !== 'Carmit,Daniel')
    bad('רשימת הקולות אינה נטענת מהמכשיר (עברית קודם)', ['התקבל: ' + vc.opts.join(' · ')]);
  else if (!vc.spoken.length)
    bad('"השמעה" לא העבירה טקסט למנוע ההקראה');
  else if (!/ילדה/.test(vc.spoken[0]))
    bad('הטקסט שהוקרא אינו ההודעה הממוזגת של הנמענת הראשונה', ['הוקרא: ' + vc.spoken[0].slice(0, 60)]);
  else if (vc.saved.rate !== 1.2)
    bad('בחירת הקול והמהירות אינה נשמרת', ['נשמר: ' + JSON.stringify(vc.saved)]);
  else if (!vc.inMain)
    bad('כרטיס הקול אינו יושב בטור הראשי של מסך ההודעות המעוצב');
  else ok('הודעה קולית: 2 קולות (עברית קודם) · הטקסט הממוזג הוקרא · הקול והמהירות נשמרו');


  /* --- 8ג. שבבי הרשימות: עריכה, הוספה, מחיקה וגרירה --------------------
     ⚠️ ב-Firebase המדומה cloudDocs ריק, ולכן rebuildDB() שאחרי כל שמירה
     (‎250ms) מחזיר את DB לברירות המחדל. לכן כל פעולה נבדקת מיד אחריה,
     ומצב הפתיחה של הפעולה הבאה הוא ברירת המחדל — 2,3,4,5,6. */
  await p.evaluate(() => { __set('active', 'settings'); route(); });
  await p.waitForTimeout(900);
  const listNow = () => p.evaluate(() =>
    [...document.querySelectorAll('[data-lab="ages"] .lab-chip[data-v]')].map(c => c.dataset.v).join(','));
  const saved = () => p.evaluate(() => (DB.settings.childAges || []).join(','));

  const chipsBefore = await listNow();

  /* עריכה — כתיבה בשבב ויציאה ממנו */
  await p.evaluate(() => {
    const t = document.querySelector('[data-lab="ages"] .lab-chip[data-v] .lab-chiptxt');
    t.focus(); t.textContent = '2.5'; t.blur();   /* בלי focus, blur() אינו משגר אירוע */
  });
  await p.waitForTimeout(150);
  const afterEdit = await saved();
  await p.waitForTimeout(600);

  /* הוספה — שבב ה-"+" הופך לשדה */
  await p.evaluate(async () => {
    document.querySelector('[data-lab="ages"] .lab-chipadd').click();
    await new Promise(r => setTimeout(r, 120));
    const inp = document.querySelector('[data-lab="ages"] .lab-chipinput');
    inp.value = '7';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await p.waitForTimeout(150);
  const afterAdd = await saved();
  await p.waitForTimeout(600);

  /* גרירה — הידית מפעילה draggable, והשחרור כותב את הסדר החדש */
  await p.evaluate(() => {
    const box  = document.querySelector('[data-lab="ages"] .lab-chips');
    const list = [...box.querySelectorAll('.lab-chip[data-v]')];
    const from = list[0], to = list[2];              /* הראשון אל מעבר לשלישי */
    from.querySelector('.lab-grip').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const dt = new DataTransfer();
    from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    const r = to.getBoundingClientRect();
    to.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt,
      clientX: r.left + 2, clientY: r.top + r.height / 2 }));
    from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  });
  await p.waitForTimeout(150);
  const afterDrag = await saved();
  await p.waitForTimeout(600);

  /* מחיקה */
  await p.evaluate(() => { document.querySelector('[data-lab="ages"] .lab-chip[data-v] .lab-chipx').click(); });
  await p.waitForTimeout(150);
  const afterDel = await saved();
  await p.waitForTimeout(600);

  if (chipsBefore !== '2,3,4,5,6')
    bad('שבבי גילי הילדים אינם מציגים את הרשימה', ['התקבל: ' + chipsBefore]);
  else if (afterEdit !== '2.5,3,4,5,6')
    bad('עריכת שבב לא נשמרה', ['אחרי: ' + afterEdit]);
  else if (afterAdd !== '2,3,4,5,6,7')
    bad('הוספת שבב לא נשמרה', ['אחרי: ' + afterAdd]);
  else if (afterDrag !== '3,4,2,5,6')
    bad('גרירת שבב לא שינתה את הסדר', ['אחרי: ' + afterDrag]);
  else if (afterDel !== '3,4,5,6')
    bad('מחיקת שבב לא נשמרה', ['אחרי: ' + afterDel]);
  else ok('שבבי הרשימות: עריכה (2.5) · הוספה (7) · גרירה (' + afterDrag + ') · מחיקה (' + afterDel + ')');
  await p.evaluate(() => { __set('currentUser', null); route(); });
  await p.waitForTimeout(400);

  /* --- 9. פס הגלילה של הסרגל — צר, בלי חיצים, בגוון הסרגל --------------- */
  const sb = await p.evaluate(() => {
    const b = document.querySelector('.drawer-body');
    if (!b) return null;
    const before = b.style.height;
    b.style.height = '80px';                 /* מאלץ גלילה כדי שהפס יתפוס רוחב */
    const w = b.offsetWidth - b.clientWidth;
    b.style.height = before;
    const px = (el, pe, prop) => getComputedStyle(el, pe)[prop];
    return { w: w,
             gutter: getComputedStyle(b).scrollbarGutter,
             thumb:  px(b, '::-webkit-scrollbar-thumb', 'backgroundColor'),
             track:  px(b, '::-webkit-scrollbar-track', 'backgroundColor'),
             arrow:  px(b, '::-webkit-scrollbar-button', 'display') };
  });
  if (!sb)                         bad('לא נמצא גוף המגירה');
  else if (sb.gutter !== 'stable') bad('רוחב פס הגלילה אינו קבוע — התוכן יזוז כשהוא מופיע', ['gutter=' + sb.gutter]);
  else if (!(sb.w > 0 && sb.w <= 6))
    bad('פס הגלילה של הסרגל אינו צר', ['רוחב=' + sb.w + 'px (צפוי 5)']);
  else if (sb.arrow !== 'none')    bad('החיצים של פס הגלילה לא הוסרו', ['display=' + sb.arrow]);
  else if (!/^rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(sb.track))
    bad('המסילה הבהירה עדיין מצוירת', ['track=' + sb.track]);
  else if (/^rgba?\(\s*(0,\s*0,\s*0|255,\s*255,\s*255)/.test(sb.thumb))
    bad('גליל הגלילה אינו בגוון הסרגל', ['thumb=' + sb.thumb]);
  else ok('פס הגלילה של הסרגל צר (' + sb.w + 'px), בלי חיצים ובלי מסילה, גליל ' + sb.thumb);

  /* --- 10. שיבוץ צוות — כותרת, רצועה, מקרא, סדר לפי גיל ובורר התצוגה ---- */
  /* זריעה מחדש: החלונות שנפתחו למעלה קראו ל-save(), והוא החזיר את המסד
     המדומה (הריק) על השיבוצים ועל הצוות. */
  await p.evaluate(SEED);
  await p.evaluate(() => {
    DB.assignments = { 'תשפ"ז': { activity: {
      /* m3 (העשרה) נשארת בלי שיבוץ — כך יש מה להציג ב"זמינים לשיבוץ" */
      g1: { 'גננת': { staffId:'m1', name:'ברקוביץ שרה' },
            'סייעת': { staffId:'m2', name:'פישר נחמה' } } } } };
  });
  await goTab(p, 'assign'); await p.waitForTimeout(1200);
  const asg = await p.evaluate(() => {
    const pick = document.querySelector('.asg-picker');
    const h3   = [...document.querySelectorAll('h3')].find(h => /רשימת השיבוץ/.test(h.textContent));
    return {
      sub:    (document.querySelector('.lab-ssub') || {}).textContent,
      /* תת־הכותרת חייבת לשבת *מתחת* לכותרת */
      subAfterTitle: !!(document.querySelector('.lab-shead h2 + .lab-ssub')),
      exp:    (document.querySelector('.lab-sacts #exportAsg') || {}).textContent,
      ctx:    [...document.querySelectorAll('.lab-ctx .lab-ctxb')].map(b => b.textContent),
      /* הבורר יושב באותה שורה של ההקשרים, בקצה השמאלי */
      modes:  [...document.querySelectorAll('.la-bar .la-mode .la-modeb')].map(b => b.dataset.mode),
      modeEnd: (() => { const bar = document.querySelector('.la-bar');
                        return !!(bar && bar.lastElementChild.classList.contains('la-mode')); })(),
      kpis:   [...document.querySelectorAll('.lab-akpis .lh-k')].map(x => x.textContent),
      legend: [...document.querySelectorAll('.la-legend .la-lg')].map(x => x.textContent),
      rows:   [...document.querySelectorAll('.la-row')].map(r => ({
                name: r.querySelector('.la-gan-top b').textContent,
                age:  (r.querySelector('.la-gan-meta').textContent.match(/גיל (\d)/) || [])[1],
                ink:  getComputedStyle(r).borderInlineStartColor })),
      /* הטור שבצד — שלושת הלוחות */
      aside:  [...document.querySelectorAll('.la-aside .la-panel-t')].map(x => x.textContent),
      pool:   document.querySelectorAll('.la-prow').length,
      /* "בחירת גן לשיבוץ" והכותרת הכפולה — מוסתרות, אך הבורר עדיין מחווט */
      pickHidden: !pick || getComputedStyle(pick).display === 'none',
      h3Hidden:   !h3   || getComputedStyle(h3).display === 'none',
      selWired:   !!(document.querySelector('#asgCtxSel') || {}).onchange,
    };
  });
  const ages = asg.rows.map(r => r.age);
  if (!/^שיבוץ אנשי צוות לגנים לפי הקשר · שנת /.test(asg.sub || ''))
    bad('תת־הכותרת של השיבוץ אינה לפי הלוח', ['התקבל: ' + asg.sub]);
  else if (!asg.subAfterTitle)
    bad('תת־הכותרת אינה יושבת מתחת לכותרת');
  else if ((asg.exp || '').trim() !== 'ייצוא')
    bad('"ייצוא" אינו בכותרת, או שנשאר "ייצוא / הדפסה"', ['התקבל: ' + asg.exp]);
  else if (asg.ctx.length !== 5)
    bad('רצועת ההקשרים אינה חמשת ההקשרים', [asg.ctx.join(' · ')]);
  else if (asg.modes.join(',') !== 'cards,list' || !asg.modeEnd)
    bad('בורר "כרטיסים | טבלה" אינו בקצה שורת ההקשרים', [asg.modes.join(' · ') + ' end=' + asg.modeEnd]);
  else if (asg.kpis.length !== 3)
    bad('אין שלוש משבצות מספרים', [asg.kpis.join(' · ')]);
  else if (asg.legend.join('|') !== 'מאויש|תקן פנוי|נעול עד לסף')
    bad('המקרא אינו שלושת המצבים', [asg.legend.join(' · ')]);
  else if (ages.join('') !== ages.slice().sort().join(''))
    bad('הגנים אינם ממוינים לפי גיל', [asg.rows.map(r => r.name + ' (' + r.age + ')').join(' · ')]);
  else if (new Set(asg.rows.map(r => r.ink)).size < 2)
    bad('אין צבע גיל סביב השורות', asg.rows.map(r => r.name + ' ' + r.ink));
  else if (asg.aside.join('|') !== 'זמינים לשיבוץ|🏖️ ימי חופש בגנים|חיפוש איש צוות|שיבוץ בכמה גנים')
    bad('הטור שבצד אינו ארבעת הלוחות', [asg.aside.join(' · ')]);
  else if (!asg.pool)
    bad('"זמינים לשיבוץ" ריק — הצוות שאינו משובץ אינו מגיע לטור');
  else if (!asg.pickHidden) bad('"בחירת גן לשיבוץ" עדיין מוצג');
  else if (!asg.h3Hidden)   bad('הכותרת הכפולה מעל הרשימה עדיין מוצגת');
  else if (!asg.selWired)   bad('בורר ההקשר איבד את החיווט');
  else ok('שיבוץ צוות: ' + asg.ctx.length + ' הקשרים, מקרא בן 3, סדר לפי גיל (' +
          ages.join(' · ') + '), ' + asg.pool + ' זמינים בטור');

  /* מצב "כרטיסים" — אותם קלפים, במסגרת צבע הגיל */
  const asgCards = await p.evaluate(async () => {
    const b = [...document.querySelectorAll('.la-modeb')].find(x => x.dataset.mode === 'cards');
    if (!b) return null;
    b.click();
    await new Promise(r => setTimeout(r, 500));
    return { cards: document.querySelectorAll('.la-card').length,
             rows:  document.querySelectorAll('.la-row').length,
             slots: document.querySelectorAll('.la-card .la-slot').length,
             inks:  new Set([...document.querySelectorAll('.la-card')]
                      .map(c => getComputedStyle(c).borderInlineStartColor)).size };
  });
  if (!asgCards)                bad('לא נמצא בורר "כרטיסים"');
  else if (!asgCards.cards || asgCards.rows)
    bad('מצב "כרטיסים" לא החליף את הרשימה', [JSON.stringify(asgCards)]);
  else if (!asgCards.slots)     bad('הכרטיסים ריקים מקלפי תקנים');
  else if (asgCards.inks < 2)   bad('אין צבע גיל סביב הכרטיסים');
  else ok('מצב "כרטיסים": ' + asgCards.cards + ' כרטיסים · ' + asgCards.slots +
          ' קלפי תקנים · ' + asgCards.inks + ' צבעי גיל');

  /* --- 11. תיק השיבוץ של איש/אשת צוות, החיפוש, וכלל השיבוץ הכפול ------- */
  await p.evaluate(SEED);
  await p.evaluate(() => {
    /* גן רביעי (רגיל) — כדי שיהיה גן פנוי לנסות לשבץ אליו מתוך התיק */
    DB.gans.push({ id:'g4', ganName:'גן התמר', active:true, education:'רגיל', age:'3',
      capacity:'30', assignCap:'28', teacherName:'', campus:'קמפוס מרכז', ganSymbol:'567893',
      address:'רבי עקיבא', building:'2', city:'מודיעין עילית' });
    /* m1 "גננת" בשני גנים — התנגשות אמיתית.
       m2 "סייעת משלימה" בשני גנים בימים זרים — משלימה, וזה תקין. */
    const N = (id, nm, extra) => Object.assign({ staffId:id, name:nm }, extra||{});
    DB.assignments = { 'תשפ"ז': { activity: {
      g1: { 'גננת': N('m1','ברקוביץ שרה'),
            'סייעת משלימה': N('m2','פישר נחמה', { days:['ראשון','שלישי'] }) },
      g2: { 'גננת': N('m1','ברקוביץ שרה'),
            'סייעת משלימה': N('m2','פישר נחמה', { days:['שני','רביעי'] }) } } } };
  });
  await goTab(p, 'assign'); await p.waitForTimeout(1200);

  const split = await p.evaluate(() => {
    const d = window.__uiLab.assignBoard();
    return { dup:   d.dupes.map(x => x.name + ' | ' + x.reason),
             multi: d.multi.map(x => x.name),
             red:   document.querySelectorAll('.la-aside button.la-note').length,
             calm:  !!document.querySelector('.la-panel-sub') };
  });
  if (split.dup.length !== 1 || !/ברקוביץ/.test(split.dup[0]))
    bad('התנגשות אמיתית אינה מזוהה', split.dup);
  else if (split.multi.join() !== 'פישר נחמה')
    bad('משלימה בימים זרים אינה "כמה גנים כדין"', [split.multi.join(' · ')]);
  else if (split.red !== 1)
    bad('מספר ההתראות האדומות שגוי — משלימה נצבעת אדום', ['' + split.red]);
  else if (!split.calm)
    bad('אין מקטע נפרד למי שמשובצת בכמה גנים כדין');
  else ok('שיבוץ בכמה גנים: אדום = ' + split.dup[0] + ' · כדין = ' + split.multi.join());

  /* חלון החיפוש — מדגם עם שורת "איפה משובצ/ת", וחיפוש חי */
  const search = await p.evaluate(async () => {
    const inp = document.querySelector('.la-findi');
    if (!inp) return null;
    const sample = document.querySelectorAll('.la-findlist .la-prow').length;
    const subs   = [...document.querySelectorAll('.la-findlist .la-pmeta')].map(x => x.textContent);
    inp.focus(); inp.value = 'ברקוביץ';
    inp.dispatchEvent(new Event('input', { bubbles:true }));
    await new Promise(r => setTimeout(r, 250));
    const rows = [...document.querySelectorAll('.la-findlist .la-prow')].map(r => ({
      name: r.querySelector('.la-pname').textContent,
      sub:  (r.querySelector('.la-pmeta') || {}).textContent }));
    return { sample, subs, rows, kept: document.activeElement === inp };
  });
  if (!search)                bad('אין שדה חיפוש איש צוות בטור שבצד');
  else if (!search.sample)    bad('רשימת המדגם ריקה');
  else if (!search.subs.some(x => /גן /.test(x)))
    bad('אין שורת משנה של המקום והתפקיד מתחת לשם', search.subs);
  else if (search.rows.length !== 1 || search.rows[0].name !== 'ברקוביץ שרה')
    bad('החיפוש לא צמצם לאיש הצוות המבוקש', [JSON.stringify(search.rows)]);
  else if (!/^גן .+ · גננת/.test(search.rows[0].sub))
    bad('שורת המשנה אינה "גן · תפקיד"', [search.rows[0].sub]);
  else if (!search.kept)      bad('הפוקוס אבד באמצע ההקלדה — אי אפשר להקליד שם שלם');
  else ok('חיפוש: מדגם ' + search.sample + ' → "ברקוביץ" → ' +
          search.rows[0].name + ' (' + search.rows[0].sub + ')');

  /* לחיצה על תוצאה פותחת את תיק השיבוץ */
  await p.evaluate(() => document.querySelector('.la-findlist .la-prow').click());
  await p.waitForTimeout(600);
  const asgFile = await p.evaluate(() => {
    const m = document.querySelector('#modal');
    if (!m) return null;
    return { title: (m.querySelector('h3') || {}).textContent.replace(/\s+/g, ' ').trim(),
             rows:  [...m.querySelectorAll('[data-i]')].map(b => b.querySelector('b').textContent),
             gans:  [...m.querySelectorAll('#sa-gan option')].map(o => o.textContent),
             ctxs:  m.querySelectorAll('#sa-ctx option').length };
  });
  if (!asgFile)                                 bad('לחיצה על תוצאת חיפוש לא פתחה חלון');
  else if (!/תיק שיבוץ — ברקוביץ שרה/.test(asgFile.title)) bad('נפתח חלון אחר', [asgFile.title]);
  else if (asgFile.rows.length !== 2)           bad('התיק אינו מציג את שני השיבוצים', asgFile.rows);
  else if (asgFile.ctxs !== 5)                  bad('אין חמישה הקשרים בהוספה', ['' + asgFile.ctxs]);
  /* ברקוביץ שרה — חינוך רגיל. גן שקד (ח"מ) לא אמור להיות מוצע לה. */
  else if (asgFile.gans.some(g => /שקד/.test(g)))
    bad('גן מחינוך אחר מוצע לשיבוץ', asgFile.gans);
  else ok('תיק השיבוץ: ' + asgFile.rows.join(' · ') + ' · ' +
          (asgFile.gans.length - 1) + ' גנים מוצעים (בלי ח"מ)');

  /* השיבוץ הכפול נחסם מתוך התיק */
  const guard = await p.evaluate(async () => {
    const pick = async (sel, test) => {
      const m = document.querySelector('#modal'), e = m.querySelector(sel);
      const o = [...e.options].find(x => test.test(x.textContent));
      if (!o) return false;
      e.value = o.value; e.dispatchEvent(new Event('change', { bubbles:true }));
      await new Promise(r => setTimeout(r, 250));
      return true;
    };
    if (!await pick('#sa-gan', /התמר/)) return { noGan:true };
    if (!await pick('#sa-role', /^גננת$/)) return { noRole:true };
    const m = document.querySelector('#modal');
    return { note: (m.querySelector('.note') || {}).textContent || '',
             disabled: (m.querySelector('#sa-add') || {}).disabled };
  });
  if (guard.noGan || guard.noRole)         bad('טופס ההוספה אינו נבנה', [JSON.stringify(guard)]);
  else if (!/שיבוץ כפול נחסם/.test(guard.note)) bad('שיבוץ כפול לא נחסם בתיק', [guard.note]);
  else if (!guard.disabled)                bad('"הוספה" פעיל למרות החסימה');
  else ok('שיבוץ כפול נחסם מתוך התיק');

  /* משלימה: מותרת בגן נוסף, והימים התפוסים נעולים; הוספה ושמירה נכתבות */
  await p.evaluate(() => closeModal()); await p.waitForTimeout(300);
  const comp = await p.evaluate(async () => {
    window.__uiLab.openStaffAssign('m2');          /* פישר נחמה — סייעת משלימה */
    await new Promise(r => setTimeout(r, 400));
    const pick = async (sel, test) => {
      const m = document.querySelector('#modal'), e = m.querySelector(sel);
      const o = [...e.options].find(x => test.test(x.textContent));
      if (!o) return false;
      e.value = o.value; e.dispatchEvent(new Event('change', { bubbles:true }));
      await new Promise(r => setTimeout(r, 250));
      return true;
    };
    if (!await pick('#sa-gan', /התמר/))         return { noGan:true };
    if (!await pick('#sa-role', /סייעת משלימה/)) return { noRole:true };
    let m = document.querySelector('#modal');
    const locked = [...m.querySelectorAll('.sa-day')].filter(c => c.disabled).map(c => c.value);
    const free   = [...m.querySelectorAll('.sa-day')].filter(c => !c.disabled).map(c => c.value);
    const note   = (m.querySelector('.note') || {}).textContent || '';
    const day = m.querySelector('.sa-day:not(:disabled)');
    if (day) day.click();
    m.querySelector('#sa-add').click();
    await new Promise(r => setTimeout(r, 300));
    m = document.querySelector('#modal');
    const listed = m.querySelectorAll('[data-i]').length;
    m.querySelector('#sa-save').click();
    /* נקרא מיד — save() מתזמן דחיפה מול המסד המדומה */
    const e4 = (DB.assignments['תשפ"ז'].activity.g4 || {})['סייעת משלימה'];
    return { locked, free, note, listed, day: day ? day.value : '',
             wrote: e4 ? { id:e4.staffId, days:e4.days || [] } : null };
  });
  if (comp.noGan || comp.noRole)   bad('טופס ההוספה של המשלימה אינו נבנה', [JSON.stringify(comp)]);
  else if (comp.note)              bad('משלימה נחסמה בטעות כשיבוץ כפול', [comp.note]);
  else if (comp.locked.join(',') !== 'ראשון,שני,שלישי,רביעי')
    bad('הימים התפוסים בגנים האחרים אינם נעולים', ['נעולים: ' + comp.locked.join(',')]);
  else if (comp.free.join(',') !== 'חמישי,שישי')
    bad('הימים הפנויים שגויים', ['פנויים: ' + comp.free.join(',')]);
  else if (comp.listed !== 3)      bad('ההוספה לא נכנסה לרשימת התיק', ['' + comp.listed]);
  else if (!comp.wrote)            bad('השמירה לא כתבה את השיבוץ החדש');
  else if (comp.wrote.id !== 'm2' || comp.wrote.days.join() !== comp.day)
    bad('נכתב שיבוץ שגוי', [JSON.stringify(comp.wrote)]);
  else ok('משלימה: ' + comp.locked.length + ' ימים נעולים, שובצה לגן שלישי ביום ' + comp.day);
  await p.waitForTimeout(400);

  /* --- 12. מסך המפה: כותרת, כרטיס סינון, חלון הגנים, רשימת הצד וכרטיסי הכלים --- */
  await p.evaluate(() => {
    /* בדיקת בורר השנה שקדמה החליפה את שנת העבודה — חוזרים לשנת הנתונים */
    DB.activeYear = 'תשפ"ז';
    /* מיקום ידני לכל הגנים ולכל התלמידות — כדי שהמפה תעבוד בלי גאוקוד ברשת */
    DB.gans.forEach((g, i) => { g.geo = { lat:31.930 + i * 0.0015, lng:35.041 + i * 0.0012, manual:true }; });
    DB.students.forEach((s, i) => { s.geo = { lat:31.9305 + i * 0.0008, lng:35.0425 - i * 0.0006, q:'x' }; });
  });
  await goTab(p, 'map'); await p.waitForTimeout(1800);

  const map = await p.evaluate(() => {
    const q = s => document.querySelector(s), t = e => e ? e.textContent.trim() : null;
    return {
      title:   t(q('.lab-maphead h2')),
      sub:     t(q('.lab-maphead #map-status')),
      acts:    [...document.querySelectorAll('.lab-maphead .lab-sacts > *')].map(b => b.textContent.trim()),
      applyGone: !!(q('#map-apply') && q('#map-apply').closest('.lab-hidden')),
      count:   t(q('.lab-mfcount')),
      eduGone: !!(q('#map-edu') && q('#map-edu').closest('.lab-hidden')),
      color:   !!q('.lab-mfsel #map-color'),
      city:    !!q('.lab-mfsel #map-city'),
      legend:  t(q('.lab-mflegend #map-legend-txt')),
      folds:   [...document.querySelectorAll('details.map-fold')].every(f => f.classList.contains('lab-hidden')),
      tools:   [...document.querySelectorAll('.lab-mtool')].map(d => ({
                 t:t(d.querySelector('.lab-mt-t')), has:d.querySelector('.lab-mt-b').children.length })),
      sideTitle: t(q('#map-side .map-side-title')),
      kidSub:  (q('#map-side .map-side-kid') || {}).dataset ? q('#map-side .map-side-kid').dataset.sub : null,
      dot:     q('#map-side .map-side-kid') ? getComputedStyle(q('#map-side .map-side-kid'), '::before').width : ''
    };
  });
  if (map.title !== 'מפת שיבוץ')      bad('כותרת המפה אינה כשל הלוח', ['התקבל: ' + map.title]);
  else if (!/גנים/.test(map.sub || ''))
    bad('שורת המצב של התוכנה אינה יושבת מתחת לכותרת', ['התקבל: ' + map.sub]);
  else if (map.acts.join(' | ') !== '🔄 רענון מיקומים | ⛶ מסך מלא | ⚡ שיבוץ אוטומטי לפי קרבה')
    bad('שלושת כפתורי הכותרת אינם בסדר של הלוח', [map.acts.join(' | ')]);
  else if (!map.applyGone)            bad('"הצג על המפה" עדיין מוצג — בלוח אין כפתור כזה');
  else if (!map.eduGone)              bad('בורר החינוך של המפה לא ירד מהמסך');
  else if (!map.city || !map.color)   bad('בוררי העיר וצבע התלמידות אינם בכרטיס הסינון');
  else if (!map.legend)               bad('המקרא של צבע התלמידות אינו מתחת לבורר');
  else if (!/גנים נבחרו מתוך/.test(map.count || ''))
    bad('מונה הגנים שנבחרו אינו מוצג ליד "גנים להצגה"', ['התקבל: ' + map.count]);
  else if (!map.folds)                bad('המקטעים המתקפלים של התוכנה לא הוסתרו');
  else if (map.tools.length !== 3 || map.tools.some(x => !x.has))
    bad('שלושת כרטיסי הכלים אינם מכילים את הפקדים', [JSON.stringify(map.tools)]);
  else if (!/^רשומות \(\d+\/\d+ על המפה\)$/.test(map.sideTitle || ''))
    bad('כותרת רשימת הצד אינה זו שבתוכנה', ['התקבל: ' + map.sideTitle]);
  else if (!/·/.test(map.kidSub || ''))
    bad('שורת התלמידה ברשימת הצד בלי כתובת ומרחק', ['התקבל: ' + map.kidSub]);
  else ok('מפה: כותרת + שורת מצב, 3 כפתורים, ' + map.count + ', כלים בשלושה כרטיסים, "' + map.kidSub + '"');

  /* חלון בחירת הגנים — מארח את הבורר של התוכנה, מעדכן מונה, וסוגר בחזרה */
  await p.evaluate(() => document.querySelector('.lab-mfpick').click());
  await p.waitForTimeout(400);
  const pick = await p.evaluate(() => {
    const ov = document.querySelector('.lab-pickov');
    if (!ov) return null;
    const before = ov.querySelector('.lab-pick-c').textContent;
    const cb = ov.querySelector('input[data-gid]');
    const name = cb.closest('label').textContent.trim();
    cb.click();
    return { before, name,
      camps: [...ov.querySelectorAll('input[data-camp]')].length,
      gans:  [...ov.querySelectorAll('input[data-gid]')].length,
      hosts: !!ov.querySelector('#map-gan-list') };
  });
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => {
    const c = document.querySelector('.lab-pick-c').textContent;
    document.querySelector('.lab-pick-ok').click();
    return c;
  });
  await p.waitForTimeout(700);
  const back = await p.evaluate(() => ({
    open:  !!document.querySelector('.lab-pickov'),
    held:  !!document.querySelector('.lab-mfhold #map-gan-list'),
    count: document.querySelector('.lab-mfcount').textContent
  }));
  if (!pick)             bad('חלון בחירת הגנים לא נפתח');
  else if (!pick.hosts)  bad('החלון אינו מארח את בורר הגנים של התוכנה (שוכפל במקום להיות מועבר)');
  else if (pick.camps < 2 || pick.gans < 3)
    bad('החלון אינו מציג את הגנים לפי קמפוסים', [JSON.stringify(pick)]);
  else if (pick.before === after)
    bad('ביטול סימון של גן לא עדכן את המונה שבחלון', ['לפני ואחרי: ' + after]);
  else if (back.open)    bad('"סיום" לא סגר את החלון');
  else if (!back.held)   bad('בורר הגנים לא חזר למחסן שבכרטיס הסינון');
  else if (back.count !== after)
    bad('המונה שליד "גנים להצגה" לא התעדכן אחרי הסגירה', [back.count + ' ≠ ' + after]);
  else ok('חלון הגנים: ' + pick.camps + ' קמפוסים · ' + pick.gans + ' גנים · ' + pick.before + ' ← ' + after);

  /* השיבוץ האוטומטי: בוחרים גנים בתוך החלון, והמאגר כולל מי שאין לה גן */
  await p.evaluate(() => { document.querySelector('#map-gan-all').click(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#map-auto').click());
  await p.waitForTimeout(600);
  const aa = await p.evaluate(() => {
    const m = document.querySelector('#modal');
    if (!m || !m.querySelector('#aa-ganlist')) return null;
    return {
      camps: [...m.querySelectorAll('input[data-aacamp]')].length,
      gans:  [...m.querySelectorAll('input[data-aagan]')].length,
      on:    [...m.querySelectorAll('input[data-aagan]')].filter(c => c.checked).length,
      cnt:   (m.querySelector('#aa-gancnt') || {}).textContent,
      out:   (m.querySelector('#aa-out') || {}).textContent || '',
      apply: !m.querySelector('#aa-apply').disabled
    };
  });
  if (!aa)                bad('חלון השיבוץ האוטומטי נפתח בלי בורר גנים');
  else if (aa.camps < 2 || aa.gans < 3)
    bad('בורר הגנים שבחלון אינו מקובץ לפי קמפוסים', [JSON.stringify(aa)]);
  else if (!/נבחרו מתוך/.test(aa.cnt || ''))
    bad('אין מונה לגנים שנבחרו בחלון', ['התקבל: ' + aa.cnt]);
  else if (!/נבדקו 2 תלמידות/.test(aa.out))
    bad('המאגר אינו כולל את מי שאין לה גן כלל', [aa.out.slice(0, 160)]);
  else if (!aa.apply)     bad('"ביצוע השיבוץ" נשאר מנוטרל אף שיש תוכנית');
  else ok('שיבוץ אוטומטי: ' + aa.on + '/' + aa.gans + ' גנים נבחרים · ' + aa.cnt + ' · שתי הבלתי משובצות נכנסו למאגר');
  await p.evaluate(() => closeModal()); await p.waitForTimeout(300);

  /* --- 13. מסך התלמידות בטלפון: הטבלה נראית ואינה נחתכת ----------------- */
  /* ‎.stu-stage‎ הופך לעמודה מתחת ל-1100px (טלפון, וגם "מצב מחשב" בטלפון,
     שרוחב הפריסה שלו כ-980). אז ‎flex:1 1 0‎ של ‎.lab-tablecard‎ נקרא כגובה
     בסיס 0, ו-‎overflow:hidden‎ הסתיר את כל רשימת התלמידות — מסך ריק. */
  for (const W of [390, 980]) {
    await p.setViewportSize({ width: W, height: 850 });
    await goTab(p, 'students'); await p.waitForTimeout(800);
    const m = await p.evaluate(() => {
      const card = document.querySelector('.stu-stage > .lab-tablecard');
      const tbl  = document.querySelector('#stuTable .stu-table');
      if (!card || !tbl) return { card: !!card, tbl: !!tbl };
      const c = card.getBoundingClientRect(), t = tbl.getBoundingClientRect();
      return { card:true, tbl:true, dir:getComputedStyle(document.querySelector('.stu-stage')).flexDirection,
               cardH:Math.round(c.height), tblH:Math.round(t.height),
               clipped: t.bottom > c.bottom + 1, rows: document.querySelectorAll('#stuTable tbody tr').length };
    });
    if (!m.card || !m.tbl)   bad('ברוחב ' + W + ' לא נמצאו כרטיס הטבלה או הטבלה');
    else if (m.dir !== 'column') bad('ברוחב ' + W + ' הבמה אינה בפריסת עמודה', ['flex-direction=' + m.dir]);
    else if (m.cardH < 200 || m.clipped)
      bad('ברוחב ' + W + ' רשימת התלמידות נחתכת — המסך נראה ריק',
          ['גובה הכרטיס ' + m.cardH + ' · גובה הטבלה ' + m.tblH]);
    else ok('תלמידות ברוחב ' + W + ': הכרטיס ' + m.cardH + 'px, ' + m.rows + ' שורות גלויות');
  }
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(400);

  const real = errs.filter(e => !/Failed to load resource|net::ERR_/.test(e));
  if (real.length) bad(real.length + ' שגיאות JS בזמן הבדיקה', real.slice(0, 4));
  else ok('אף שגיאת JS לא נזרקה');

  console.log('============================================');
  console.log(fail ? ('תוצאה: ' + fail + ' נכשלו') : 'תוצאה: כל מסכי המעבדה עברו ✅');
  await browser.close(); server.close();
  process.exit(fail ? 1 : 0);
})();
