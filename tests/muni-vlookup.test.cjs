/* ============================================================================
   רשימת העירייה — עדכון לפי ת"ז: בדיקת דפדפן
   ----------------------------------------------------------------------------
     1. מיפוי עמודות — כותרת מוכרת מזוהה ומסומנת לבד, כותרת זרה נשארת כבויה.
     2. עמודה שלא סומנה אינה נקלטת, גם כשהכותרת שלה מוכרת.
     3. השלמת הפרטים החסרים בתיק — ומה שכבר קיים בתוכנה אינו נדרס.
     4. טלפון שכבר מופיע בשדה אחר של אותה ילדה לא נכתב שוב.
     5. ת"ז שאינה בתוכנה — נפתח לה תיק חדש, והיא מדווחת בנפרד.
     6. כיבוי "פתיחת תיק חדש" — הת"ז מדווחת ולא נפתח תיק.
     7. סוג החינוך של ההעלאה נקבע לתיקים החדשים.
     8. סיכום לפי סמל מוסד + רשימת מי שבסמל אחר בעירייה ואצלנו.
     9. רשימת ת"ז נטו (בלי כותרות) ממשיכה לעבוד — סימון "קלוט" בלבד.
    10. אותו מקטע בדיוק עובד גם בעיצוב החדש (חלון "עדכון לפי מ.ז.").

   הרצה:  NODE_PATH=$(npm root -g) node tests/muni-vlookup.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('⏭️  דילוג: הבדיקה דורשת Playwright.'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PORT = 8759;
const TMP  = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-muni-'));

function buildApp() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/, '');
  html = html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g, '/__stub/fbstub.js');
  html = html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', '/__stub/noop.js');
  const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; else if(k==='currentUser')currentUser=v; else if(k==='db')db=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, navToTab, openBulkImport, closeModal, parseMuniInput, muniDetectColumns, phoneKey });
window.__ready=true;
`;
  const i = html.lastIndexOf('</script>');
  return html.slice(0, i) + expose + html.slice(i);
}
fs.writeFileSync(path.join(TMP, 'noop.js'), 'window.L={map(){return{setView(){return this},remove(){},on(){},off(){}}},tileLayer(){return{addTo(){}}},layerGroup(){return{addTo(){return this},clearLayers(){}}}};');
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

/* שני גנים עם סמלי מוסד, וארבע תלמידות במצבי מילוי שונים:
   s1 — תיק כמעט ריק, בגן 111111
   s2 — כבר יש לה שם אם וטלפון בית; הטלפון הזה הוא הנייד של האב בקובץ
   s3 — בגן 222222 (בעירייה היא תופיע ב-111111 — אי-התאמת סמל)
   s4 — לא בקובץ כלל (נספרת רק בסיכום הסמלים) */
const SEED = `(() => {
  DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
  DB.gans=[
    {id:'g1',ganName:'גן הדקל',ganSymbol:'111111',internalSymbol:'A1',campus:'קמפוס מרכז',education:'רגיל',age:'4',active:true},
    {id:'g2',ganName:'גן הרימון',ganSymbol:'222222',internalSymbol:'A2',campus:'קמפוס מרכז',education:'רגיל',age:'4',active:true}];
  const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
    docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
    dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
    street:'', building:'', city:'', absorbedMunicipality:false }, o);
  DB.students=[
    mk({id:'s1',tz:'300000001',firstName:'רחל',lastName:'כהן',ganId:'g1'}),
    mk({id:'s2',tz:'300000002',firstName:'שרה',lastName:'לוי',ganId:'g1',motherName:'מרים קיימת',phone:'0522222222',absorbedMunicipality:true}),
    mk({id:'s3',tz:'300000003',firstName:'לאה',lastName:'פרץ',ganId:'g2'}),
    mk({id:'s4',tz:'300000004',firstName:'חנה',lastName:'דוד',ganId:'g1'})];
  DB.staff=[]; DB.management=[]; DB.assignments={}; DB.tzGroups={}; DB.municipality={};
  DB.settings={ admins:['admin@test.org'] };
  __set('currentUser',{ email:'admin@test.org', uid:'u1' });
  __set('db', null); __set('eduPicked',true); __set('activeEdu',null);
  document.body.classList.remove('locked');
  return 'ok';
})()`;

/* קובץ העירייה כפי שהוא מגיע — עם עמודות שאינן מעניינות אותנו כלל
   ("מספר תיק", "סטטוס תשלום"), שאמורות להישאר לא מסומנות. */
const FILE = [
  'מספר תיק,מספר זהות,שם משפחה,שם פרטי,תאריך לידה,שם האם,שם האב,טלפון בית,נייד אב,נייד אם,דוא"ל,רחוב,מספר בניין,סמל מוסד,סטטוס תשלום',
  '9001,300000001,כהן,רחל,01/09/2021,ברכה,דוד,03-1111111,050-1111111,052-1111111,rachel@example.com,הרב קוק,12,111111,שולם',
  '9002,300000002,לוי,שרה,15/03/2021,מרים חדשה,אהרן,03-2222222,0522222222,053-2222222,sara@example.com,יפו,7,111111,שולם',
  '9003,300000003,פרץ,לאה,20/05/2021,אסתר,משה,03-3333333,050-3333333,052-3333333,leah@example.com,בן יהודה,3,111111,חוב',
  '9004,300000009,אדומי,מלכה,10/10/2021,פנינה,יצחק,03-9999999,050-9999999,052-9999999,malka@example.com,הנביאים,44,222222,שולם'
].join('\n');

let fail = 0;
const ok  = m => console.log('  ✅ ' + m);
const bad = (m, d) => { fail++; console.log('  ❌ ' + m); (d||[]).forEach(x => console.log('       ' + x)); };
const stu = (p, tz) => p.evaluate(t => { const s = DB.students.find(x => x.tz === t); return s ? JSON.parse(JSON.stringify(s)) : null; }, tz);

/* מילוי התיבה והרצת המיפוי מחדש */
async function load(p, text) {
  await p.evaluate(t => { const ta = document.querySelector('#muni-text'); ta.value = t; }, text);
  await p.evaluate(() => document.querySelector('#muni-detect').click());
  await p.waitForTimeout(200);
}
const mapRows = p => p.evaluate(() => [...document.querySelectorAll('#muni-map tbody tr')].map(tr => ({
  header: tr.children[1].textContent.trim(),
  on:     tr.querySelector('.muni-col-on').checked,
  field:  tr.querySelector('.muni-col-field').value })));
const stats = p => p.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#muni-result .stat')].map(c =>
    [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));
const run = async p => { await p.evaluate(() => document.querySelector('#muni-run').click()); await p.waitForTimeout(400); };

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:' + PORT + '/app.html', { waitUntil: 'load' });
  await p.waitForTimeout(1100);
  await p.evaluate(SEED);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(400);

  console.log('\n1. מיפוי עמודות');
  await load(p, FILE);
  const cols = await mapRows(p);
  cols.length === 15 ? ok('15 עמודות בטבלת המיפוי') : bad('מספר העמודות שגוי: ' + cols.length);
  const byHead = Object.fromEntries(cols.map(c => [c.header, c]));
  (byHead['מספר זהות'] && byHead['מספר זהות'].field === 'tz' && byHead['מספר זהות'].on)
    ? ok('"מספר זהות" זוהה ומסומן') : bad('עמודת הת"ז לא זוהתה', [JSON.stringify(byHead['מספר זהות'])]);
  (byHead['נייד אב'].field === 'dadMobile' && byHead['נייד אם'].field === 'momMobile')
    ? ok('נייד אב / נייד אם הופרדו נכון') : bad('הפרדת הניידים נכשלה');
  (!byHead['מספר תיק'].on && byHead['מספר תיק'].field === ''
   && !byHead['סטטוס תשלום'].on && byHead['סטטוס תשלום'].field === '')
    ? ok('עמודות זרות נשארו כבויות') : bad('עמודה זרה סומנה בטעות');

  console.log('\n2. עמודה שלא סומנה אינה נקלטת');
  /* מכבים את "דוא"ל" ידנית — היא מוכרת, אבל המשתמש לא רוצה אותה */
  await p.evaluate(() => {
    const tr = [...document.querySelectorAll('#muni-map tbody tr')].find(x => x.children[1].textContent.trim() === 'דוא"ל');
    tr.querySelector('.muni-col-on').checked = false;
  });
  await run(p);
  const s1 = await stu(p, '300000001');
  s1.email === '' ? ok('דוא"ל לא נקלט — העמודה לא סומנה') : bad('הדוא"ל נקלט למרות שלא סומן: ' + s1.email);

  console.log('\n3. השלמת פרטים חסרים');
  (s1.dob === '2021-09-01' && s1.motherName === 'ברכה' && s1.fatherName === 'דוד'
   && s1.street === 'הרב קוק' && s1.building === '12')
    ? ok('תאריך לידה · שם אם · שם אב · רחוב · בניין הושלמו')
    : bad('ההשלמה חלקית', [JSON.stringify({dob:s1.dob,mom:s1.motherName,dad:s1.fatherName,st:s1.street,bl:s1.building})]);
  (s1.phone === '03-1111111' && s1.dadMobile === '050-1111111' && s1.momMobile === '052-1111111')
    ? ok('שלושת הטלפונים נכנסו לשדות הנכונים')
    : bad('הטלפונים שגויים', [JSON.stringify({p:s1.phone,d:s1.dadMobile,m:s1.momMobile})]);
  s1.absorbedMunicipality ? ok('סומנה קלוט בעירייה') : bad('לא סומנה קלוט');

  const s2 = await stu(p, '300000002');
  (s2.motherName === 'מרים קיימת' && s2.phone === '0522222222')
    ? ok('ערכים קיימים בתוכנה לא נדרסו')
    : bad('ערך קיים נדרס', [JSON.stringify({mom:s2.motherName,phone:s2.phone})]);

  console.log('\n4. טלפון שכבר מופיע בשדה אחר');
  /* בקובץ 0522222222 הוא נייד האב; אצלנו הוא כבר יושב בטלפון הבית */
  s2.dadMobile === '' ? ok('נייד האב לא נכתב — המספר כבר קיים בטלפון הבית')
                      : bad('המספר נכתב פעמיים: ' + s2.dadMobile);
  s2.momMobile === '053-2222222' ? ok('נייד האם — מספר חדש — כן נכתב') : bad('נייד האם לא נכתב: ' + s2.momMobile);
  const st1 = await stats(p);
  st1['טלפונים שדולגו (כבר קיימים)'] === 1 ? ok('הסיכום מדווח על טלפון אחד שדולג')
                                            : bad('מונה הדילוג שגוי: ' + st1['טלפונים שדולגו (כבר קיימים)']);

  console.log('\n5. ת"ז חדשה — נפתח תיק ומדווחת בנפרד');
  st1['תיקים חדשים שנפתחו'] === 1 ? ok('נפתח תיק חדש אחד') : bad('מונה התיקים החדשים שגוי: ' + st1['תיקים חדשים שנפתחו']);
  st1['תיקים שעודכנו בהם פרטים'] === 3 ? ok('3 תיקים קיימים עודכנו') : bad('מונה העדכון שגוי: ' + st1['תיקים שעודכנו בהם פרטים']);
  const s9 = await stu(p, '300000009');
  (s9 && s9.firstName === 'מלכה' && s9.lastName === 'אדומי' && s9.dob === '2021-10-10'
   && s9.absorbedMunicipality && s9.registeredByUs === false)
    ? ok('התיק החדש נפתח עם הפרטים מהקובץ') : bad('התיק החדש חסר', [JSON.stringify(s9)]);
  const newList = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-new'); if (!b) return null;
    const tbl = b.parentElement.querySelector('tbody');
    return [...tbl.querySelectorAll('tr')].map(tr => tr.children[1].textContent.trim()); });
  (newList && newList.length === 1 && newList[0] === '300000009')
    ? ok('הרשימה הנפרדת של החדשות מוצגת') : bad('רשימת החדשות שגויה', [JSON.stringify(newList)]);
  s9.ganId === '' ? ok('התיק החדש לא שובץ לגן (הסימון כבוי)') : bad('שובץ בטעות לגן ' + s9.ganId);

  console.log('\n6. כיבוי "פתיחת תיק חדש"');
  await p.evaluate(() => { DB.students = DB.students.filter(s => s.tz !== '300000009'); });
  await p.evaluate(() => { document.querySelector('#muni-create').checked = false; });
  await run(p);
  const gone = await stu(p, '300000009');
  !gone ? ok('לא נפתח תיק כשהסימון כבוי') : bad('נפתח תיק למרות שהסימון כבוי');
  const nfShown = await p.evaluate(() => !!document.querySelector('#muni-dl-nf'));
  nfShown ? ok('הת"ז שלא נמצאה מדווחת עם כפתור הורדה') : bad('הדיווח על הלא-נמצאות חסר');

  console.log('\n7. סוג החינוך של ההעלאה');
  await p.evaluate(() => { document.querySelector('#muni-create').checked = true;
    document.querySelector('#muni-edu').value = 'ח"מ'; });
  await run(p);
  const s9b = await stu(p, '300000009');
  s9b && s9b.education === 'ח"מ' ? ok('התיק החדש נפתח בחינוך מיוחד, לפי הבורר')
                                 : bad('סוג החינוך שגוי: ' + (s9b && s9b.education));

  console.log('\n8. סיכום לפי סמל מוסד');
  const sym = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-sym'); if (!b) return null;
    return [...b.parentElement.querySelectorAll('tbody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim())); });
  const row111 = sym && sym.find(r => r[0] === '111111');
  const row222 = sym && sym.find(r => r[0] === '222222');
  (row111 && row111[1] === 'גן הדקל' && row111[2] === '3' && row111[3] === '3')
    ? ok('סמל 111111: 3 בעירייה · 3 בתוכנה') : bad('שורת 111111 שגויה', [JSON.stringify(row111)]);
  (row222 && row222[2] === '1' && row222[3] === '1')
    ? ok('סמל 222222: 1 בעירייה · 1 בתוכנה') : bad('שורת 222222 שגויה', [JSON.stringify(row222)]);
  const diff = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-diff'); if (!b) return null;
    return [...b.parentElement.querySelectorAll('tbody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim())); });
  (diff && diff.length === 1 && diff[0][1] === '300000003' && diff[0][2] === '111111' && diff[0][4] === '222222')
    ? ok('לאה פרץ: בעירייה 111111, אצלנו 222222') : bad('רשימת ההפרשים שגויה', [JSON.stringify(diff)]);

  console.log('\n9. רשימת ת"ז נטו — בלי כותרות');
  await load(p, '300000001\n300000003');
  await run(p);
  const st2 = await stats(p);
  (st2['ברשימת העירייה'] === 2 && st2['תיקים שעודכנו בהם פרטים'] === 0)
    ? ok('רשימה נטו מסמנת בלי להשלים פרטים') : bad('רשימה נטו נכשלה', [JSON.stringify(st2)]);

  console.log('\n10. אותו מקטע בעיצוב החדש');
  const p2 = await ctx.newPage();
  const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
  await p2.goto('http://127.0.0.1:' + PORT + '/app.html?ui=new', { waitUntil: 'load' });
  await p2.waitForTimeout(1200);
  await p2.evaluate(SEED);
  await p2.evaluate(() => navToTab('students'));
  await p2.waitForTimeout(500);
  await p2.evaluate(() => openBulkImport());
  await p2.waitForTimeout(400);
  const inLab = await p2.evaluate(() => !!document.querySelector('#modal #muni-map') && !!document.querySelector('#modal #muni-run'));
  inLab ? ok('המקטע יושב בחלון "עדכון לפי מ.ז." של העיצוב החדש') : bad('המקטע לא נמצא בעיצוב החדש');
  if (inLab) {
    await p2.evaluate(t => { document.querySelector('#modal #muni-text').value = t; }, FILE);
    await p2.evaluate(() => document.querySelector('#modal #muni-detect').click());
    await p2.waitForTimeout(200);
    await p2.evaluate(() => document.querySelector('#modal #muni-run').click());
    await p2.waitForTimeout(400);
    const labS1 = await stu(p2, '300000001');
    (labS1.motherName === 'ברכה' && labS1.email === 'rachel@example.com')
      ? ok('ההשלמה עובדת גם בעיצוב החדש') : bad('ההשלמה נכשלה בעיצוב החדש', [JSON.stringify(labS1)]);
  }
  errs2.length ? bad('שגיאות בעמוד העיצוב החדש', errs2) : ok('אין שגיאות JavaScript בעיצוב החדש');

  if (!errs.length) ok('אין שגיאות JavaScript'); else bad('שגיאות בעמוד', errs);
  await browser.close(); server.close();
  console.log('\n' + '─'.repeat(52));
  console.log(fail ? `❌ ${fail} בדיקות נכשלו` : '✅ כל הבדיקות עברו');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
