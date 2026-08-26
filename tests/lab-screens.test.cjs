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
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, closeModal });
window.__ready=true;
`;
  const i = html.lastIndexOf('</script>');
  return html.slice(0, i) + expose + html.slice(i);
}

fs.writeFileSync(path.join(TMP, 'noop.js'), 'window.L=window.L||{};');
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
  await p.evaluate(() => { const b = document.querySelector('#importUpdate'); if (b) b.click(); });
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
  else if (st.acts.join(',') !== 'staffMsg,impStaff,labStaffExp,addStaff')
    bad('סדר כפתורי הפעולה אינו: שליחת הודעות · ייבוא · ייצוא · הוספה', [st.acts.join(' · ')]);
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

  /* --- 8. בורר השנה: לא ברצועה העליונה, אלא ראשון בהגדרות --------------- */
  await p.evaluate(() => { DB.years = ['תשפ"ז', 'תשפ"ח']; route(); });
  await goTab(p, 'settings'); await p.waitForTimeout(900);
  const yr = await p.evaluate(() => {
    const col   = document.querySelector('.lab-setcol');
    const first = col && col.firstElementChild;
    const toc   = [...document.querySelectorAll('.lab-toc .lab-toci')].map(a => a.textContent.trim());
    return {
      inTop:   !!document.querySelector('header.top .lab-yearpick, header.top #yearSelect'),
      inTopChips: !!document.querySelector('.top-chips #yearSelect'),
      realHome: (document.getElementById('yearSelect') || {}).parentElement
                  ? document.getElementById('yearSelect').parentElement.className : null,
      firstPanel: first ? (first.dataset.lab || (first.querySelector('h2,h3') || {}).textContent) : null,
      firstToc: toc[0] || null,
      opts: [...document.querySelectorAll('.lab-yearsel option')].map(o => o.textContent),
      value: (document.querySelector('.lab-yearsel') || {}).value
    };
  });
  if (yr.inTop || yr.inTopChips)
    bad('בורר השנה עדיין יושב ברצועה העליונה');
  else if (yr.realHome !== 'drawer-year')
    bad('ה-<select> המקורי אינו במגירה — הוא לא ישרוד בניית מסך מחדש', ['הורה: ' + yr.realHome]);
  else if (yr.firstPanel !== 'year')
    bad('פאנל "שנת עבודה" אינו הראשון בהגדרות', ['ראשון: ' + yr.firstPanel]);
  else if (yr.firstToc !== 'שנת עבודה')
    bad('"שנת עבודה" אינו הפריט הראשון ברשימת ההגדרות', ['ראשון: ' + yr.firstToc]);
  else if (yr.opts.join(',') !== 'תשפ"ז,תשפ"ח' || yr.value !== 'תשפ"ז')
    bad('הבורר שבהגדרות אינו משקף את רשימת השנים', ['אפשרויות: ' + yr.opts.join(' · ') + ' · נבחר: ' + yr.value]);
  else ok('בורר השנה ירד מהרצועה העליונה ופותח את מסך ההגדרות (' + yr.opts.join(' · ') + ')');

  /* הבחירה עצמה — חייבת להזיז את DB.activeYear דרך המאזין המקורי */
  const sw = await p.evaluate(async () => {
    const sel = document.querySelector('.lab-yearsel');
    if (!sel) return null;
    sel.value = 'תשפ"ח';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    return { active: DB.activeYear,
             real: (document.getElementById('yearSelect') || {}).value,
             again: (document.querySelector('.lab-yearsel') || {}).value };
  });
  if (!sw)                       bad('הבורר שבהגדרות לא נמצא');
  else if (sw.active !== 'תשפ"ח') bad('בחירת שנה בהגדרות לא שינתה את שנת העבודה', ['DB.activeYear=' + sw.active]);
  else if (sw.real !== 'תשפ"ח')   bad('ה-<select> המקורי לא סונכרן', ['ערך=' + sw.real]);
  else if (sw.again !== 'תשפ"ח')  bad('הבורר לא נבנה מחדש עם השנה החדשה', ['ערך=' + sw.again]);
  else ok('בחירת שנה בהגדרות מחליפה את שנת העבודה (תשפ"ז ← תשפ"ח) והמסך נבנה מחדש');
  await p.evaluate(() => { DB.activeYear = 'תשפ"ז'; DB.years = ['תשפ"ז']; route(); });
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

  const real = errs.filter(e => !/Failed to load resource|net::ERR_/.test(e));
  if (real.length) bad(real.length + ' שגיאות JS בזמן הבדיקה', real.slice(0, 4));
  else ok('אף שגיאת JS לא נזרקה');

  console.log('============================================');
  console.log(fail ? ('תוצאה: ' + fail + ' נכשלו') : 'תוצאה: כל מסכי המעבדה עברו ✅');
  await browser.close(); server.close();
  process.exit(fail ? 1 : 0);
})();
