/* ============================================================================
   שיבוץ צוות לקבוצת צהרון — בדיקת דפדפן
   ----------------------------------------------------------------------------
     1. בהקשר "צהרונים" מוצגות קבוצות פתוחות, לא גנים.
     2. קבוצה שלא נפתחה אינה מופיעה כלל.
     3. חלון השיבוץ מציג את פרטי הקבוצה (גנים, גילים, רשומים, מינימום).
     4. שיבוץ נשמר תחת מזהה הקבוצה, ומופיע ברשימה ובתיק העובדת.
     5. קבוצה מצורפת = שיבוץ אחד: אותה עובדת אינה נחשבת משובצת פעמיים.
     6. שאר ההקשרים (פעילות הגן) ממשיכים לעבוד לפי גן, בלי שינוי.
     7. המיגרציה: שיבוץ ישן לפי מזהה גן עובר לקבוצה ומוצג נכון.

   הרצה:  NODE_PATH=$(npm root) node tests/tzaharon-assign.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('⏭️  דילוג: הבדיקה דורשת Playwright.'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PORT = 8755;
const TMP  = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-tza-'));

function buildApp() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/, '');
  html = html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g, '/__stub/fbstub.js');
  html = html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', '/__stub/noop.js');
  const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; else if(k==='currentUser')currentUser=v; else if(k==='db')db=v; else if(k==='asgContext')asgContext=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, navToTab, tzPlan, asgUnit, asgUnitName, migrateTzGroups,
                       openGanAssign, staffAssignmentsFull, closeModal });
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

/* g1+g2 בקבוצה מצורפת פתוחה · g3 בקבוצה מתוכננת (לא נפתחה) */
const SEED = `(() => {
  DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
  DB.gans=[
    {id:'g1',ganName:'גן הדקל',campus:'קמפוס מרכז',education:'רגיל',age:'3',active:true},
    {id:'g2',ganName:'גן הרימון',campus:'קמפוס מרכז',education:'רגיל',age:'4',active:true},
    {id:'g3',ganName:'גן הזית',campus:'קמפוס צפון',education:'רגיל',age:'4',active:true}
  ];
  DB.students=[]; let n=0;
  [['g1',10,9],['g2',10,8],['g3',20,18]].forEach(x=>{ for(let i=0;i<x[1];i++){ n++;
    DB.students.push({ id:'s'+n, year:'תשפ"ז', ganId:x[0], finished:false,
      firstName:'ילדה'+n, lastName:'כהן', tz:'40000000'+n, age:'4', education:'רגיל',
      docs:{}, docFiles:{}, programs:{ tzaharon:i<x[2] }, programsPaid:{}, special:{},
      support:{ shiluv: i===0 } }); } });
  DB.staff=[
    {id:'m1',lastName:'ברקוביץ',firstName:'שרה',role:'גננת',education:'רגיל',active:true,mobile:'050-1',createdAt:'2020-01-01',movements:[],notesList:[],absences:[],lateness:[],docFiles:{}},
    {id:'m2',lastName:'פישר',firstName:'נחמה',role:'סייעת',education:'רגיל',active:true,mobile:'050-2',createdAt:'2020-01-01',movements:[],notesList:[],absences:[],lateness:[],docFiles:{}}
  ];
  DB.management=[]; DB.assignments={};
  DB.tzGroups={'תשפ"ז':[
    {id:'tz_a', name:'צהרון מרכז', campus:'קמפוס מרכז', ganIds:['g1','g2'], education:'רגיל', status:'open'},
    {id:'tz_b', name:'צהרון צפון', campus:'קמפוס צפון', ganIds:['g3'], education:'רגיל', status:'planned'}
  ]};
  DB.settings={ admins:['admin@test.org'], tzaharonLimits:{ 'רגיל':{min:15,max:25}, 'ח"מ':{min:8,max:14} } };
  __set('currentUser',{ email:'admin@test.org', uid:'u1' });
  __set('db', null); __set('eduPicked',true); __set('activeEdu',null);
  document.body.classList.remove('locked');
  return 'ok';
})()`;

let fail = 0;
const ok  = m => console.log('  ✅ ' + m);
const bad = (m, d) => { fail++; console.log('  ❌ ' + m); (d||[]).forEach(x => console.log('       ' + x)); };

async function toAssign(p, ctx) {
  await p.evaluate(c => { __set('asgContext', c); if (!document.querySelector('#asgPick')) navToTab('assign'); else route(); }, ctx);
  await p.waitForTimeout(700);
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await ctx.addInitScript(() => { window.confirm = () => true; });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:' + PORT + '/app.html', { waitUntil: 'load' });
  await p.waitForTimeout(1100);
  await p.evaluate(SEED);
  await toAssign(p, 'tzaharon');

  console.log('\n1. הרשימה מציגה קבוצות, לא גנים');
  const head = await p.evaluate(() => [...document.querySelectorAll('#asgPick thead th')].map(t => t.textContent.trim()));
  (head[0] === 'הקבוצה' && head.includes('הגנים שבה'))
    ? ok('כותרות הטבלה הן של קבוצות') : bad('הכותרות שגויות', [JSON.stringify(head)]);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#asgPick tbody tr')].map(tr => {
    const td = [...tr.querySelectorAll('td')].map(x => x.textContent.trim());
    return { name: td[0], campus: td[1], gans: td[3], reg: td[4], state: td[5],
             key: (tr.querySelector('[data-asg]')||{}).dataset ? tr.querySelector('[data-asg]').dataset.asg : '' };
  }));
  rows.length === 1 ? ok('שורה אחת — רק הקבוצה שנפתחה') : bad('מספר השורות שגוי: ' + rows.length);
  (rows[0] && rows[0].name === 'צהרון מרכז') ? ok('הקבוצה הפתוחה מוצגת') : bad('הקבוצה שגויה', [JSON.stringify(rows[0])]);
  (rows[0] && /גן הדקל \+ גן הרימון/.test(rows[0].gans)) ? ok('שני הגנים שבקבוצה מוצגים') : bad('הגנים שגויים: ' + (rows[0]||{}).gans);
  (rows[0] && rows[0].reg === '17/15') ? ok('רשומים לצהרון: 17/15') : bad('הספירה שגויה: ' + (rows[0]||{}).reg);
  (rows[0] && rows[0].key === 'tz_a') ? ok('מפתח השיבוץ הוא מזהה הקבוצה') : bad('המפתח שגוי: ' + (rows[0]||{}).key);

  console.log('\n2. קבוצה שלא נפתחה אינה מופיעה');
  const noPlanned = await p.evaluate(() => !/צהרון צפון/.test(document.querySelector('#asgPick').textContent));
  noPlanned ? ok('הקבוצה המתוכננת אינה ברשימה') : bad('קבוצה מתוכננת הופיעה');
  const link = await p.evaluate(() => !!document.querySelector('#asgToTz'));
  link ? ok('יש קישור למסך הצהרון') : bad('אין קישור למסך הצהרון');

  console.log('\n3. חלון השיבוץ מציג את פרטי הקבוצה');
  await p.evaluate(() => document.querySelector('[data-asg="tz_a"]').click());
  await p.waitForTimeout(500);
  const dlg = await p.evaluate(() => ({
    title: (document.querySelector('#modal h3')||{}).textContent || '',
    info: document.querySelector('#modal').textContent.replace(/\s+/g,' ')
  }));
  /שיבוץ — צהרון מרכז/.test(dlg.title) ? ok('הכותרת: ' + dlg.title.trim().slice(0,30)) : bad('הכותרת שגויה: ' + dlg.title);
  /גן הדקל \+ גן הרימון/.test(dlg.info) ? ok('הגנים מוצגים בפרטים') : bad('הגנים חסרים');
  /גילים: 3 · 4|גילים: 4 · 3/.test(dlg.info) ? ok('הגילים שהקבוצה מכסה מוצגים') : bad('הגילים חסרים', [dlg.info.slice(0,220)]);
  /רשומות לצהרון: 17/.test(dlg.info) ? ok('מספר הרשומות לצהרון') : bad('מספר הרשומות חסר', [dlg.info.slice(0,220)]);
  /מינימום: 15/.test(dlg.info) ? ok('המינימום של אותו סוג חינוך') : bad('המינימום חסר', [dlg.info.slice(0,220)]);

  console.log('\n4. שיבוץ נשמר תחת מזהה הקבוצה');
  await p.evaluate(() => {
    DB.assignments['תשפ"ז'] = { tzaharon: { tz_a: { 'גננת': { staffId:'m1', name:'ברקוביץ שרה' } } } };
    closeModal();
  });
  await toAssign(p, 'tzaharon');
  const saved = await p.evaluate(() => ({
    listed: document.querySelector('#asgList').textContent.replace(/\s+/g,' '),
    pill: [...document.querySelectorAll('#asgPick tbody td')].map(t=>t.textContent.trim()).find(t=>/משובצים/.test(t)) || '',
    unitName: asgUnitName('tz_a','tzaharon')
  }));
  /צהרון מרכז/.test(saved.listed) && /ברקוביץ/.test(saved.listed)
    ? ok('הקבוצה והצוות מופיעים ברשימה למטה') : bad('הרשימה שגויה', [saved.listed.slice(0,150)]);
  /1 משובצים/.test(saved.pill) ? ok('מצב השיבוץ: 1 משובצים') : bad('מצב השיבוץ שגוי: ' + saved.pill);
  saved.unitName === 'צהרון מרכז' ? ok('asgUnitName מחזירה את שם הקבוצה') : bad('שם היחידה שגוי: ' + saved.unitName);

  const inFile = await p.evaluate(() => staffAssignmentsFull('m1').map(a => ({ ctx:a.ctx, key:a.ganId })));
  (inFile.length === 1 && inFile[0].key === 'tz_a')
    ? ok('בתיק העובדת השיבוץ מופיע תחת הקבוצה') : bad('התיק שגוי', [JSON.stringify(inFile)]);

  console.log('\n5. קבוצה מצורפת = שיבוץ אחד');
  const once = await p.evaluate(() => {
    /* אילו השיבוץ היה לפי גן, אותה עובדת הייתה נספרת פעמיים */
    const A = DB.assignments['תשפ"ז'].tzaharon;
    return { keys: Object.keys(A), gansCovered: asgUnit('tz_a').ganIds };
  });
  (once.keys.length === 1 && once.gansCovered.length === 2)
    ? ok('שיבוץ אחד מכסה את שני הגנים') : bad('הכיסוי שגוי', [JSON.stringify(once)]);

  console.log('\n6. פעילות הגן לא השתנתה');
  await toAssign(p, 'activity');
  const act = await p.evaluate(() => ({
    head: [...document.querySelectorAll('#asgPick thead th')].map(t => t.textContent.trim()),
    rows: document.querySelectorAll('#asgPick tbody tr').length
  }));
  (act.head[0] === 'שם הגן' && act.rows === 3)
    ? ok('בפעילות הגן — שלושה גנים, כותרות של גנים') : bad('הקשר פעילות הגן נשבר', [JSON.stringify(act)]);
  await p.evaluate(() => document.querySelector('[data-asg="g1"]').click());
  await p.waitForTimeout(400);
  const actDlg = await p.evaluate(() => ({
    title: (document.querySelector('#modal h3')||{}).textContent || '',
    info: document.querySelector('#modal').textContent.replace(/\s+/g,' ')
  }));
  /שיבוץ — גן הדקל/.test(actDlg.title) ? ok('חלון השיבוץ של גן נפתח כרגיל') : bad('הכותרת שגויה: ' + actDlg.title);
  /גיל: 3 · חינוך: רגיל · רשומות: 10/.test(actDlg.info) ? ok('פרטי הגן מוצגים כרגיל') : bad('פרטי הגן חסרים', [actDlg.info.slice(0,220)]);
  await p.evaluate(() => closeModal());

  console.log('\n7. מיגרציה משיבוץ ישן לפי גן');
  await p.evaluate(() => {
    DB.tzGroups = {};
    DB.assignments = { 'תשפ"ז': { tzaharon: { g3: { 'סייעת': { staffId:'m2', name:'פישר נחמה' } } } } };
    migrateTzGroups();
  });
  const mig = await p.evaluate(() => {
    const g = DB.tzGroups['תשפ"ז'][0];
    const A = DB.assignments['תשפ"ז'].tzaharon;
    return { n: DB.tzGroups['תשפ"ז'].length, id: g.id, legacy: g.legacyGanId, status: g.status,
             keys: Object.keys(A), name: asgUnitName(g.id, 'tzaharon'),
             kept: !!A[g.id] && A[g.id]['סייעת'].name };
  });
  (mig.n === 1 && mig.legacy === 'g3' && mig.status === 'open')
    ? ok('נוצרה קבוצה חד-גנית פתוחה') : bad('המיגרציה שגויה', [JSON.stringify(mig)]);
  (mig.keys.length === 1 && mig.keys[0] === mig.id)
    ? ok('השיבוץ עבר למפתח הקבוצה') : bad('המפתח לא הועבר', [JSON.stringify(mig.keys)]);
  mig.kept === 'פישר נחמה' ? ok('השיבוץ עצמו נשמר') : bad('השיבוץ אבד');
  mig.name === 'קמפוס צפון — גן הזית' ? ok('השם נגזר: ' + mig.name) : bad('השם שגוי: ' + mig.name);

  await toAssign(p, 'tzaharon');
  const afterMig = await p.evaluate(() => document.querySelector('#asgPick').textContent.replace(/\s+/g,' '));
  /גן הזית/.test(afterMig) ? ok('הקבוצה שנוצרה במיגרציה מופיעה במסך') : bad('הקבוצה לא מופיעה');

  if (!errs.length) ok('אין שגיאות JavaScript'); else bad('שגיאות בעמוד', errs);
  await browser.close(); server.close();
  console.log('\n' + '─'.repeat(52));
  console.log(fail ? `❌ ${fail} בדיקות נכשלו` : '✅ כל הבדיקות עברו');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
