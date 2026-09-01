/* ============================================================================
   מקטע ההגדרות "צהרון — מינימום ומקסימום" בשני העיצובים
   ----------------------------------------------------------------------------
   טוענת את index.html האמיתי עם Firebase מדומה, פעם בעיצוב הקיים ופעם
   עם מעבדת העיצוב דלוקה, ומוודאת שהמקטע באמת עובד — לא רק שהוא מצויר:

     1. יש שורה לכל סוג חינוך, עם שדה מינימום ושדה מקסימום.
     2. שמירה כותבת tzaharonLimits ומוחקת את tzaharonMin הישן.
     3. מקסימום קטן מהמינימום נחסם, וההגדרה הקיימת אינה נדרסת.
     4. מתג "הצגת תשלום צהרון" נשמר ונטען.
     5. הערך שנשמר חוזר לשדות אחרי רענון המסך.
     6. במעבדה: השדות עוברים למבנה השורות, ושומרים על החיווט (אותם
        אלמנטים מוזזים, לא משוכפלים) — שמירה עדיין עובדת.

   הרצה:  NODE_PATH=$(npm root) node tests/tzaharon-settings.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית, לא נדרשת לשימוש בתוכנה).');
  console.log('    הרצה:   NODE_PATH=$(npm root) node tests/tzaharon-settings.test.cjs');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PORT = 8737;
const TMP  = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-tz-'));

function buildApp() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/, '');
  html = html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g, '/__stub/fbstub.js');
  html = html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', '/__stub/noop.js');
  const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; else if(k==='currentUser')currentUser=v; else if(k==='db')db=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, tzLimits, tzPlan, tzHasLimits, tzShowPaid });
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

/* משתמש מנהל — המקטע ניתן לעריכה רק למנהלי מערכת */
const SEED = `(() => {
  DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
  DB.gans=[
    {id:'g1',ganName:'גן הדקל',active:true,education:'רגיל',age:'4',campus:'קמפוס מרכז'},
    {id:'g2',ganName:'גן הרימון',active:true,education:'רגיל',age:'4',campus:'קמפוס מרכז'},
    {id:'g3',ganName:'גן שקד',active:true,education:'ח"מ',age:'5',campus:'קמפוס צפון'}
  ];
  DB.students=[]; DB.staff=[]; DB.management=[]; DB.assignments={}; DB.tzGroups={};
  DB.settings={ admins:['admin@test.org'], tzaharonMin:12 };
  __set('currentUser',{ email:'admin@test.org', uid:'u1' });
  __set('db', null);   /* בלי Firestore אמיתי, runPush היה בונה מחדש DB ממטמון ריק */
  __set('eduPicked',true); __set('activeEdu',null);
  document.body.classList.remove('locked');
  return 'ok';
})()`;

let fail = 0;
const ok  = m => console.log('  ✅ ' + m);
const bad = (m, d) => { fail++; console.log('  ❌ ' + m); (d||[]).forEach(x => console.log('       ' + x)); };

async function openSettings(p) {
  await p.evaluate(() => { __set('active','settings'); route(); });
  await p.waitForTimeout(700);
}

async function run(labOn) {
  const label = labOn ? 'העיצוב החדש (מעבדה)' : 'העיצוב הקיים';
  console.log('\n── ' + label + ' ' + '─'.repeat(40 - label.length));

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript(on => {
    /* ⚠️ מאז שהעיצוב החדש שוחרר לכולם, *מחיקת* הדגל אינה מכבה אותו אלא
       נופלת לברירת המחדל — כלומר לעיצוב החדש. הכיבוי הוא ערך מפורש. */
    try { localStorage.setItem('uiLab', on ? 'new' : 'old'); } catch(e){}
  }, labOn);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:' + PORT + '/app.html', { waitUntil: 'load' });
  await p.waitForTimeout(1100);

  if (!await p.evaluate(() => !!window.__ready)) {
    bad('טעינת האפליקציה נכשלה', errs); await browser.close(); return;
  }
  const inLab = await p.evaluate(() => document.documentElement.classList.contains('ui-lab'));
  if (inLab !== labOn) { bad('מצב המעבדה שגוי (צפוי ' + labOn + ', התקבל ' + inLab + ')'); await browser.close(); return; }

  await p.evaluate(SEED);
  await openSettings(p);

  /* --- 1. שדה לכל סוג חינוך --- */
  const fields = await p.evaluate(() => [...document.querySelectorAll('.tzlim')]
    .map(i => i.dataset.tzedu + '|' + i.dataset.tzk));
  const want = ['רגיל|min','רגיל|max','ח"מ|min','ח"מ|max'];
  if (JSON.stringify(fields) === JSON.stringify(want)) ok('ארבעה שדות — מינימום ומקסימום לכל סוג חינוך');
  else bad('השדות אינם כמצופה', ['התקבל: ' + JSON.stringify(fields)]);

  /* --- 2. חיווי ההגדרה הישנה --- */
  const legacyHint = await p.evaluate(() =>
    !!document.querySelector('[data-set~="tzmin"], [data-lab="tzmin"]')?.textContent.match(/המספר הישן/));
  legacyHint ? ok('מוצג חיווי שההגדרה הישנה (12) עדיין בשימוש')
             : bad('חסר החיווי על ההגדרה הישנה');

  /* --- 3. במעבדה: השדות עברו למבנה השורות --- */
  if (labOn) {
    const shape = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.lab-tzrow')];
      return { rows: rows.length,
               edus: rows.map(r => r.querySelector('.lab-tzedu')?.textContent.trim()),
               inputs: rows.map(r => r.querySelectorAll('input.tzlim').length),
               labels: rows[0] ? [...rows[0].querySelectorAll('.lab-tzfield > label')].map(l => l.textContent) : [],
               tableGone: !document.querySelector('[data-lab="tzmin"] .table-wrap') };
    });
    if (shape.rows === 2 && shape.inputs.every(n => n === 2)) ok('שתי שורות, שני שדות בכל אחת');
    else bad('מבנה השורות שגוי', [JSON.stringify(shape)]);
    if (JSON.stringify(shape.edus) === JSON.stringify(['רגיל','ח"מ'])) ok('שם סוג החינוך על כל שורה');
    else bad('שמות סוגי החינוך שגויים', [JSON.stringify(shape.edus)]);
    if (JSON.stringify(shape.labels) === JSON.stringify(['מינימום','מקסימום'])) ok('תווית לכל שדה');
    else bad('התוויות שגויות', [JSON.stringify(shape.labels)]);
    if (shape.tableGone) ok('הטבלה המקורית הוסרה (השדות הוזזו, לא שוכפלו)');
    else bad('הטבלה המקורית נשארה — סכנת כפילות');
  }

  /* --- 4. שמירה תקינה --- */
  await p.evaluate(() => {
    const set = (edu,k,v) => { const i=[...document.querySelectorAll('.tzlim')]
      .find(x=>x.dataset.tzedu===edu && x.dataset.tzk===k); if(i) i.value=v; };
    set('רגיל','min','15'); set('רגיל','max','25');
    set('ח"מ','min','8');   set('ח"מ','max','14');
    document.querySelector('#saveTzMin').click();
  });
  await p.waitForTimeout(500);
  const saved = await p.evaluate(() => ({
    limits: DB.settings.tzaharonLimits,
    legacy: DB.settings.tzaharonMin,
    reg: tzLimits('רגיל'), spec: tzLimits('ח"מ')
  }));
  if (JSON.stringify(saved.limits) === JSON.stringify({'רגיל':{min:15,max:25},'ח"מ':{min:8,max:14}}))
    ok('נשמרו מגבלות נפרדות לכל סוג חינוך');
  else bad('השמירה שגויה', [JSON.stringify(saved.limits)]);
  if (saved.legacy === undefined) ok('ההגדרה הישנה נמחקה');
  else bad('ההגדרה הישנה נשארה: ' + saved.legacy);
  if (saved.reg.min === 15 && saved.spec.min === 8) ok('tzLimits מחזירה את הערכים הנכונים');
  else bad('tzLimits שגויה', [JSON.stringify(saved)]);

  /* --- 5. הערכים חוזרים לשדות אחרי רענון --- */
  await openSettings(p);
  const reloaded = await p.evaluate(() => [...document.querySelectorAll('.tzlim')].map(i => i.value));
  if (JSON.stringify(reloaded) === JSON.stringify(['15','25','8','14'])) ok('הערכים חוזרים לשדות אחרי רענון');
  else bad('הערכים לא חזרו', [JSON.stringify(reloaded)]);

  const hintGone = await p.evaluate(() =>
    !document.querySelector('[data-set~="tzmin"], [data-lab="tzmin"]')?.textContent.match(/המספר הישן/));
  hintGone ? ok('חיווי ההגדרה הישנה נעלם אחרי המילוי') : bad('חיווי ההגדרה הישנה נשאר');

  /* --- 6. מקסימום קטן מהמינימום נחסם --- */
  await p.evaluate(() => {
    const i=[...document.querySelectorAll('.tzlim')].find(x=>x.dataset.tzedu==='רגיל'&&x.dataset.tzk==='max');
    i.value='9'; document.querySelector('#saveTzMin').click();
  });
  await p.waitForTimeout(400);
  const blocked = await p.evaluate(() => ({
    still: DB.settings.tzaharonLimits['רגיל'].max,
    toast: (document.querySelector('#toast')||{}).textContent || ''
  }));
  if (blocked.still === 25) ok('מקסימום קטן מהמינימום נחסם — ההגדרה הקיימת לא נדרסה');
  else bad('ההגדרה נדרסה בערך לא תקין: ' + blocked.still);
  if (/מקסימום/.test(blocked.toast)) ok('הוצגה הודעה שמסבירה למה');
  else bad('לא הוצגה הודעה', ['toast: ' + blocked.toast]);

  /* --- 7. מתג התשלום --- */
  await openSettings(p);
  const paid = await p.evaluate(async () => {
    const cb = document.querySelector('#tzpaid');
    const before = tzShowPaid();
    cb.click(); cb.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    return { before, after: tzShowPaid(), stored: DB.settings.tzaharonShowPaid };
  });
  if (paid.before === false && paid.after === true && paid.stored === true) ok('מתג התשלום נדלק ונשמר');
  else bad('מתג התשלום לא עבד', [JSON.stringify(paid)]);

  await openSettings(p);
  const paidBack = await p.evaluate(() => document.querySelector('#tzpaid').checked);
  paidBack ? ok('המתג נטען דלוק אחרי רענון') : bad('המתג לא נטען דלוק');

  const paidOff = await p.evaluate(async () => {
    const cb = document.querySelector('#tzpaid');
    cb.click(); cb.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    return { on: tzShowPaid(), key: 'tzaharonShowPaid' in DB.settings };
  });
  if (paidOff.on === false && paidOff.key === false) ok('כיבוי המתג מנקה את ההגדרה');
  else bad('הכיבוי לא ניקה', [JSON.stringify(paidOff)]);

  /* --- 8. אין שגיאות בקונסול --- */
  if (!errs.length) ok('אין שגיאות JavaScript');
  else bad('שגיאות בעמוד', errs);

  await browser.close();
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  await run(false);
  await run(true);
  server.close();
  console.log('\n' + '─'.repeat(52));
  console.log(fail ? `❌ ${fail} בדיקות נכשלו` : '✅ כל הבדיקות עברו — בשני העיצובים');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
