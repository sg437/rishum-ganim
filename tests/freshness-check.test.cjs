/* ============================================================================
   בדיקת "בקרת אמת" + "עדכון-גרסה אוטומטי"
   ----------------------------------------------------------------------------
   התקלה: עובדת עדכנה במשרד, פתחה בבית — ולא ראתה את העדכונים גם אחרי כמה
   סגירות ופתיחות. המאזין החי של Firestore נתקע בשקט ומציג מטמון ישן, בלי שגיאה.

   כאן נבדק — על הקוד שנשלף מ-index.html עצמו — ש:
     1. כשהשרת (REST) מקדים את מה שהמאזין הביא → חיבור מחדש, ואם לא עזר → REST.
     2. כשהשרת שווה / מאחר (השינוי האחרון שלנו) → שום פעולה.
     3. סנאפשוט שמגיע בתוך זמן-החסד → שום פעולה (לא "מרפאים" סתם).
     4. עדכון-גרסה: תגית זהה → כלום · תגית חדשה בלשונית מוסתרת → טעינה מחדש ·
        תגית חדשה באמצע הקלדה / עם שינויים ממתינים → כפתור "עדכון זמין" בלבד.
   סימולציה טהורה ב-Node, בלי רשת.   הרצה:  node tests/freshness-check.test.cjs
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
  line('const FRESH_START_MS'), line('const FRESH_GRACE_MS'), line('const FRESH_REST_AFTER_MS'),
  line('let _lastServerSnapAt=0'),
  grab('async function _serverUpdatedAt('), grab('function _localUpdatedAt('),
  line('function _raceTimeout('), grab('async function _reconnectFirestore('), line('const _sleep ='),
  grab('async function verifyFreshness('), grab('function _paintVerified('),
  line('const APP_UPDATE_CHECK_MS'), line('let _appTag=null'),
  grab('async function _appVersionTag('), grab('async function checkAppUpdate('),
  grab('function _userMidWork('), grab('function maybeApplyUpdate('), grab('function _showUpdatePill('),
].join('\n')
 .replace(/const FRESH_GRACE_MS = \d+;/, 'const FRESH_GRACE_MS = 60;')
 .replace(/const FRESH_REST_AFTER_MS = \d+;/, 'const FRESH_REST_AFTER_MS = 120;');

const log = [];
let serverUpdatedAt = 0, etag = 'v1', hidden = false, activeTag = 'BODY', overlayShown = false;
const ctx = {
  console:{ error(){}, log(){} }, setTimeout, clearTimeout, Promise, Date, Map, JSON, Error, URL, Number,
  navigator:{ onLine:true }, location:{ href:'https://example.test/app/', reload(){ log.push('reload'); } },
  document:{ get visibilityState(){ return hidden?'hidden':'visible'; }, get activeElement(){ return { tagName:activeTag, isContentEditable:false }; },
             querySelector(){ return { appendChild(b){ log.push('pill:'+b.id); } }; }, createElement(){ return {}; } },
  TEST_DB_MODE:false, currentUser:{ email:'a@b.c' }, db:{}, CITY:{ id:'c' }, restMode:false,
  cloudDocs:new Map(), _pending:new Map(), savePending:false, _pushInFlight:false, _syncState:'synced',
  async _restHdr(){ return {}; }, cityRestBase(){ return 'https://fs/cities/c/app'; },
  decFsFields(f){ return { updatedAt: f.updatedAt ? +f.updatedAt.integerValue : undefined }; },
  async fetch(url, opt){
    if(opt && opt.method==='HEAD') return { ok:true, headers:{ get:k=>k==='etag'?etag:null } };
    log.push('rest-get');
    return { ok:true, status:200, json:async()=>({ fields:{ updatedAt:{ integerValue:String(serverUpdatedAt) } } }) };
  },
  async disableNetwork(){ log.push('disable'); }, async enableNetwork(){ log.push('enable'); },
  loadViaRest(){ log.push('loadViaRest'); }, toast(m){ log.push('toast'); }, dlog(){},
  $:(sel)=> sel==='#overlay' ? { classList:{ contains:()=>overlayShown } } : (sel==='#updatePill' ? null : null),
};
vm.createContext(ctx);
vm.runInContext(code + `
  ;this.verifyFreshness=verifyFreshness; this.checkAppUpdate=checkAppUpdate; this.maybeApplyUpdate=maybeApplyUpdate;
`, ctx);

let pass = 0, fail = 0;
const check = (name, cond, detail) => { if(cond){ pass++; console.log('  ✓ '+name); } else { fail++; console.log('  ✗ '+name+(detail?'  → '+detail:'')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setLocal = at => ctx.cloudDocs.set('meta', { updatedAt: at });

(async () => {
  console.log('1) השרת מקדים את המאזין → חיבור מחדש → עדיין מאחר → REST');
  setLocal(1000); serverUpdatedAt = 2000; log.length = 0;
  await ctx.verifyFreshness('t');
  check('נשאל השרת ישירות (REST)', log.includes('rest-get'));
  check('חיבור מחדש של Firestore', log.includes('disable') && log.includes('enable'));
  check('הריפוי שקט — בלי הודעה קופצת', !log.includes('toast'));
  check('עוד לא REST (מחכים לחיבור מחדש)', !log.includes('loadViaRest'));
  await sleep(200);
  check('עדיין מאחר אחרי החיבור מחדש → טעינה ישירה דרך REST', log.includes('loadViaRest'));

  console.log('2) חיבור מחדש עזר (הסנאפשוט הגיע) → בלי REST');
  setLocal(1000); serverUpdatedAt = 2000; log.length = 0;
  const p = ctx.verifyFreshness('t');
  await sleep(100); setLocal(2000); // הסנאפשוט הגיע אחרי החיבור מחדש
  await p; await sleep(200);
  check('בוצע חיבור מחדש', log.includes('enable'));
  check('לא עברו ל-REST', !log.includes('loadViaRest'));

  console.log('3) שווים / השינוי האחרון שלנו → שום פעולה');
  setLocal(5000); serverUpdatedAt = 5000; log.length = 0;
  await ctx.verifyFreshness('t');
  check('שווים: בלי חיבור מחדש', !log.includes('disable') && !log.includes('loadViaRest'));
  setLocal(6000); serverUpdatedAt = 5000; log.length = 0;
  await ctx.verifyFreshness('t');
  check('המקומי מקדים (כתיבה שלנו בדרך): בלי פעולה', !log.includes('disable') && !log.includes('loadViaRest'));

  console.log('4) סנאפשוט שמגיע בתוך זמן-החסד → לא "מרפאים" סתם');
  setLocal(1000); serverUpdatedAt = 2000; log.length = 0;
  const p2 = ctx.verifyFreshness('t'); await sleep(20); setLocal(2000); await p2; await sleep(150);
  check('בלי חיבור מחדש ובלי REST', !log.includes('disable') && !log.includes('loadViaRest'));

  console.log('5) לא רצים כשאין משתמש / במצב REST / בלי רשת');
  log.length = 0; setLocal(1000); serverUpdatedAt = 2000;
  ctx.restMode = true; await ctx.verifyFreshness('t'); ctx.restMode = false;
  ctx.navigator.onLine = false; await ctx.verifyFreshness('t'); ctx.navigator.onLine = true;
  check('בלי בקשות', !log.includes('rest-get'));

  console.log('6) עדכון-גרסה אוטומטי');
  log.length = 0;
  await ctx.checkAppUpdate(); // לומד את התגית הנוכחית
  await ctx.checkAppUpdate();
  check('תגית זהה → כלום', !log.includes('reload') && !log.some(x=>x.startsWith('pill')));
  etag = 'v2'; hidden = true;
  await ctx.checkAppUpdate();
  check('תגית חדשה בלשונית מוסתרת → טעינה מחדש מיד', log.includes('reload'));
  log.length = 0; hidden = false; activeTag = 'INPUT';
  ctx.maybeApplyUpdate();
  check('באמצע הקלדה → כפתור "עדכון זמין", בלי טעינה', log.includes('pill:updatePill') && !log.includes('reload'));
  log.length = 0; activeTag = 'BODY'; ctx._pending.set('stu:x', {});
  ctx.maybeApplyUpdate();
  check('עם שינויים שטרם עלו → כפתור בלבד', log.includes('pill:updatePill') && !log.includes('reload'));
  log.length = 0; ctx._pending.clear();
  ctx.maybeApplyUpdate();
  check('פנוי → הודעה, ואז טעינה מחדש', log.includes('toast'));
  await sleep(2600);
  check('הטעינה מחדש בוצעה', log.includes('reload'));

  console.log('7) כל שמירה מסמנת meta.updatedAt (הבסיס להשוואה)');
  const mw = grab('function metaForWrite(');
  check('metaForWrite כותב updatedAt', /updatedAt:Date\.now\(\)/.test(mw));
  check('הדופק קורא לבקרת האמת', /verifyFreshness\("דופק"\)/.test(grab('function startPresence(')));
  check('חזרה ללשונית קוראת לבקרת האמת', /verifyFreshness\("חזרה ללשונית"\)/.test(SRC));
  check('אזהרת סגירה על כל עריכה שטרם עלתה', /if\(!RESILIENT_SAVE \|\| !_pending\.size\) return;/.test(SRC));

  console.log(`\n${pass} עברו · ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
