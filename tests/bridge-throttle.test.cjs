/* ============================================================================
   בדיקות לתור הקריאות לגשר (index.html) — הרצות בו-זמניות
   ----------------------------------------------------------------------------
   Apps Script מגביל ל-1,000 הרצות בו-זמנית — לכל הפרויקט, כל המשתמשות יחד.
   לשונית אחת יודעת לפתוח עשרות קריאות במקביל (ייבוא מסמכים, סנכרון תיקיות),
   וכל אחת מהן נספרת. הבדיקה שולפת את קוד התור האמיתי מתוך index.html (בלי
   להעתיק אותו), מריצה אותו מול fetch מדומה, ומוודאת:
     • לא יותר מ-DRIVE_MAX_INFLIGHT קריאות רצות יחד — והשאר ממתינות בתור;
     • קריאות *קריאה* זהות שנשלחו יחד מתאחדות לקריאה אחת לגשר;
     • קריאות שכותבות (upload וכד') לעולם אינן מתאחדות;
     • תשובת עומס (429 / דף שגיאה של Google) גוררת ניסיון חוזר בהמתנה עולה,
       ולא כישלון מול המשתמשת.

   אין כאן שום גישה לרשת — סימולציה טהורה ב-Node.
   הרצה:  node tests/bridge-throttle.test.cjs
   ============================================================================ */
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*\btype="module"[^>]*>([\s\S]*?)<\/script>/;
const code = (re.exec(html) || [])[1] || null;
if(!code) throw new Error('לא נמצא הסקריפט הראשי');

/* חותכים את קטע התור בשלמותו — מהקבועים ועד סוף driveSend */
const from = code.indexOf('const DRIVE_MAX_INFLIGHT');
if(from < 0) throw new Error('not found: DRIVE_MAX_INFLIGHT');
const sendAt = code.indexOf('async function driveSend(', from);
if(sendAt < 0) throw new Error('not found: driveSend');
const end = code.indexOf('\n}', code.indexOf('throw new Error("drive-error");', sendAt));
const src = code.slice(from, end + 2);

let ok = 0;
function check(name, cond){ if(!cond) throw new Error('נכשל: ' + name); ok++; console.log('  ✓ ' + name); }
const tick = () => new Promise(r => setImmediate(r));
async function settle(n){ for(let i = 0; i < (n || 30); i++) await tick(); }

function makeCtx(respond){
  const st = { started:0, active:0, peak:0, waits:[], urls:[] };
  const ctx = {
    console, st,
    DRIVE_READY: true,
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TEST/exec',
    cityBridgeArgs: () => ({ cityId:'modiin-illit', cityName:'מודיעין עילית' }),
    driveIdToken: async () => 'tok',
    setTimeout: (fn, ms) => { st.waits.push(ms); setImmediate(fn); },
    JSON, Object, Map, Promise, Error, encodeURIComponent,
    async fetch(url){
      st.started++; st.active++; st.peak = Math.max(st.peak, st.active);
      st.urls.push(url);
      const res = await respond(st.started, url);
      st.active--;
      return { status: res.status || 200, text: async () => res.body };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  // ההצהרות const נשארות בתחום הלקסיקלי של ההקשר ולא הופכות לשדות של ctx
  ctx.MAX = vm.runInContext('DRIVE_MAX_INFLIGHT', ctx);
  return ctx;
}
const okJson = JSON.stringify({ ok:true, files:[] });

console.log('— תור הקריאות לגשר —');

/* 1. תקרת קריאות בו-זמניות */
(async () => {
  const gate = [];                                   // תשובות שמשוחררות ידנית
  const c = makeCtx(() => new Promise(res => gate.push(() => res({ body: okJson }))));
  const all = [];
  for(let i = 0; i < 12; i++) all.push(c.driveCall('upload', { folderId:'f'+i, name:'a'+i }));
  await settle();
  check('לא יותר מ-4 קריאות רצות יחד', c.st.started === c.MAX && c.st.peak === c.MAX);
  check('השאר ממתינות בתור', c.st.started < 12);
  while(gate.length || c.st.started < 12){ (gate.shift() || (()=>{}))(); await settle(3); }
  const res = await Promise.all(all);
  check('כל 12 הקריאות הושלמו', res.length === 12 && res.every(r => r.ok === true));
  check('כל אחת נשלחה בדיוק פעם אחת', c.st.started === 12);

  /* 2. איחוד קריאות־קריאה זהות */
  const c2 = makeCtx(async () => ({ body: okJson }));
  const same = await Promise.all([1,2,3,4,5].map(() => c2.driveCall('list', { folderId:'same' })));
  check('חמש בקשות "list" זהות → קריאה אחת לגשר', c2.st.started === 1);
  check('כולן קיבלו את אותה תשובה', same.every(r => r === same[0]));
  await Promise.all([ c2.driveCall('list', { folderId:'a' }), c2.driveCall('list', { folderId:'b' }) ]);
  check('תיקיות שונות — קריאות נפרדות', c2.st.started === 3);
  await c2.driveCall('list', { folderId:'same' });
  check('אחרי שהסתיימה — בקשה חדשה נשלחת שוב (אין מטמון תוצאה)', c2.st.started === 4);

  /* 3. פעולות שכותבות לעולם אינן מתאחדות */
  const c3 = makeCtx(async () => ({ body: JSON.stringify({ ok:true, id:'x' }) }));
  await Promise.all([1,2,3].map(() => c3.driveCall('upload', { folderId:'f', name:'זהה.pdf' })));
  check('שלוש העלאות זהות → שלוש קריאות', c3.st.started === 3);

  /* 4. עומס בגשר — ניסיון חוזר בהמתנה עולה */
  const c4 = makeCtx(async (n) => (n <= 2
    ? { status:429, body:'<html>Service invoked too many times</html>' }
    : { body: okJson }));
  const r4 = await c4.driveCall('list', { folderId:'busy' });
  check('תשובת עומס → ניסיון חוזר עד הצלחה', r4.ok === true && c4.st.started === 3);
  check('ההמתנה בין הניסיונות עולה', c4.st.waits.length === 2 && c4.st.waits[1] > c4.st.waits[0]);

  /* 5. שגיאת תוכן אמיתית — נכשלת מיד, בלי ניסיונות מיותרים */
  const c5 = makeCtx(async () => ({ body: JSON.stringify({ ok:false, error:'not-allowed' }) }));
  let err = null;
  try{ await c5.driveCall('list', { folderId:'x' }); }catch(e){ err = e; }
  check('שגיאת הרשאה מוחזרת כמות שהיא', err && /not-allowed/.test(err.message) && c5.st.started === 1);

  /* 6. תור פנוי אחרי כישלון — קריאה שנכשלה אינה תופסת מקום לנצח */
  const c6 = makeCtx(async (n) => (n === 1
    ? { body: JSON.stringify({ ok:false, error:'boom' }) }
    : { body: okJson }));
  try{ await c6.driveCall('list', { folderId:'1' }); }catch(e){}
  const after = await Promise.all([1,2,3,4,5,6].map(i => c6.driveCall('list', { folderId:'n'+i })));
  check('אחרי כישלון התור ממשיך לזרום', after.length === 6 && c6.st.started === 7);

  console.log('\n✅ כל הבדיקות עברו (' + ok + ')');
})().catch(e => { console.error('\n❌ ' + e.message); process.exit(1); });
