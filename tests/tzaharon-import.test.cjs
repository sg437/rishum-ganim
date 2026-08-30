/* ============================================================================
   ייבוא הנרשמות לצהרון — בדיקת דפדפן
   ----------------------------------------------------------------------------
     1. רשימת ת"ז נטו — תצוגה מקדימה מפרידה חדשות / כבר רשומות / לא נמצאו.
     2. הייבוא מסמן את התיקים והמונים זזים.
     3. בלי סנכרון מלא — מי שאינה ברשימה אינה נוגעת.
     4. עם סנכרון מלא — התצוגה מראה מי יורדת, והכפתור אומר כמה.
     5. ביטול האישור לא משנה דבר.
     6. "ביטול הייבוא האחרון" מחזיר את המצב הקודם במדויק.
     7. קלט טבלאי עם כותרות עובד גם הוא.

   הרצה:  NODE_PATH=$(npm root) node tests/tzaharon-import.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('⏭️  דילוג: הבדיקה דורשת Playwright.'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PORT = 8753;
const TMP  = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-tzi-'));

function buildApp() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/, '');
  html = html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g, '/__stub/fbstub.js');
  html = html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', '/__stub/noop.js');
  const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; else if(k==='currentUser')currentUser=v; else if(k==='db')db=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, navToTab, tzPlan, openTzImport, closeModal });
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

/* 10 תלמידות בגן אחד. 3 הראשונות כבר רשומות לצהרון. */
const SEED = `(() => {
  DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
  DB.gans=[{id:'g1',ganName:'גן הדקל',campus:'קמפוס מרכז',education:'רגיל',age:'4',active:true}];
  DB.students=[];
  for(let i=1;i<=10;i++) DB.students.push({ id:'s'+i, year:'תשפ"ז', ganId:'g1', finished:false,
    firstName:'ילדה'+i, lastName:'כהן', tz:'30000000'+i, age:'4', education:'רגיל',
    docs:{}, docFiles:{}, programs:{ tzaharon: i<=3 }, programsPaid:{}, special:{}, support:{} });
  DB.staff=[]; DB.management=[]; DB.assignments={}; DB.tzGroups={}; DB.municipality={};
  DB.settings={ admins:['admin@test.org'], tzaharonLimits:{ 'רגיל':{min:15,max:25}, 'ח"מ':{min:8,max:14} } };
  __set('currentUser',{ email:'admin@test.org', uid:'u1' });
  __set('db', null); __set('eduPicked',true); __set('activeEdu',null);
  document.body.classList.remove('locked');
  return 'ok';
})()`;

let fail = 0;
const ok  = m => console.log('  ✅ ' + m);
const bad = (m, d) => { fail++; console.log('  ❌ ' + m); (d||[]).forEach(x => console.log('       ' + x)); };
const regOf = p => p.evaluate(() => DB.students.filter(s => s.programs && s.programs.tzaharon).map(s => s.id).sort());

async function openDlg(p, text, sync) {
  await p.evaluate(() => { if (document.querySelector('#tzi-text')) closeModal(); });
  await p.evaluate(() => openTzImport());
  await p.waitForTimeout(300);
  if (sync) await p.evaluate(() => { const c = document.querySelector('#tzi-sync'); c.checked = true; c.dispatchEvent(new Event('change')); });
  await p.evaluate(t => { document.querySelector('#tzi-text').value = t; }, text);
  await p.evaluate(() => document.querySelector('#tzi-preview').click());
  await p.waitForTimeout(300);
}
const stats = p => p.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#tzi-out .stat')].map(c =>
    [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => { window.__confirmYes = true;
    window.confirm = m => { window.__lastConfirm = m; return !!window.__confirmYes; }; });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:' + PORT + '/app.html', { waitUntil: 'load' });
  await p.waitForTimeout(1100);
  await p.evaluate(SEED);
  await p.evaluate(() => navToTab('tzaharon'));
  await p.waitForTimeout(600);

  console.log('\n1. תצוגה מקדימה — רשימת ת"ז נטו');
  /* ברשימה: 2,3 (כבר רשומות) · 4,5,6 (חדשות) · שתי ת"ז שאינן במערכת */
  const LIST = ['300000002','300000003','300000004','300000005','300000006','999999991','999999992'].join('\n');
  await openDlg(p, LIST, false);
  const st = await stats(p);
  st['ברשימה'] === 7      ? ok('ברשימה: 7') : bad('"ברשימה" שגוי: ' + st['ברשימה']);
  st['חדשות לרישום'] === 3 ? ok('חדשות לרישום: 3') : bad('"חדשות" שגוי: ' + st['חדשות לרישום']);
  st['כבר רשומות'] === 2   ? ok('כבר רשומות: 2') : bad('"כבר רשומות" שגוי: ' + st['כבר רשומות']);
  st['לא נמצאו'] === 2     ? ok('לא נמצאו: 2') : bad('"לא נמצאו" שגוי: ' + st['לא נמצאו']);
  const noSyncCard = await p.evaluate(() => /יורדות מהרישום/.test(document.querySelector('#tzi-out').textContent));
  !noSyncCard ? ok('בלי סנכרון מלא — אין כרטיס "יורדות מהרישום"') : bad('הכרטיס הופיע בטעות');
  const notFoundTxt = await p.evaluate(() => {
    const ta = [...document.querySelectorAll('#tzi-out textarea')][0];
    return ta ? ta.value.trim().split('\n') : []; });
  (notFoundTxt.length === 2 && notFoundTxt.includes('999999991'))
    ? ok('הת"ז שלא נמצאו ניתנות להעתקה') : bad('רשימת הלא-נמצאו שגויה', [JSON.stringify(notFoundTxt)]);
  const btn = await p.evaluate(() => document.querySelector('#tzi-do').textContent.trim());
  /מסמן 3/.test(btn) ? ok('הכפתור אומר כמה יסומנו') : bad('טקסט הכפתור שגוי: ' + btn);

  console.log('\n2. הייבוא מסמן, והמונים זזים');
  await p.evaluate(() => document.querySelector('#tzi-do').click());
  await p.waitForTimeout(600);
  const reg = await regOf(p);
  (JSON.stringify(reg) === JSON.stringify(['s1','s2','s3','s4','s5','s6']))
    ? ok('שש רשומות: שלוש קודמות + שלוש חדשות') : bad('הרישום שגוי', [JSON.stringify(reg)]);
  const total = await p.evaluate(() => parseInt(document.querySelector('#tzCards .stat .v').textContent, 10));
  total === 6 ? ok('הכרטיס במסך מציג 6') : bad('הכרטיס שגוי: ' + total);
  const s7 = await p.evaluate(() => !!DB.students.find(s => s.id === 's7').programs.tzaharon);
  !s7 ? ok('מי שאינה ברשימה לא נגעו בה') : bad('שונתה תלמידה שאינה ברשימה');

  console.log('\n3. סנכרון מלא — התצוגה מראה מי יורדת');
  /* רשימה חדשה: רק 1 ו-4. בסנכרון מלא — 2,3,5,6 יורדות */
  await openDlg(p, '300000001\n300000004', true);
  const st2 = await stats(p);
  st2['יורדות מהרישום'] === 4 ? ok('יורדות מהרישום: 4') : bad('"יורדות" שגוי: ' + st2['יורדות מהרישום']);
  st2['חדשות לרישום'] === 0   ? ok('חדשות: 0') : bad('"חדשות" שגוי: ' + st2['חדשות לרישום']);
  const btn2 = await p.evaluate(() => document.querySelector('#tzi-do').textContent.trim());
  /מבטל 4 רישומים/.test(btn2) ? ok('הכפתור אומר במפורש כמה יבוטלו') : bad('טקסט הכפתור שגוי: ' + btn2);
  const listed = await p.evaluate(() => {
    const d = [...document.querySelectorAll('#tzi-out details')].find(x => /יורדות מהרישום/.test(x.textContent));
    return d ? d.querySelectorAll('tbody tr').length : 0; });
  listed === 4 ? ok('ארבע השמות מפורטות בתצוגה') : bad('הפירוט שגוי: ' + listed);

  console.log('\n4. ביטול האישור לא משנה דבר');
  await p.evaluate(() => { window.__confirmYes = false; });
  await p.evaluate(() => document.querySelector('#tzi-do').click());
  await p.waitForTimeout(400);
  const unchanged = await regOf(p);
  (JSON.stringify(unchanged) === JSON.stringify(['s1','s2','s3','s4','s5','s6']))
    ? ok('הרישום לא השתנה') : bad('הרישום השתנה למרות הביטול', [JSON.stringify(unchanged)]);
  const msg = await p.evaluate(() => window.__lastConfirm || '');
  (/4 תלמידות יירדו/.test(msg)) ? ok('ההודעה נוקבת במספר') : bad('ההודעה שגויה: ' + msg);

  console.log('\n5. סנכרון מלא מאושר');
  await p.evaluate(() => { window.__confirmYes = true; });
  await p.evaluate(() => document.querySelector('#tzi-do').click());
  await p.waitForTimeout(600);
  const synced = await regOf(p);
  (JSON.stringify(synced) === JSON.stringify(['s1','s4']))
    ? ok('נשארו רק שתי הרשומות שברשימה') : bad('הסנכרון שגוי', [JSON.stringify(synced)]);
  const total2 = await p.evaluate(() => parseInt(document.querySelector('#tzCards .stat .v').textContent, 10));
  total2 === 2 ? ok('הכרטיס במסך ירד ל-2') : bad('הכרטיס שגוי: ' + total2);

  console.log('\n6. ביטול הייבוא האחרון');
  await p.evaluate(() => openTzImport());
  await p.waitForTimeout(300);
  const undoEnabled = await p.evaluate(() => !document.querySelector('#tzi-undo').disabled);
  undoEnabled ? ok('כפתור הביטול פעיל') : bad('כפתור הביטול כבוי');
  await p.evaluate(() => document.querySelector('#tzi-undo').click());
  await p.waitForTimeout(600);
  const back = await regOf(p);
  (JSON.stringify(back) === JSON.stringify(['s1','s2','s3','s4','s5','s6']))
    ? ok('המצב חזר במדויק למה שהיה לפני הסנכרון') : bad('הביטול שגוי', [JSON.stringify(back)]);
  await p.evaluate(() => openTzImport());
  await p.waitForTimeout(300);
  const undoGone = await p.evaluate(() => document.querySelector('#tzi-undo').disabled);
  undoGone ? ok('אחרי הביטול הכפתור כבה') : bad('כפתור הביטול נשאר פעיל');

  console.log('\n7. קלט טבלאי עם כותרות');
  await openDlg(p, 'ת"ז,שם\n300000007,כהן ילדה7\n300000008,כהן ילדה8', false);
  const st3 = await stats(p);
  (st3['ברשימה'] === 2 && st3['חדשות לרישום'] === 2)
    ? ok('טבלה עם כותרות נקראת נכון') : bad('הקריאה שגויה', [JSON.stringify(st3)]);
  await p.evaluate(() => document.querySelector('#tzi-do').click());
  await p.waitForTimeout(600);
  const withTable = await regOf(p);
  withTable.includes('s7') && withTable.includes('s8')
    ? ok('שתיהן סומנו') : bad('לא סומנו', [JSON.stringify(withTable)]);

  if (!errs.length) ok('אין שגיאות JavaScript'); else bad('שגיאות בעמוד', errs);
  await browser.close(); server.close();
  console.log('\n' + '─'.repeat(52));
  console.log(fail ? `❌ ${fail} בדיקות נכשלו` : '✅ כל הבדיקות עברו');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
