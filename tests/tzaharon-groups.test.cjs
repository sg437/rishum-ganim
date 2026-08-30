/* ============================================================================
   פתיחת קבוצות צהרון — בדיקת דפדפן
   ----------------------------------------------------------------------------
     1. "פתיחת קבוצה" מגן בודד — הקבוצה נוצרת, והמונים זזים מיד.
     2. "פתיחת קבוצה מצורפת" מהצעת הצירוף — שני הגנים בקבוצה אחת.
     3. הבורר מציע רק גנים מאותו קמפוס ומאותו סוג חינוך, ורק פנויים.
     4. פתיחה מתחת למינימום דורשת אישור, וביטול האישור לא פותח כלום.
     5. עריכה, סגירה ומחיקה של קבוצה.
     6. קבוצה עם שיבוץ צוות אינה נמחקת.
     7. גן שכבר בקבוצה אינו נספר שוב ב"ניתן לפתוח".

   הרצה:  NODE_PATH=$(npm root) node tests/tzaharon-groups.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('⏭️  דילוג: הבדיקה דורשת Playwright.'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PORT = 8751;
const TMP  = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-tzg-'));

function buildApp() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/, '');
  html = html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g, '/__stub/fbstub.js');
  html = html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', '/__stub/noop.js');
  const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; else if(k==='currentUser')currentUser=v; else if(k==='db')db=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, navToTab, tzPlan, tzGroupsOfYear, openTzGroupDialog, closeModal });
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

const PLAN = [['g1','גן הדקל','קמפוס מרכז','רגיל','4',20,18],
              ['g2','גן הרימון','קמפוס מרכז','רגיל','4',12,9],
              ['g3','גן הזית','קמפוס מרכז','רגיל','3',10,8],
              ['g4','גן שקד','קמפוס צפון','ח"מ','5',11,9],
              ['g5','גן תמר','קמפוס מרכז','ח"מ','4',6,3]];
const SEED = `(() => {
  DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
  const plan=${JSON.stringify(PLAN)};
  DB.gans=plan.map(p=>({id:p[0],ganName:p[1],campus:p[2],education:p[3],age:p[4],active:true}));
  DB.students=[]; let n=0;
  plan.forEach(p=>{ for(let i=0;i<p[5];i++){ n++;
    DB.students.push({ id:'s'+n, year:'תשפ"ז', ganId:p[0], finished:false,
      firstName:'ילדה'+n, lastName:'כהן', tz:'20000000'+n, age:p[4], education:p[3],
      docs:{}, docFiles:{}, programs:{ tzaharon: i<p[6] }, programsPaid:{}, special:{}, support:{} }); } });
  DB.staff=[]; DB.management=[]; DB.assignments={}; DB.tzGroups={};
  DB.settings={ admins:['admin@test.org'], tzaharonLimits:{ 'רגיל':{min:15,max:25}, 'ח"מ':{min:8,max:14} } };
  __set('currentUser',{ email:'admin@test.org', uid:'u1' });
  __set('db', null); __set('eduPicked',true); __set('activeEdu',null);
  document.body.classList.remove('locked');
  return 'ok';
})()`;

let fail = 0;
const ok  = m => console.log('  ✅ ' + m);
const bad = (m, d) => { fail++; console.log('  ❌ ' + m); (d||[]).forEach(x => console.log('       ' + x)); };

const cards = p => p.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#tzCards .stat')].map(c =>
    [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));

/* ניווט כמו בתוכנה — navToTab דוחף רשומת היסטוריה, ולכן סגירת חלון
   חוזרת אל מסך הצהרון ולא אל רשומת הבסיס של עמוד הבית. */
async function toScreen(p) {
  await p.evaluate(() => { if (!document.querySelector('#tzCards')) navToTab('tzaharon'); else route(); });
  await p.waitForTimeout(600);
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  /* confirm תמיד מאשר, אלא אם הבדיקה מבקשת אחרת */
  await ctx.addInitScript(() => { window.__confirmYes = true;
    window.confirm = msg => { window.__lastConfirm = msg; return !!window.__confirmYes; }; });
  await p.goto('http://127.0.0.1:' + PORT + '/app.html', { waitUntil: 'load' });
  await p.waitForTimeout(1100);
  await p.evaluate(SEED);
  await toScreen(p);

  console.log('\n1. פתיחת קבוצה מגן בודד');
  const before = await cards(p);
  (before['ניתן לפתוח עכשיו'] === 3 && before['קבוצות שנפתחו'] === 0)
    ? ok('מצב פתיחה: ניתן לפתוח 3 · נפתחו 0') : bad('מצב פתיחה שגוי', [JSON.stringify(before)]);

  await p.evaluate(() => document.querySelector('[data-tzopen="g1"]').click());
  await p.waitForTimeout(400);
  const dlg = await p.evaluate(() => ({
    open: !!document.querySelector('#tzg-save'),
    campus: document.querySelector('#tzg-campus').value,
    edu: document.querySelector('#tzg-edu').value,
    offered: [...document.querySelectorAll('[data-tzg]')].map(c => c.dataset.tzg),
    checked: [...document.querySelectorAll('[data-tzg]:checked')].map(c => c.dataset.tzg),
    name: document.querySelector('#tzg-name').value,
    total: parseInt(document.querySelector('#tzg-sum .stat .v').textContent, 10)
  }));
  dlg.open ? ok('החלון נפתח') : bad('החלון לא נפתח');
  (dlg.campus === 'קמפוס מרכז' && dlg.edu === 'רגיל')
    ? ok('הקמפוס והחינוך נגזרו מהגן') : bad('הקשר שגוי', [JSON.stringify(dlg)]);
  /* קמפוס מרכז + רגיל = g1,g2,g3 בלבד (g4 צפון · g5 ח"מ) */
  (JSON.stringify(dlg.offered.sort()) === JSON.stringify(['g1','g2','g3']))
    ? ok('הבורר מציע רק גנים מאותו קמפוס ואותו חינוך') : bad('הבורר שגוי', [JSON.stringify(dlg.offered)]);
  (JSON.stringify(dlg.checked) === JSON.stringify(['g1']))
    ? ok('הגן שממנו נפתח מסומן') : bad('הסימון שגוי', [JSON.stringify(dlg.checked)]);
  dlg.total === 18 ? ok('הסכום החי: 18') : bad('הסכום שגוי: ' + dlg.total);
  /קמפוס מרכז — גן הדקל/.test(dlg.name) ? ok('שם ברירת מחדל: ' + dlg.name) : bad('השם שגוי: ' + dlg.name);

  await p.evaluate(() => document.querySelector('#tzg-save').click());
  await p.waitForTimeout(600);
  const after = await cards(p);
  const groups = await p.evaluate(() => tzGroupsOfYear().map(g => ({ id:g.id, gans:g.ganIds, st:g.status, edu:g.education })));
  groups.length === 1 ? ok('נוצרה קבוצה אחת') : bad('מספר הקבוצות שגוי: ' + groups.length);
  (groups[0] && groups[0].st === 'open' && JSON.stringify(groups[0].gans) === JSON.stringify(['g1']))
    ? ok('קבוצה פתוחה עם גן הדקל') : bad('הקבוצה שגויה', [JSON.stringify(groups[0])]);
  (groups[0] && groups[0].id.slice(0,3) === 'tz_') ? ok('מזהה בתחילית tz_') : bad('מזהה שגוי');
  after['קבוצות שנפתחו'] === 1 ? ok('"נפתחו" עלה ל-1 מיד') : bad('"נפתחו" לא עלה: ' + after['קבוצות שנפתחו']);
  after['ניתן לפתוח עכשיו'] === 2 ? ok('"ניתן לפתוח" ירד ל-2 מיד') : bad('"ניתן לפתוח" לא ירד: ' + after['ניתן לפתוח עכשיו']);
  const status = await p.evaluate(() => document.querySelector('#tzStatus').textContent.replace(/\s+/g,' '));
  /נפתחו 1 · ניתן לפתוח עוד 2 · סה"כ אפשריות 3/.test(status)
    ? ok('שורת המצב התעדכנה') : bad('שורת המצב שגויה', [status]);
  const rowBtn = await p.evaluate(() => {
    const tr = document.querySelector('[data-tzgan-row="g1"]');
    return { state: tr.querySelectorAll('td')[6].textContent.trim(),
             btn: (tr.querySelector('[data-tzgrp]')||{}).textContent || '' };
  });
  /בקבוצה/.test(rowBtn.state) ? ok('שורת הגן מסומנת "בקבוצה"') : bad('מצב השורה שגוי: ' + rowBtn.state);
  /הקבוצה/.test(rowBtn.btn) ? ok('הכפתור בשורה עבר ל"הקבוצה"') : bad('הכפתור שגוי: ' + rowBtn.btn);

  console.log('\n2. פתיחת קבוצה מצורפת מההצעה');
  await p.evaluate(() => document.querySelector('[data-tzmerge]').click());
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => ({
    checked: [...document.querySelectorAll('[data-tzg]:checked')].map(c => c.dataset.tzg).sort(),
    total: parseInt(document.querySelector('#tzg-sum .stat .v').textContent, 10),
    pill: document.querySelector('#tzg-sum .pill').textContent.trim(),
    ages: (document.querySelector('#tzg-sum .hint')||{}).textContent || ''
  }));
  (JSON.stringify(m.checked) === JSON.stringify(['g2','g3']))
    ? ok('שני הגנים של ההצעה מסומנים') : bad('הסימון שגוי', [JSON.stringify(m.checked)]);
  m.total === 17 ? ok('סכום ההצעה: 17') : bad('הסכום שגוי: ' + m.total);
  /עומדת במינימום/.test(m.pill) ? ok('מסומנת כעומדת במינימום') : bad('החיווי שגוי: ' + m.pill);
  /גילים 4 · 3|גילים 3 · 4/.test(m.ages) ? ok('חיווי הגילים השונים מוצג') : bad('חיווי הגילים חסר: ' + m.ages);

  await p.evaluate(() => document.querySelector('#tzg-save').click());
  await p.waitForTimeout(600);
  const after2 = await cards(p);
  after2['קבוצות שנפתחו'] === 2 ? ok('"נפתחו" עלה ל-2') : bad('"נפתחו" שגוי: ' + after2['קבוצות שנפתחו']);
  after2['ניתן לפתוח עכשיו'] === 1 ? ok('"ניתן לפתוח" ירד ל-1 (נשאר גן שקד)') : bad('"ניתן לפתוח" שגוי: ' + after2['ניתן לפתוח עכשיו']);
  const merged = await p.evaluate(() => tzGroupsOfYear().find(g => g.ganIds.length === 2));
  (merged && merged.campus === 'קמפוס מרכז' && merged.education === 'רגיל')
    ? ok('הקבוצה המצורפת נשמרה עם קמפוס וחינוך') : bad('הקבוצה המצורפת שגויה', [JSON.stringify(merged)]);
  const noMerge = await p.evaluate(() => document.querySelector('#tzMergeBox').innerHTML.trim());
  noMerge === '' ? ok('ההצעה נעלמה אחרי שנוצלה') : bad('ההצעה נשארה');

  console.log('\n3. גן שכבר בקבוצה אינו מוצע שוב');
  await p.evaluate(() => document.querySelector('[data-tzopen="g5"]').click());
  await p.waitForTimeout(400);
  const pick5 = await p.evaluate(() => ({
    offered: [...document.querySelectorAll('[data-tzg]')].map(c => c.dataset.tzg),
    edu: document.querySelector('#tzg-edu').value,
    pill: document.querySelector('#tzg-sum .pill').textContent.trim()
  }));
  (JSON.stringify(pick5.offered) === JSON.stringify(['g5']))
    ? ok('בקמפוס מרכז/ח"מ מוצע רק גן תמר') : bad('הבורר שגוי', [JSON.stringify(pick5)]);
  /חסרות 5/.test(pick5.pill) ? ok('חיווי: חסרות 5 למינימום של ח"מ') : bad('החיווי שגוי: ' + pick5.pill);

  console.log('\n4. פתיחה מתחת למינימום דורשת אישור');
  await p.evaluate(() => { window.__confirmYes = false; });
  await p.evaluate(() => document.querySelector('#tzg-save').click());
  await p.waitForTimeout(400);
  const declined = await p.evaluate(() => ({ n: tzGroupsOfYear().length, still: !!document.querySelector('#tzg-save'),
                                             msg: window.__lastConfirm || '' }));
  declined.n === 2 ? ok('ביטול האישור לא פתח קבוצה') : bad('נפתחה קבוצה למרות הביטול: ' + declined.n);
  /המינימום ל?ח"מ הוא 8/.test(declined.msg) ? ok('ההודעה נוקבת במינימום של אותו חינוך') : bad('ההודעה שגויה: ' + declined.msg);
  declined.still ? ok('החלון נשאר פתוח') : bad('החלון נסגר');

  await p.evaluate(() => { window.__confirmYes = true; });
  await p.evaluate(() => document.querySelector('#tzg-save').click());
  await p.waitForTimeout(600);
  const forced = await p.evaluate(() => tzGroupsOfYear().length);
  forced === 3 ? ok('אישור מפורש פותח קבוצה גם מתחת למינימום') : bad('לא נפתחה: ' + forced);

  console.log('\n5. עריכה, סגירה ומחיקה');
  const gid = await p.evaluate(() => tzGroupsOfYear().find(g => g.ganIds[0] === 'g5').id);
  await p.evaluate(id => document.querySelector(`[data-tzgrp="${id}"]`).click(), gid);
  await p.waitForTimeout(400);
  const edit = await p.evaluate(() => ({
    campusDisabled: document.querySelector('#tzg-campus').disabled,
    hasClose: !!document.querySelector('#tzg-close'),
    hasDel: !!document.querySelector('#tzg-del')
  }));
  edit.campusDisabled ? ok('הקמפוס נעול בעריכה') : bad('הקמפוס אינו נעול');
  (edit.hasClose && edit.hasDel) ? ok('יש כפתורי סגירה ומחיקה') : bad('כפתורים חסרים');

  await p.evaluate(() => { document.querySelector('#tzg-name').value = 'צהרון תמר';
                           document.querySelector('#tzg-name').dispatchEvent(new Event('input'));
                           document.querySelector('#tzg-save').click(); });
  await p.waitForTimeout(600);
  const renamed = await p.evaluate(i => tzGroupsOfYear().find(g => g.id === i).name, gid);
  renamed === 'צהרון תמר' ? ok('השם נשמר') : bad('השם לא נשמר: ' + renamed);

  await p.evaluate(id => document.querySelector(`[data-tzgrp="${id}"]`).click(), gid);
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#tzg-close').click());
  await p.waitForTimeout(600);
  const closed = await p.evaluate(i => ({ st: tzGroupsOfYear().find(g => g.id === i).status, c: tzPlan().openedCount }), gid);
  (closed.st === 'planned' && closed.c === 2)
    ? ok('סגירה מחזירה למצב "מתוכננת" ומורידה את מונה הפתוחות') : bad('הסגירה שגויה', [JSON.stringify(closed)]);

  console.log('\n6. קבוצה עם שיבוץ אינה נמחקת');
  const g1id = await p.evaluate(() => tzGroupsOfYear().find(g => g.ganIds[0] === 'g1').id);
  await p.evaluate(id => { DB.assignments['תשפ"ז'] = { tzaharon: { [id]: { 'סייעת': { staffId:'m1', name:'שרה' } } } }; }, g1id);
  await toScreen(p);
  await p.evaluate(id => document.querySelector(`[data-tzgrp="${id}"]`).click(), g1id);
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#tzg-del').click());
  await p.waitForTimeout(400);
  const kept = await p.evaluate(i => ({ exists: !!tzGroupsOfYear().find(g => g.id === i),
                                        toast: (document.querySelector('#toast')||{}).textContent || '' }), g1id);
  kept.exists ? ok('הקבוצה לא נמחקה') : bad('הקבוצה נמחקה למרות השיבוץ');
  /משובצים/.test(kept.toast) ? ok('ההודעה מסבירה למה') : bad('ההודעה שגויה: ' + kept.toast);

  /* הסרת השיבוץ ואז מחיקה */
  await p.evaluate(() => { DB.assignments['תשפ"ז'] = { tzaharon: {} }; });
  await toScreen(p);
  await p.evaluate(id => document.querySelector(`[data-tzgrp="${id}"]`).click(), g1id);
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#tzg-del').click());
  await p.waitForTimeout(600);
  const gone = await p.evaluate(i => ({ exists: !!tzGroupsOfYear().find(g => g.id === i), c: tzPlan().openableTotal }), g1id);
  !gone.exists ? ok('אחרי הסרת השיבוץ הקבוצה נמחקת') : bad('הקבוצה לא נמחקה');
  gone.c === 2 ? ok('גן הדקל חזר להיספר ב"ניתן לפתוח"') : bad('החישוב לא חזר: ' + gone.c);

  if (!errs.length) ok('אין שגיאות JavaScript'); else bad('שגיאות בעמוד', errs);

  await browser.close(); server.close();
  console.log('\n' + '─'.repeat(52));
  console.log(fail ? `❌ ${fail} בדיקות נכשלו` : '✅ כל הבדיקות עברו');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
