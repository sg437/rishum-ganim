/* ============================================================================
   רשימת העירייה — עדכון לפי ת"ז: בדיקת דפדפן
   ----------------------------------------------------------------------------
     1. מיפוי עמודות — כותרת מוכרת מזוהה ומסומנת לבד, כותרת זרה נשארת כבויה.
     2. עמודה שלא סומנה אינה נקלטת, גם כשהכותרת שלה מוכרת.
     3. השלמת הפרטים החסרים בתיק (כולל שם משפחה) — ומה שקיים אינו נדרס.
     4. טלפון שכבר מופיע בשדה אחר של אותה ילדה לא נכתב שוב.
     5. ת"ז שאינה בתוכנה — נפתח לה תיק חדש, בלי שיבוץ לגן לפי הסמל.
     6. כיבוי "פתיחת תיק חדש" — הת"ז מדווחת ולא נפתח תיק.
     7. סוג החינוך של ההעלאה נקבע לתיקים החדשים.
     8. סיכום לפי סמל מוסד + רשימת מי שבסמל אחר בעירייה ואצלנו.
     8ב. מצב "השוואה בלבד" — סיכום הסמלים בלי לגעת בנתונים.
     8ג. הורדות: אצלנו+בעירייה · רק אצלנו · שיתוף.
     9. רשימת ת"ז נטו (בלי כותרות) ממשיכה לעבוד — סימון "קלוט" בלבד.
    10. אותו מקטע בדיוק עובד גם בעיצוב החדש (חלון "עדכון לפי מ.ז.").
    11. קובץ xlsx אמיתי נקרא כטבלה — ולא נשפך כג'יבריש לתיבה.
    12. ת"ז שאיבדה אפס מוביל באקסל עדיין מתאימה לתיק שבתוכנה.
    13. קובץ בינארי שאינו גיליון נעצר בהודעה, בלי לזהם את התיבה.
    14. קובץ xls ישן (BIFF8 אמיתי) נקרא כטבלה.
    15. מחרוזת שנחתכת בין רשומות CONTINUE נקראת שלמה.
    16. שתי עמודות דוא"ל בקובץ מתמזגות לשדה אחד — הראשון שאינו ריק.

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
Object.assign(window,{ route, navToTab, openBulkImport, closeModal, parseMuniInput, muniDetectColumns, phoneKey, tzKey, xlsxToRows, xlsToRows, biffStrReader, readFileSmart });
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
    mk({id:'s3',tz:'300000003',firstName:'לאה',lastName:'',ganId:'g2'}),
    mk({id:'s4',tz:'300000004',firstName:'חנה',lastName:'דוד',ganId:'g1'}),
    mk({id:'s5',tz:'012345678',firstName:'מרים',lastName:'גולד',ganId:'g2'})];
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


/* קובץ xls אמיתי בפורמט BIFF8 (נוצר בכלי חיצוני, לא על ידי התוכנה), עם
   עברית, מחרוזות משותפות, מספרים ו-MULRK — הפורמט שהעירייה שולחת. */
const XLS_B64 = [
  '0M8R4KGxGuEAAAAAAAAAAAAAAAAAAAAAPgADAP7/CQAGAAAAAAAAAAAAAAABAAAACQAAAAAAAAAAEAAA/v///wAAAAD+////AAAA',
  'AAgAAAD/////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '//////////////////////////////////////////////////////////////////////////////////8JCBAAAAYFALsNzAcA',
  'AAAABgAAAOEAAgCwBMEAAgAAAOIAAABcAHAATm9uZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg',
  'ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEIAAgCwBGEBAgAA',
  'AD0BAgABAJwAAgAOABkAAgAAABIAAgAAAGMAAgAAABMAAgAAAK8BAgAAALwBAgAAAEAAAgAAAI0AAgAAAD0AEgDgAVoAzz9OKjgA',
  'AAAAAAEAWAIiAAIAAAAOAAIAAQC3AQIAAADaAAIAAAAxABUAyAAAAP9/kAEAAAAAAQAFAEFyaWFsMQAVAMgAAAD/f5ABAAAAAAEA',
  'BQBBcmlhbDEAFQDIAAAA/3+QAQAAAAABAAUAQXJpYWwxABUAyAAAAP9/kAEAAAAAAQAFAEFyaWFsMQAVAMgAAAD/f5ABAAAAAAEA',
  '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',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAP7////9/////v//////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '//////////////////////////9SAG8AbwB0ACAARQBuAHQAcgB5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAFgAFAf//////////AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP7///8AAAAAAAAAAFcA',
  'bwByAGsAYgBvAG8AawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAIB////////////',
  '////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH///////////////8AAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAD+////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAf///////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP7///8A',
  'AAAAAAAAAA==',
].join('');

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
  const opts = await p.evaluate(() => [...document.querySelector('#muni-map .muni-col-field').options].map(o => o.textContent.trim()));
  (opts.indexOf('שם משפחה') > opts.indexOf('שם האב') && opts.indexOf('שם האב') > opts.indexOf('שם האם'))
    ? ok('"שם משפחה" יושב אחרי שמות ההורים') : bad('סדר השדות שגוי', [JSON.stringify(opts)]);
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

  const s3 = await stu(p, '300000003');
  s3.lastName === 'פרץ' ? ok('שם משפחה חסר הושלם מהרשימה') : bad('שם המשפחה לא הושלם: ' + s3.lastName);
  const s1keep = await stu(p, '300000001');
  s1keep.lastName === 'כהן' ? ok('שם משפחה קיים נשאר כשהיה') : bad('שם המשפחה נדרס: ' + s1keep.lastName);

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
  s9.ganId === '' ? ok('התיק החדש לא שובץ לגן — הסמל אינו משבץ') : bad('שובץ בטעות לגן ' + s9.ganId);
  const noAssignBox = await p.evaluate(() => !!document.querySelector('#muni-assign'));
  !noAssignBox ? ok('אין בכלל אפשרות לשבץ לפי סמל מהעירייה') : bad('נשארה אפשרות שיבוץ לפי סמל');

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
    ? ok('סמל 111111: 3 בתוכנה · 3 בעירייה') : bad('שורת 111111 שגויה', [JSON.stringify(row111)]);
  /* בתוכנה: לאה ומרים, שתיהן בגן הרימון. בעירייה: מלכה בלבד. */
  (row222 && row222[2] === '2' && row222[3] === '1' && row222[4] === '+1')
    ? ok('סמל 222222: 2 בתוכנה · 1 בעירייה · הפרש +1') : bad('שורת 222222 שגויה', [JSON.stringify(row222)]);
  const diff = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-diff'); if (!b) return null;
    return [...b.closest('div[style]').parentElement.querySelectorAll('tbody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim())); });
  (diff && diff.length === 1 && diff[0][1] === '300000003' && diff[0][2] === '222222' && diff[0][4] === '111111')
    ? ok('לאה פרץ: אצלנו 222222, בעירייה 111111') : bad('רשימת ההפרשים שגויה', [JSON.stringify(diff)]);
  const dlBtns = await p.evaluate(() => ['muni-dl-diff','muni-dl-diff-ours','muni-share-diff','muni-dl-sym','muni-share-sym']
    .filter(id => !!document.querySelector('#' + id)));
  dlBtns.length === 5 ? ok('הורדה מלאה · הורדה "רק אצלנו" · שיתוף — לשתי הטבלאות')
                      : bad('חסרים כפתורי הורדה/שיתוף', [JSON.stringify(dlBtns)]);

  console.log('\n8ב. מצב "השוואה בלבד"');
  const snap = () => p.evaluate(() => JSON.stringify(DB.students.map(s =>
    [s.tz, s.ganId, s.motherName, s.phone, s.absorbedMunicipality]).sort()));
  const beforeCmp = await snap();
  await p.evaluate(() => { const m = document.querySelector('#muni-mode'); m.value = 'compare'; m.dispatchEvent(new Event('change')); });
  const hidden = await p.evaluate(() => ({
    edu: document.querySelector('#muni-edu-wrap').style.display,
    create: document.querySelector('#muni-create-wrap').style.display,
    btn: document.querySelector('#muni-run').textContent.trim() }));
  (hidden.edu === 'none' && hidden.create === 'none' && /סיכום לפי סמל/.test(hidden.btn))
    ? ok('בהשוואה: בורר החינוך ופתיחת התיקים יורדים, והכפתור משתנה')
    : bad('הפקדים לא הוסתרו', [JSON.stringify(hidden)]);
  /* קובץ ובו ת"ז + סמל בלבד — בדיוק מה שנדרש להשוואה */
  await load(p, ['מספר זהות,סמל מוסד', '300000001,111111', '300000003,111111', '300000004,222222'].join('\n'));
  await run(p);
  const afterCmp = await snap();
  afterCmp === beforeCmp ? ok('שום דבר בתוכנה לא השתנה') : bad('ההשוואה שינתה נתונים');
  const cmpSym = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-sym'); if (!b) return null;
    return [...b.parentElement.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())); });
  const c111 = cmpSym && cmpSym.find(r => r[0] === '111111');
  (c111 && c111[1] === 'גן הדקל' && c111[2] === '3' && c111[3] === '2')
    ? ok('סמל 111111: 3 בתוכנה · 2 בעירייה') : bad('סיכום ההשוואה שגוי', [JSON.stringify(cmpSym)]);
  const cmpDiff = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-diff'); if (!b) return null;
    return [...b.closest('div[style]').parentElement.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())); });
  /* לאה: אצלנו 222222, בעירייה 111111 · חנה: אצלנו 111111, בעירייה 222222 */
  (cmpDiff && cmpDiff.length === 2)
    ? ok('שתי אי-התאמות סמל אותרו') : bad('רשימת ההפרשים בהשוואה שגויה', [JSON.stringify(cmpDiff)]);
  await p.evaluate(() => { const m = document.querySelector('#muni-mode'); m.value = 'update'; m.dispatchEvent(new Event('change')); });

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

  console.log('\n11. קובץ xlsx אמיתי');
  /* בונים xlsx מינימלי בזיכרון (ZIP + XML) ומזינים אותו ל-readFileSmart
     כמו שהדפדפן מזין קובץ שנבחר. הת"ז של מרים נשמרת כמספר — ולכן היא
     מגיעה בלי האפס המוביל, בדיוק כמו באקסל אמיתי. */
  const XROWS = [
    ['מספר תיק','מספר זהות','שם משפחה','שם פרטי','שם האם','נייד אם','סמל מוסד'],
    ['9001','300000001','כהן','רחל','ברכה','052-1111111','111111'],
    ['9005','12345678','גולד','מרים','זהבה','054-5555555','222222'],
  ];
  await p.evaluate(() => { DB.students.forEach(s => { s.motherName=''; s.momMobile=''; s.absorbedMunicipality=false; }); });
  const xlsxText = await p.evaluate(async rows => {
    /* --- בניית xlsx: ZIP בלי דחיסה (method 0), עם CRC32 אמיתי --- */
    const enc = new TextEncoder();
    const tbl = (() => { const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = tbl[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const col = i => { let s = '', n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };
    const strings = []; const sidx = new Map();
    const sheetRows = rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
      const ref = col(ci) + (ri + 1);
      if (/^\d+$/.test(v)) return '<c r="' + ref + '"><v>' + v + '</v></c>';   // מספר — כך אקסל מאבד אפס מוביל
      if (!sidx.has(v)) { sidx.set(v, strings.length); strings.push(v); }
      return '<c r="' + ref + '" t="s"><v>' + sidx.get(v) + '</v></c>';
    }).join('') + '</row>').join('');
    const files = {
      '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
      'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="רשימת העירייה" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/sharedStrings.xml': '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + strings.length + '" uniqueCount="' + strings.length + '">' + strings.map(t => '<si><t>' + esc(t) + '</t></si>').join('') + '</sst>',
      'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + sheetRows + '</sheetData></worksheet>',
    };
    const locals = [], central = []; let off = 0;
    for (const name of Object.keys(files)) {
      const nb = enc.encode(name), db = enc.encode(files[name]), crc = crc32(db);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, db.length, true); lh.setUint32(22, db.length, true);
      lh.setUint16(26, nb.length, true);
      locals.push(new Uint8Array(lh.buffer), nb, db);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(6, 20, true); ch.setUint16(10, 0, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, db.length, true); ch.setUint32(24, db.length, true);
      ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + db.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true);
    eo.setUint16(8, Object.keys(files).length, true); eo.setUint16(10, Object.keys(files).length, true);
    eo.setUint32(12, cdSize, true); eo.setUint32(16, off, true);
    const blob = new Blob([...locals, ...central, new Uint8Array(eo.buffer)]);
    const file = new File([blob], 'muni.xlsx');
    return await new Promise(res => readFileSmart(file, txt => res(txt)));
  }, XROWS);
  /\uFFFD|PK/.test(xlsxText.slice(0, 40))
    ? bad('ה-xlsx עדיין נקרא כטקסט', [JSON.stringify(xlsxText.slice(0, 60))])
    : ok('ה-xlsx נקרא כטבלה, לא כג׳יבריש');
  xlsxText.split(/\r?\n/)[0] === 'מספר תיק,מספר זהות,שם משפחה,שם פרטי,שם האם,נייד אם,סמל מוסד'
    ? ok('שורת הכותרות נקראה מהגיליון') : bad('הכותרות שגויות', [xlsxText.split(/\r?\n/)[0]]);

  await load(p, xlsxText);
  const xcols = await mapRows(p);
  (xcols.length === 7 && xcols.filter(c => c.on).length === 6 && !xcols[0].on)
    ? ok('6 מתוך 7 עמודות זוהו; "מספר תיק" נשאר כבוי') : bad('המיפוי מה-xlsx שגוי', [JSON.stringify(xcols)]);
  await run(p);

  console.log('\n12. ת"ז שאיבדה אפס מוביל');
  const s5 = await stu(p, '012345678');
  (s5 && s5.motherName === 'זהבה' && s5.momMobile === '054-5555555' && s5.absorbedMunicipality)
    ? ok('"12345678" שבקובץ התאים ל-"012345678" שבתוכנה') : bad('ההתאמה לפי אפס מוביל נכשלה', [JSON.stringify(s5)]);
  const xst = await stats(p);
  xst['תיקים חדשים שנפתחו'] === 0 ? ok('לא נפתח תיק כפול למרים') : bad('נפתח תיק כפול', [JSON.stringify(xst)]);

  console.log('\n13. קובץ בינארי שאינו גיליון');
  const beforeTxt = await p.evaluate(() => document.querySelector('#muni-text').value);
  const kept = await p.evaluate(async () => {
    const f = new File([new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 1, 2, 3])], 'old.xls');
    let called = false;
    readFileSmart(f, () => { called = true; document.querySelector('#muni-text').value = 'זוהם'; });
    await new Promise(r => setTimeout(r, 300));
    return { called, text: document.querySelector('#muni-text').value };
  });
  (!kept.called && kept.text === beforeTxt)
    ? ok('קובץ פגום נעצר בהודעה, והתיבה לא זוהמה') : bad('הקובץ הבינארי נכנס לתיבה', [JSON.stringify(kept.called)]);

  console.log('\n14. קובץ xls ישן (BIFF8)');
  const xlsRes = await p.evaluate(async b64 => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const file = new File([u8], 'muni.xls');
    const text = await new Promise(res => { readFileSmart(file, t => res(t)); setTimeout(() => res(null), 3000); });
    const grid = xlsToRows(u8.buffer.slice(0));
    return { text, sheet: grid.sheetName, rows: grid.rows };
  }, XLS_B64);
  xlsRes.text ? ok('ה-xls נקרא ולא נחסם') : bad('ה-xls לא נקרא כלל');
  xlsRes.sheet === 'רשימת העירייה' ? ok('שם הגיליון בעברית נקרא נכון') : bad('שם הגיליון שגוי: ' + xlsRes.sheet);
  JSON.stringify(xlsRes.rows[0]) === JSON.stringify(['מספר תיק','מספר זהות','שם משפחה','שם פרטי','תאריך לידה','שם האם','נייד אם','סמל מוסד'])
    ? ok('שורת הכותרות נקראה מהגיליון') : bad('הכותרות שגויות', [JSON.stringify(xlsRes.rows[0])]);
  JSON.stringify(xlsRes.rows[1]) === JSON.stringify(['9001','300000001','כהן','רחל','01/09/2021','ברכה','052-1111111','111111'])
    ? ok('שורת נתונים מלאה — מחרוזות ומספרים') : bad('שורת הנתונים שגויה', [JSON.stringify(xlsRes.rows[1])]);
  (xlsRes.text || '').split(/\r?\n/).length === 4 ? ok('הומר ל-CSV בן 4 שורות') : bad('ההמרה ל-CSV שגויה');

  /* אותו קובץ, דרך המסך — כולל ת"ז שאיבדה אפס מוביל (12345678) */
  await p.evaluate(() => { DB.students.forEach(s => { s.motherName=''; s.momMobile=''; }); });
  await load(p, xlsRes.text);
  await run(p);
  const s5x = await stu(p, '012345678');
  (s5x && s5x.motherName === 'זהבה') ? ok('העדכון מהקובץ הישן הגיע לתיק') : bad('העדכון מה-xls לא נכנס', [JSON.stringify(s5x)]);

  console.log('\n15. מחרוזת חצויה בין רשומות CONTINUE');
  /* SST גדול נחתך לרשומות, ומחרוזת אחת נמשכת מעבר לגבול — ושם גם צורת
     הקידוד יכולה להשתנות. זו נקודת השבירה הקלאסית בקריאת xls. */
  const split = await p.evaluate(() => {
    const wide = s => { const a = []; for (const ch of s) a.push(ch.charCodeAt(0) & 0xFF, ch.charCodeAt(0) >> 8); return a; };
    const nar  = s => [...s].map(c => c.charCodeAt(0));
    /* א. עברית שנחתכת באמצע — שני החלקים בקידוד שני בייטים */
    const heb = biffStrReader([
      new Uint8Array([12, 0, 0x01, ...wide('שלוםעולם')]),   // cch=12, נגמר הבלוק אחרי 8 תווים
      new Uint8Array([0x01, ...wide('המשך')])               // grbit חדש, עדיין שני בייטים
    ]).str();
    /* ב. שינוי קידוד באמצע: הראש עברי (שני בייטים), הזנב לטיני (בייט אחד) */
    const mixed = biffStrReader([
      new Uint8Array([7, 0, 0x01, ...wide('שלום')]),
      new Uint8Array([0x00, ...nar('abc')])
    ]).str();
    return { heb, mixed };
  });
  split.heb === 'שלוםעולםהמשך'
    ? ok('מחרוזת עברית חצויה חוברה שלמה') : bad('חיבור ה-CONTINUE שגוי', [JSON.stringify(split.heb)]);
  split.mixed === 'שלוםabc'
    ? ok('שינוי קידוד באמצע המחרוזת טופל נכון') : bad('שינוי הקידוד שגוי', [JSON.stringify(split.mixed)]);

  console.log('\n16. שתי עמודות דוא"ל מתמזגות');
  /* כמו בקובץ העירייה: שתי עמודות דוא"ל. אצל רחל השנייה מלאה והראשונה
     ריקה; אצל לאה שתיהן מלאות — ואז גוברת הראשונה. */
  await p.evaluate(() => { DB.students.forEach(s => { s.email = ''; }); });
  const TWO_MAILS = [
    'מספר זהות,דוא"ל,מייל',
    '300000001,,rachel@example.com',
    '300000003,first@example.com,second@example.com',
  ].join('\n');
  await load(p, TWO_MAILS);
  const mailCols = await mapRows(p);
  (mailCols.length === 3 && mailCols[1].field === 'email' && mailCols[1].on
                         && mailCols[2].field === 'email' && mailCols[2].on)
    ? ok('שתי העמודות זוהו כדוא"ל ושתיהן מסומנות') : bad('הזיהוי הכפול נכשל', [JSON.stringify(mailCols)]);
  const mergeNote = await p.evaluate(() => (document.querySelector('#muni-merge-note') || {}).textContent || '');
  /2 עמודות מתמזגות/.test(mergeNote) ? ok('המסך מודיע שהעמודות מתמזגות') : bad('אין חיווי מיזוג', [mergeNote]);
  await run(p);
  const m1 = await stu(p, '300000001'), m3 = await stu(p, '300000003');
  m1.email === 'rachel@example.com' ? ok('עמודה ריקה דולגה — נלקח הערך מהשנייה')
                                    : bad('המיזוג לא לקח את הערך הקיים: ' + m1.email);
  m3.email === 'first@example.com' ? ok('כששתיהן מלאות — גוברת הראשונה')
                                   : bad('סדר העדיפות שגוי: ' + m3.email);

  if (!errs.length) ok('אין שגיאות JavaScript'); else bad('שגיאות בעמוד', errs);
  await browser.close(); server.close();
  console.log('\n' + '─'.repeat(52));
  console.log(fail ? `❌ ${fail} בדיקות נכשלו` : '✅ כל הבדיקות עברו');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
