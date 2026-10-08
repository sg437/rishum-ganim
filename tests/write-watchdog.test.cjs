/* ============================================================================
   בדיקת "שומר-זמן לכתיבה" (write watchdog)
   ----------------------------------------------------------------------------
   התקלה: עובדת מזינה נתונים, האינטרנט תקין — ושום דבר לא נקלט חצי שעה.
   הסיבה: כתיבה ל-Firestore שההבטחה שלה לא מסתיימת לעולם (ערוץ הכתיבה של
   ה-SDK תקוע). בלי גבול-זמן savePending נשאר דלוק לנצח, הניסיון-החוזר חסום,
   והעריכה יושבת במכשיר עד רענון.

   כאן נבדק — על הקוד שנשלף מ-index.html עצמו (runPush, _withTimeout, _assertGen,
   _captureBase, _setBase) — ש:
     1. כתיבה תקועה משתחררת אחרי PUSH_TIMEOUT_MS ומסומנת ככשל (לא "מסנכרן" נצחי).
     2. הניסיון הבא עוקף את ה-SDK וכותב ב-REST.
     3. הדחיפה התקועה, כשהיא "מתעוררת" מאוחר, לא כותבת ולא מזיזה את בסיס-ההשוואה.
     4. שמירה באמצע דחיפה לא רצה במקביל — היא רצה מיד אחריה, והעריכה לא אובדת.
   סימולציה טהורה ב-Node, בלי רשת.   הרצה:  node tests/write-watchdog.test.cjs
   ============================================================================ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function grab(decl){
  const at = SRC.indexOf(decl);
  if(at < 0) throw new Error('לא נמצא ב-index.html: ' + decl);
  let i = SRC.indexOf('{', at), depth = 0, inLine = false, inBlock = false, q = '', esc = false;
  for(let j = i; j < SRC.length; j++){
    const c = SRC[j], n = SRC[j+1];
    if(esc){ esc = false; continue; }
    if(q){ if(c === '\\') esc = true; else if(c === q) q = ''; continue; }
    if(inLine){ if(c === '\n') inLine = false; continue; }
    if(inBlock){ if(c === '*' && n === '/'){ inBlock = false; j++; } continue; }
    if(c === '/' && n === '/'){ inLine = true; j++; continue; }
    if(c === '/' && n === '*'){ inBlock = true; j++; continue; }
    if(c === '"' || c === "'" || c === '`'){ q = c; continue; }
    if(c === '{') depth++;
    else if(c === '}'){ depth--; if(!depth) return SRC.slice(at, j+1); }
  }
  throw new Error('סוגריים לא מאוזנים אחרי: ' + decl);
}
const line = d => { const a = SRC.indexOf(d); if(a<0) throw new Error('לא נמצא: '+d); return SRC.slice(a, SRC.indexOf('\n', a)); };

const code = [
  line('const PUSH_TIMEOUT_MS'),
  line('const SDK_STUCK_FALLBACK_MS'),
  line('let _pushInFlight=false'),
  line('function _pushProgress('),
  grab('function _withTimeout('),
  grab('function _assertGen('),
  grab('function _captureBase('),
  line('function _setBase('),
  grab('async function runPush('),
].join('\n')
 // קיצור הזמנים לבדיקה (25ש' → 200ms)
 .replace(/const PUSH_TIMEOUT_MS = \d+;/, 'const PUSH_TIMEOUT_MS = 200;');

const log = [];
const ctx = {
  console:{ error(){} , log(){} }, setTimeout, clearTimeout, Promise, Date, Map, Set, JSON, Math, Error, Object,
  navigator:{ onLine:true },
  RESILIENT_SAVE:true, TEST_DB_MODE:false, restMode:false, savePending:false,
  lastSaveError:null, _lastSaveErrShown:"", _saveFailed:false,
  _pending:new Map(), _mergeBase:{ stu:new Map(), gan:new Map(), staff:new Map(), mgmt:new Map() },
  DB:{ students:[], gans:[], staff:[], management:[] },
  cloudDocs:new Map(),
  _mk:o=>JSON.stringify(o),
  recordPending(){}, dlog(){}, toast(){}, saveErrIsHard(){ return false; },
  setSyncStatus(s){ log.push('status:'+s); }, rebuildDB(){}, applyPending(){}, applyGuard(){},
  refreshPendingState(){ log.push('refreshed'); }, armConfirmSafety(){}, scheduleRetry(){ log.push('retry'); },
  route(){}, $:()=>({ classList:{ contains:()=>false } }),
  pendingRender:false,
};
// pushAll המדומה: SDK או REST, לפי _sdkStuckUntil (כמו ב-index.html)
let sdkMode = 'ok', pushCalls = [], hangResolvers = [];
ctx.pushAll = async function(gen){
  const viaRest = Date.now() < ctx._sdkStuckUntil;
  pushCalls.push({ gen, viaRest, at:Date.now() });
  if(sdkMode === 'slow'){ // ייבוא גדול ברשת איטית: 5 מסמכים × 120ms (סה"כ > גבול-הזמן, אבל מתקדם)
    for(let i=0;i<5;i++){ await new Promise(r => setTimeout(r, 120)); ctx._pushProgress(gen); }
    ctx._assertGen(gen); ctx._setBase(ctx._captureBase()); return;
  }
  if(!viaRest && sdkMode === 'hang'){
    // נתקע: ממתין "לנצח" — ובסוף מתעורר כמו ש-mergePushSDK היה מתעורר
    await new Promise(r => hangResolvers.push(r));
    ctx._assertGen(gen);
    ctx._setBase(ctx._captureBase()); log.push('stale-wrote'); return;
  }
  await new Promise(r => setTimeout(r, 20));
  ctx._assertGen(gen);
  ctx._setBase(ctx._captureBase());
};
vm.createContext(ctx);
vm.runInContext(code + `
  ;this.runPush=runPush; this._assertGen=_assertGen; this._captureBase=_captureBase; this._setBase=_setBase; this._pushProgress=_pushProgress;
  Object.defineProperty(this,'_sdkStuckUntil',{ get:()=>_sdkStuckUntil });
  Object.defineProperty(this,'_pushInFlight',{ get:()=>_pushInFlight });
  Object.defineProperty(this,'_pushGen',{ get:()=>_pushGen });
`, ctx);

let pass = 0, fail = 0;
const check = (name, cond, detail) => { if(cond){ pass++; console.log('  ✓ '+name); } else { fail++; console.log('  ✗ '+name+(detail?'  → '+detail:'')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('1) כתיבה תקועה — משתחררת אחרי גבול-הזמן ומסומנת ככשל');
  sdkMode = 'hang'; ctx.savePending = true;
  ctx.DB.students = [{ id:'s1', year:'2026', note:'הוזן' }];
  const t0 = Date.now();
  await ctx.runPush();
  check('runPush חזר (לא נתקע לנצח)', Date.now() - t0 < 1000, (Date.now()-t0)+'ms');
  check('savePending כבוי — ניסיון-חוזר וסנאפשוטים לא חסומים', ctx.savePending === false);
  check('מסומן "טרם נשמר"', ctx._saveFailed === true);
  check('תוזמן ניסיון-חוזר', log.includes('retry'));
  check('קוד השגיאה rg-timeout', ctx.lastSaveError && ctx.lastSaveError.code === 'rg-timeout');
  check('ה-SDK סומן תקוע → הבאים דרך REST', ctx._sdkStuckUntil > Date.now());
  check('בסיס-ההשוואה לא זז (העריכה עדיין "שינוי")', !ctx._mergeBase.stu.has('s1'));

  console.log('2) הניסיון הבא — עוקף את ה-SDK וכותב ב-REST');
  ctx.savePending = true; log.length = 0;
  await ctx.runPush();
  const last = pushCalls[pushCalls.length-1];
  check('נכתב דרך REST', last.viaRest === true);
  check('הצליח — לא מסומן כשל', ctx._saveFailed === false && log.includes('refreshed'));
  check('בסיס-ההשוואה עודכן לעריכה', ctx._mergeBase.stu.has('s1'));

  console.log('3) הדחיפה התקועה מתעוררת מאוחר — לא כותבת');
  ctx.DB.students = [{ id:'s1', year:'2026', note:'עריכה חדשה יותר' }];
  const baseBefore = ctx._mergeBase.stu.get('s1').j;
  log.length = 0;
  hangResolvers.forEach(r => r()); await sleep(10);
  check('לא נכתב דבר מהדחיפה הישנה', !log.includes('stale-wrote'));
  check('בסיס-ההשוואה לא הוזז ע"י הדחיפה הישנה', ctx._mergeBase.stu.get('s1').j === baseBefore);

  console.log('4) שמירה באמצע דחיפה — רצה מיד אחריה, לא במקביל, והעריכה לא אובדת');
  sdkMode = 'ok'; pushCalls = []; ctx.savePending = true;
  ctx.DB.students = [{ id:'s1', year:'2026', note:'א' }];
  const p1 = ctx.runPush();
  check('דחיפה ראשונה בטיסה', ctx._pushInFlight === true);
  ctx.DB.students = [{ id:'s1', year:'2026', note:'א' }, { id:'s2', year:'2026', note:'ב (נוסף באמצע)' }];
  await ctx.runPush(); // השמירה השנייה — לא אמורה לרוץ במקביל
  check('לא רצו שתי דחיפות במקביל', pushCalls.length === 1);
  check('savePending נשאר דלוק עד סוף הכול', ctx.savePending === true);
  await p1; await sleep(100);
  check('הדחיפה השנייה רצה אחריה', pushCalls.length === 2);
  check('savePending כבה בסוף', ctx.savePending === false);
  check('העריכה שנוספה באמצע נכנסה לבסיס (נכתבה)', ctx._mergeBase.stu.has('s2'));

  console.log('5) דחיפה איטית שמתקדמת (ייבוא גדול) — לא נקטעת');
  sdkMode = 'slow'; ctx.savePending = true; ctx.lastSaveError = null;
  ctx.DB.students = [{ id:'big', year:'2026' }];
  const t1 = Date.now();
  await ctx.runPush();
  check('נמשכה יותר מגבול-הזמן', Date.now() - t1 > 400, (Date.now()-t1)+'ms');
  check('הסתיימה בהצלחה (לא סומנה כתקועה)', ctx._saveFailed === false && !ctx.lastSaveError);
  check('נכתבה', ctx._mergeBase.stu.has('big'));

  console.log('6) מבנה הכתיבה ב-index.html — בסיס נלכד בתחילת הדחיפה, meta לא חוסם, מעבר ל-REST');
  const sdk = grab('async function mergePushSDK(');
  check('mergePushSDK לוכד את הבסיס לפני הכתיבה', /const after=_captureBase\(\);[\s\S]*runTransaction|const after=_captureBase\(\);[\s\S]*_txnMerge/.test(sdk));
  check('mergePushSDK מעדכן בסיס מהלכידה ולא מה-DB הנוכחי', /_setBase\(after\)/.test(sdk) && !/refreshMergeBase\(\)/.test(sdk));
  check('mergePushSDK לא ממתין ל-meta לפני הרשומות', sdk.indexOf('await _txnMergeSimple') < sdk.indexOf('await _settleOrQueued(metaP'));
  const rest = grab('async function mergePushRest(');
  check('mergePushRest לוכד ומעדכן בסיס מהלכידה', /const after=_captureBase\(\)/.test(rest) && /_setBase\(after\)/.test(rest));
  check('pushAll עובר ל-REST כשה-SDK נתקע', /Date\.now\(\)<_sdkStuckUntil\)\{ await mergePushRest\(gen\)/.test(grab('async function pushAll(')));

  console.log(`\n${pass} עברו · ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
