/* ============================================================================
   מסך הצהרון ולשונית המשנה — בדיקת דפדפן, בשני העיצובים
   ----------------------------------------------------------------------------
   טוענת את index.html האמיתי עם Firebase מדומה ומפעילה את המסך כמו משתמש:

     1. חץ לצד "תיקי התלמידות" בסרגל, ומתחתיו "צהרון" עם מונה הנרשמות.
     2. לחיצה על "צהרון" פותחת את המסך, ו"תיקי התלמידות" נשארת מסומנת.
     3. הכרטיסים מציגים את המספרים של tzPlan — ומתפרקים לפי חינוך.
     4. שורת המצב: נפתחו · ניתן לפתוח עוד · סה"כ אפשריות.
     5. טבלת הגנים: נרשמות מול המינימום, כמה חסר, ומצב.
     6. לחיצה על שורת גן פותחת את רשימת התלמידות — מי נרשמה ומי לא.
     7. סימון תלמידה מהרשימה מעדכן את התיק ואת הכרטיסים מיד.
     8. סינון "מצב רישום" מציג רק את מי שנרשמה / רק את מי שלא.
     9. הצעת צירוף מוצגת לשני גנים חסרים באותו קמפוס.
    10. כרטיס לחיץ מסנן למה שכתוב עליו.
    11. מסך התלמידות הרגיל נשאר נקי מנתוני הצהרון.

   הרצה:  NODE_PATH=$(npm root) node tests/tzaharon-screen.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית, לא נדרשת לשימוש בתוכנה).');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PORT = 8747;
const TMP  = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-tzs-'));

function buildApp() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/, '');
  html = html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g, '/__stub/fbstub.js');
  html = html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', '/__stub/noop.js');
  const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; else if(k==='currentUser')currentUser=v; else if(k==='db')db=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, tzPlan, tzLimits, closeModal });
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

/* ארבעה גנים, מינימום 15 ברגיל ו-8 בח"מ:
     g1 גן הדקל   · מרכז · רגיל · 18 נרשמות מתוך 20  → ניתן לפתוח
     g2 גן הרימון · מרכז · רגיל ·  9 נרשמות מתוך 12  ┐ יחד 17 → הצעת צירוף
     g3 גן הזית   · מרכז · רגיל ·  8 נרשמות מתוך 10  ┘
     g4 גן שקד    · צפון · ח"מ  ·  9 נרשמות מתוך 11  → ניתן לפתוח (מינימום 8) */
const PLAN = [['g1','גן הדקל','קמפוס מרכז','רגיל','4',20,18],
              ['g2','גן הרימון','קמפוס מרכז','רגיל','4',12,9],
              ['g3','גן הזית','קמפוס מרכז','רגיל','3',10,8],
              ['g4','גן שקד','קמפוס צפון','ח"מ','5',11,9]];
const SEED = `(() => {
  DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
  const plan=${JSON.stringify(PLAN)};
  DB.gans=plan.map(p=>({id:p[0],ganName:p[1],campus:p[2],education:p[3],age:p[4],active:true}));
  DB.students=[]; let n=0;
  plan.forEach(p=>{ for(let i=0;i<p[5];i++){ n++;
    DB.students.push({ id:'s'+n, year:'תשפ"ז', ganId:p[0], finished:false,
      firstName:'ילדה'+n, lastName:'כהן', tz:'20000000'+n, age:p[4], education:p[3],
      docs:{}, docFiles:{}, programs:{ tzaharon: i<p[6] }, programsPaid:{ tzaharon: i<3 },
      special:{}, support:{} }); } });
  DB.staff=[]; DB.management=[]; DB.assignments={}; DB.tzGroups={};
  DB.settings={ admins:['admin@test.org'], tzaharonLimits:{ 'רגיל':{min:15,max:25}, 'ח"מ':{min:8,max:14} } };
  __set('currentUser',{ email:'admin@test.org', uid:'u1' });
  __set('db', null);
  __set('eduPicked',true); __set('activeEdu',null);
  document.body.classList.remove('locked');
  return 'ok';
})()`;

let fail = 0;
const ok  = m => console.log('  ✅ ' + m);
const bad = (m, d) => { fail++; console.log('  ❌ ' + m); (d||[]).forEach(x => console.log('       ' + x)); };
const num = t => parseInt(String(t).replace(/[^\d]/g, ''), 10);

async function run(labOn) {
  const label = labOn ? 'העיצוב החדש (מעבדה)' : 'העיצוב הקיים';
  console.log('\n── ' + label + ' ' + '─'.repeat(Math.max(2, 40 - label.length)));

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
  if (!await p.evaluate(() => !!window.__ready)) { bad('טעינה נכשלה', errs); await browser.close(); return; }
  await p.evaluate(SEED);
  await p.evaluate(() => route());
  await p.waitForTimeout(600);

  /* --- 1. החץ ופריט המשנה בסרגל --- */
  const nav = await p.evaluate(() => {
    const caret = document.querySelector('#tabs [data-stunav]');
    const sub   = document.querySelector('#tabs #stuSubnav');
    const item  = sub && sub.querySelector('[data-tab="tzaharon"]');
    return { caret: !!caret, subHidden: sub ? sub.hasAttribute('hidden') : null,
             item: !!item, label: item ? item.textContent.replace(/\d+/g,'').trim() : '',
             count: item && item.querySelector('.count') ? item.querySelector('.count').textContent : '' };
  });
  nav.caret ? ok('יש חץ לצד "תיקי התלמידות"') : bad('אין חץ לצד התלמידות');
  nav.subHidden === true ? ok('הרשימה מקופלת כברירת מחדל') : bad('הרשימה אינה מקופלת');
  (nav.item && nav.label === 'צהרון') ? ok('הפריט "צהרון" ברשימה') : bad('הפריט חסר', [JSON.stringify(nav)]);
  /* 18+9+8+9 = 44 נרשמות */
  num(nav.count) === 44 ? ok('מונה הנרשמות על הפריט: 44') : bad('המונה שגוי: ' + nav.count);

  /* --- 2. פתיחת החץ ומעבר למסך --- */
  await p.evaluate(() => document.querySelector('#tabs [data-stunav]').click());
  await p.waitForTimeout(250);
  const opened = await p.evaluate(() => !document.querySelector('#tabs #stuSubnav').hasAttribute('hidden'));
  opened ? ok('החץ פורש את הרשימה') : bad('החץ לא פרש את הרשימה');

  await p.evaluate(() => document.querySelector('#tabs #stuSubnav [data-tab="tzaharon"]').click());
  await p.waitForTimeout(700);
  const onScreen = await p.evaluate(() => ({
    h2: (document.querySelector('#view h2')||{}).textContent,
    parentActive: !!document.querySelector('#tabs [data-tab="students"]').classList.contains('active'),
    subOpen: !document.querySelector('#tabs #stuSubnav').hasAttribute('hidden'),
    itemOn: !!document.querySelector('#tabs [data-tab="tzaharon"]').classList.contains('on')
  }));
  onScreen.h2 === 'צהרון' ? ok('מסך הצהרון נפתח') : bad('המסך לא נפתח', [JSON.stringify(onScreen)]);
  onScreen.parentActive ? ok('"תיקי התלמידות" נשארת מסומנת') : bad('לשונית האב אינה מסומנת');
  onScreen.subOpen ? ok('הרשימה נשארת פרושה') : bad('הרשימה נסגרה');
  onScreen.itemOn ? ok('הפריט "צהרון" מסומן כפעיל') : bad('הפריט אינו מסומן');

  /* --- 3. הכרטיסים --- */
  const cards = await p.evaluate(() => [...document.querySelectorAll('#tzCards .stat')].map(c => ({
    k: c.querySelector('.k').textContent.trim(),
    v: c.querySelector('.v').textContent.trim(),
    sub: (c.querySelector('.hint')||{}).textContent || ''
  })));
  const byK = Object.fromEntries(cards.map(c => [c.k, c]));
  num(byK['נרשמות לצהרון'] && byK['נרשמות לצהרון'].v) === 44
    ? ok('כרטיס הנרשמות: 44') : bad('כרטיס הנרשמות שגוי', [JSON.stringify(cards)]);
  /* g1 עצמאי + g4 עצמאי + צירוף g2+g3 = 3 */
  num(byK['ניתן לפתוח עכשיו'] && byK['ניתן לפתוח עכשיו'].v) === 3
    ? ok('ניתן לפתוח: 3 (2 עצמאיות · 1 מצורפת)') : bad('"ניתן לפתוח" שגוי', [JSON.stringify(byK['ניתן לפתוח עכשיו'])]);
  /(2 עצמאיות).*(1 מצורפ)/.test(byK['ניתן לפתוח עכשיו'].sub)
    ? ok('שורת הפירוט מפרקת עצמאיות מול מצורפות') : bad('הפירוט שגוי: ' + byK['ניתן לפתוח עכשיו'].sub);
  num(byK['קבוצות שנפתחו'].v) === 0 ? ok('נפתחו: 0') : bad('"נפתחו" שגוי');
  num(byK['גנים מתחת למינימום'].v) === 0
    ? ok('מתחת למינימום: 0 (השניים החסרים ניתנים לצירוף)') : bad('"מתחת למינימום" שגוי: ' + byK['גנים מתחת למינימום'].v);
  /רגיל 35 · ח"מ 9/.test(byK['נרשמות לצהרון'].sub)
    ? ok('פירוק הנרשמות לפי חינוך: רגיל 35 · ח"מ 9') : bad('פירוק החינוך שגוי: ' + byK['נרשמות לצהרון'].sub);

  /* --- 4. שורת המצב --- */
  const status = await p.evaluate(() => document.querySelector('#tzStatus').textContent.replace(/\s+/g,' ').trim());
  /נפתחו 0 · ניתן לפתוח עוד 3 · סה"כ אפשריות 3/.test(status)
    ? ok('שורת המצב: נפתחו 0 · ניתן לפתוח עוד 3 · סה"כ 3') : bad('שורת המצב שגויה', [status]);

  /* --- 5. טבלת הגנים --- */
  const rows = await p.evaluate(() => [...document.querySelectorAll('[data-tzgan-row]')].map(tr => {
    const td = [...tr.querySelectorAll('td')].map(x => x.textContent.trim());
    return { gan: td[0].replace(/[▸▾]/g,'').trim(), campus: td[1], age: td[2], edu: td[3],
             reg: td[4], gap: td[5], state: td[6] };
  }));
  rows.length === 4 ? ok('ארבע שורות גנים') : bad('מספר השורות שגוי: ' + rows.length);
  const r1 = rows.find(r => r.gan === 'גן הדקל');
  (r1 && r1.reg === '18/15' && r1.state === 'ניתן לפתוח')
    ? ok('גן הדקל: 18/15 · ניתן לפתוח') : bad('שורת גן הדקל שגויה', [JSON.stringify(r1)]);
  const r2 = rows.find(r => r.gan === 'גן הרימון');
  (r2 && r2.reg === '9/15' && r2.state === 'ניתן בצירוף')
    ? ok('גן הרימון: 9/15 · ניתן בצירוף') : bad('שורת גן הרימון שגויה', [JSON.stringify(r2)]);
  const r4 = rows.find(r => r.gan === 'גן שקד');
  (r4 && r4.reg === '9/8' && r4.state === 'ניתן לפתוח')
    ? ok('גן שקד (ח"מ): 9/8 · ניתן לפתוח לפי המינימום שלו')
    : bad('שורת גן שקד שגויה', [JSON.stringify(r4)]);

  /* --- 6. הצעת הצירוף --- */
  const merge = await p.evaluate(() => {
    const box = document.querySelector('#tzMergeBox');
    return { txt: box ? box.textContent.replace(/\s+/g,' ') : '', cards: box ? box.querySelectorAll('.stat').length : 0 };
  });
  merge.cards === 1 ? ok('הצעת צירוף אחת') : bad('מספר ההצעות שגוי: ' + merge.cards);
  (/גן הרימון/.test(merge.txt) && /גן הזית/.test(merge.txt) && /סה"כ 17/.test(merge.txt))
    ? ok('ההצעה: גן הרימון + גן הזית = 17') : bad('תוכן ההצעה שגוי', [merge.txt.slice(0, 200)]);
  !/גן שקד/.test(merge.txt) ? ok('גן ח"מ אינו בהצעה של הרגיל') : bad('ההצעה חצתה סוגי חינוך');

  /* --- 7. פתיחת רשימת התלמידות של גן --- */
  await p.evaluate(() => document.querySelector('[data-tzgan-row="g2"]').click());
  await p.waitForTimeout(400);
  const stu = await p.evaluate(() => {
    const tr = document.querySelector('.tz-stu-row');
    if (!tr) return null;
    return { head: tr.querySelector('.hint').textContent.replace(/\s+/g,' ').trim(),
             rows: tr.querySelectorAll('input[data-tztoggle]').length,
             checked: tr.querySelectorAll('input[data-tztoggle]:checked').length };
  });
  stu ? ok('לחיצה על שורת גן פותחת את רשימת התלמידות') : bad('הרשימה לא נפתחה');
  (stu && stu.rows === 12) ? ok('12 תלמידות בגן הרימון') : bad('מספר התלמידות שגוי', [JSON.stringify(stu)]);
  (stu && stu.checked === 9) ? ok('9 מסומנות כנרשמות, 3 לא') : bad('הסימונים שגויים', [JSON.stringify(stu)]);
  (stu && /9 נרשמו · 3 לא נרשמו/.test(stu.head)) ? ok('כותרת: 9 נרשמו · 3 לא נרשמו') : bad('הכותרת שגויה', [stu && stu.head]);

  /* --- 8. סימון תלמידה מעדכן מיד --- */
  await p.evaluate(() => {
    const cbs = [...document.querySelectorAll('.tz-stu-row input[data-tztoggle]')].filter(c => !c.checked);
    cbs[0].checked = true; cbs[0].dispatchEvent(new Event('change'));
  });
  await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({
    total: parseInt(document.querySelector('#tzCards .stat .v').textContent, 10),
    reg: (() => { const tr = [...document.querySelectorAll('[data-tzgan-row="g2"]')][0];
                  return tr ? tr.querySelectorAll('td')[4].textContent.trim() : ''; })(),
    status: document.querySelector('#tzStatus').textContent.replace(/\s+/g,' ').trim()
  }));
  after.total === 45 ? ok('סימון תלמידה מעלה את המונה ל-45') : bad('המונה לא עודכן: ' + after.total);
  after.reg === '10/15' ? ok('שורת הגן התעדכנה ל-10/15') : bad('שורת הגן לא התעדכנה: ' + after.reg);

  /* --- 9. סינון "מצב רישום" --- */
  await p.evaluate(() => { document.querySelector('#tzFilterToggle').click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const s = document.querySelector('#tzf-reg'); s.value = 'no'; s.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(400);
  const onlyNo = await p.evaluate(() => {
    const tr = document.querySelector('.tz-stu-row');   /* השורה כבר פרושה מהשלב הקודם */
    return tr ? { rows: tr.querySelectorAll('input[data-tztoggle]').length,
                  checked: tr.querySelectorAll('input[data-tztoggle]:checked').length } : null;
  });
  (onlyNo && onlyNo.rows === 2 && onlyNo.checked === 0)
    ? ok('סינון "לא נרשמה" מציג רק את השתיים שנותרו') : bad('הסינון שגוי', [JSON.stringify(onlyNo)]);

  await p.evaluate(() => { const s = document.querySelector('#tzf-reg'); s.value = ''; s.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(300);

  /* --- 10. כרטיס לחיץ --- */
  await p.evaluate(() => document.querySelector('[data-tzcard="openable"]').click());
  await p.waitForTimeout(500);
  const filtered = await p.evaluate(() => ({
    rows: [...document.querySelectorAll('[data-tzgan-row]')].map(tr => tr.dataset.tzganRow),
    sel: (document.querySelector('#tzf-state')||{}).value
  }));
  (filtered.sel === 'openable' && filtered.rows.length === 2 && filtered.rows.includes('g1') && filtered.rows.includes('g4'))
    ? ok('לחיצה על "ניתן לפתוח" מסננת לשני הגנים העצמאיים')
    : bad('הסינון מהכרטיס שגוי', [JSON.stringify(filtered)]);
  await p.evaluate(() => document.querySelector('[data-tzcard="openable"]').click());
  await p.waitForTimeout(400);

  /* --- 11. מסך התלמידות נשאר נקי --- */
  await p.evaluate(() => { __set('active','students'); route(); });
  await p.waitForTimeout(700);
  const clean = await p.evaluate(() => {
    const v = document.querySelector('#view');
    return { tzCards: !!v.querySelector('#tzCards'), tzGans: !!v.querySelector('#tzGansBox'),
             stuTable: !!v.querySelector('#stuTable') };
  });
  (clean.stuTable && !clean.tzCards && !clean.tzGans)
    ? ok('מסך התלמידות נקי מנתוני הצהרון') : bad('נתוני הצהרון דלפו למסך התלמידות', [JSON.stringify(clean)]);

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
