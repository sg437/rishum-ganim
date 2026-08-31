/* ============================================================================
   בדיקת "עריכה שורדת רענון" — הממתינים נשמרים בדפדפן
   ----------------------------------------------------------------------------
   התקלה שהבדיקה הזו נועדה למנוע: ייבוא אקסל גדול מהטלפון, הכתיבה לענן נכשלת,
   החיווי נתקע על "טרם נשמר" — ורענון מוחק את כל מה שיובא. הסיבה: _pending חי
   בזיכרון בלבד, ומכיוון שהמנעול-נגד-דריסה כותב ב-runTransaction (שאינו נכנס
   לתור הכתיבות של Firestore ב-IndexedDB) לא היה שום גיבוי מתחתיו.

   כאן נבדק המנגנון שנוסף: הצלה ל-localStorage לפני הכתיבה, ושחזור בטעינה הבאה
   עם אותו מיזוג תלת-כיווני. בנוסף נבדק מחשבון גודל המסמך מול תקרת Firestore,
   שהוא החשוד המרכזי בכשל כתיבה דווקא כשהמאגר גדל.

   הקוד *נשלף מ-index.html עצמו* (לא משוכפל), כדי שהבדיקה תיפול אם המימוש ישתנה.
   אין גישה ל-Firebase / לנתונים אמיתיים — סימולציה טהורה ב-Node.
   הרצה:  node tests/pending-survives-reload.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/* ---- שליפת גוף פונקציה/הצהרה מ-index.html לפי שם, בספירת סוגריים ---- */
function grab(decl){
  const at = SRC.indexOf(decl);
  if(at < 0) throw new Error('לא נמצא ב-index.html: ' + decl);
  let i = SRC.indexOf('{', at), depth = 0, inLine = false, inBlock = false;
  let q = '', esc = false;
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

/* ---- הצהרת-קבוע בשורה אחת (grab מיועד לגופים עם סוגריים מסולסלים) ---- */
function grabLine(decl){
  const at = SRC.indexOf(decl);
  if(at < 0) throw new Error('לא נמצא ב-index.html: ' + decl);
  const end = SRC.indexOf('\n', at);
  return SRC.slice(at, end < 0 ? SRC.length : end);
}

/* ---- ארגז חול: localStorage מזויף + המשתנים שהקוד הנשלף נשען עליהם ---- */
function makeSandbox(){
  const store = new Map();
  let failWrites = false;
  const sandbox = {
    RESILIENT_SAVE: true, TEST_DB_MODE: false,
    currentUser: null, DB: { students: [], activeYear: 'תשפ"ו' },
    dlog(){},
    localStorage: {
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => { if(failWrites) throw new Error('QuotaExceededError'); store.set(k, String(v)); },
      removeItem: k => { store.delete(k); }
    },
    __store: store,
    __failWrites: v => { failWrites = v; }
  };
  vm.createContext(sandbox);
  const code = [
    'const _pending = new Map();',
    'function _pendKey(c,id){ return c+":"+id; }',
    'function _mk(o){ return JSON.stringify(o); }',
    grabLine('function safeYearId'),
    grabLine('const FS_DOC_LIMIT'), grabLine('const FS_DOC_SAFE'), grabLine('const FS_DOC_WARN'),
    grab('function fsStrBytes'), grab('function fsSize'),
    grab('function fsDocSize'), grab('function assertFsDocFits'),
    grab('function studentsDocUsage'),
    grabLine('const PENDING_LS_KEY'),
    'let _pendingOwner="", _pendingPersisted=true, _pendingRestored=0, _pendingRestoredAt=0, _pendingLoadedOnce=false;',
    grab('function _pendingPersist'), grab('function _pendingForget'), grab('function _pendingRestoreOnce'),
    grab('function _guardApplyList')
  ].join('\n');
  vm.runInContext(code, sandbox);
  const run = expr => vm.runInContext(expr, sandbox);
  return { sandbox, run,
    pending: () => vm.runInContext('_pending', sandbox),
    raw: () => store.get(vm.runInContext('PENDING_LS_KEY', sandbox)) };
}

let pass = 0, fail = 0;
function check(name, cond, detail){
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}
const mkStu = (id, note) => ({ id, year: 'תשפ"ו', lastName: 'כהן', firstName: 'שרה', notes: note || '' });

console.log('\n=== חישוב גודל מסמך מול תקרת Firestore ===');
{
  const { run } = makeSandbox();
  const cases = ['', 'abc', 'שרה לאה', 'ילדה 🙂 עם אמוג׳י', 'א'.repeat(300)];
  let allOk = true, bad = '';
  for(const s of cases){
    const got = run(`fsStrBytes(${JSON.stringify(s)})`);
    const want = Buffer.byteLength(s, 'utf8');
    if(got !== want){ allOk = false; bad = `${JSON.stringify(s)}: ${got} ≠ ${want}`; }
  }
  check('אורך UTF-8 מדויק (עברית ואמוג׳י כלולים)', allOk, bad);

  // כללי Firestore: מחרוזת=בייטים+1 · בוליאני=1 · מספר=8 · שדה במפה=שם+1+ערך
  check('מחרוזת = בייטים + 1', run('fsSize("abc")') === 4);
  check('בוליאני = 1 · null = 1', run('fsSize(true)') === 1 && run('fsSize(null)') === 1);
  check('מספר = 8', run('fsSize(12345)') === 8);
  check('שדה במפה = אורך-השם + 1 + הערך', run('fsSize({ab:true})') === 2 + 1 + 1);
  check('מערך = סכום האיברים', run('fsSize([true,true,true])') === 3);
  check('מפה מקוננת נספרת לעומק', run('fsSize({a:{bb:true}})') === (1+1) + (2+1+1));

  // המסמך נעצר *לפני* השרת, עם code שהתרגום לעברית מזהה
  const big = run(`(function(){
     const list=[]; for(let i=0;i<4000;i++) list.push({id:"s"+i, notes:"א".repeat(200)});
     try{ assertFsDocFits("students_x",{year:"y",students:list},"עוד הסבר"); return "לא נעצר"; }
     catch(e){ return e.code+"|"+(e.bytes>FS_DOC_SAFE); }
   })()`);
  check('מסמך גדול מדי נעצר מראש עם code ייעודי', big === 'rg/doc-too-large|true', String(big));
  const small = run('assertFsDocFits("students_x",{year:"y",students:[{id:"a"}]},"")');
  check('מסמך תקין עובר ומחזיר את גודלו', typeof small === 'number' && small < 200, String(small));
}

console.log('\n=== התרחיש שדווח: ייבוא מהטלפון → כשל כתיבה → רענון ===');
{
  const A = makeSandbox();
  A.sandbox.currentUser = { email: 'Sara@Example.org' };
  // 917 תיקים מיובאים, אף אחד לא קיים בשרת (prev=null), הכתיבה נכשלה
  A.run(`(function(){
    for(let i=0;i<917;i++){ const o={id:"imp"+i, year:'תשפ"ו', lastName:"כהן", firstName:"ש"+i, notes:""};
      _pending.set(_pendKey("stu",o.id), {coll:"stu", id:o.id, j:_mk(o), prev:null}); }
    _pendingPersist();
  })()`);
  check('הממתינים הוצלו לדפדפן לפני הכתיבה', !!A.raw());
  check('כל 917 העריכות נשמרו', JSON.parse(A.raw()).items.length === 917);
  check('נרשם בעליהן האימייל בקטנות', JSON.parse(A.raw()).owner === 'sara@example.org');

  // --- רענון: לשונית חדשה, אותו localStorage, השרת עדיין בלי הייבוא ---
  const B = makeSandbox();
  B.sandbox.currentUser = { email: 'sara@example.org' };
  for(const [k, v] of A.sandbox.__store) B.sandbox.__store.set(k, v);
  check('אחרי רענון — הזיכרון מתחיל ריק', B.pending().size === 0);
  check('השחזור מדווח הצלחה', B.run('_pendingRestoreOnce()') === true);
  check('917 העריכות חזרו לתור', B.pending().size === 917);
  check('נספרו לתצוגה למשתמש', B.run('_pendingRestored') === 917);

  // ההחלה מעל מצב-השרת (שעדיין ריק) מחזירה את התיקים למסך
  const shown = B.run('_guardApplyList("stu", [], _pending, Date.now(), Infinity)');
  check('התיקים המיובאים מוצגים שוב אחרי הרענון', shown.length === 917);
  check('התוכן נשמר במלואו', shown.find(s => s.id === 'imp5').firstName === 'ש5');
  check('אף עריכה לא נזרקה בהחלה', B.pending().size === 917);

  // שחזור שני באותה טעינה לא מתרחש (חד-פעמי)
  check('השחזור חד-פעמי לכל טעינה', B.run('_pendingRestoreOnce()') === false);
}

console.log('\n=== המיזוג התלת-כיווני ממשיך להגן גם אחרי שחזור ===');
{
  const seed = () => makeSandbox();
  // (א) השרת כבר קיבל את העריכה → הממתין משתחרר ולא נכתב שוב
  {
    const S = seed(); S.sandbox.currentUser = { email: 'a@b.c' };
    S.run(`(function(){ const o=${JSON.stringify(mkStu('s1','הערה'))};
      _pending.set(_pendKey("stu","s1"), {coll:"stu", id:"s1", j:_mk(o), prev:_mk(${JSON.stringify(mkStu('s1',''))})}); _pendingPersist(); })()`);
    const T = seed(); T.sandbox.currentUser = { email: 'a@b.c' };
    for(const [k, v] of S.sandbox.__store) T.sandbox.__store.set(k, v);
    T.run('_pendingRestoreOnce()');
    T.run(`_guardApplyList("stu", [${JSON.stringify(mkStu('s1','הערה'))}], _pending, Date.now(), Infinity)`);
    check('(א) השרת כבר קיבל → הממתין משתחרר', T.pending().size === 0);
  }
  // (ב) השרת עדיין לא קיבל → העריכה מוחלת ונשמרת לניסיון נוסף
  {
    const S = seed(); S.sandbox.currentUser = { email: 'a@b.c' };
    S.run(`(function(){ const o=${JSON.stringify(mkStu('s1','הערה'))};
      _pending.set(_pendKey("stu","s1"), {coll:"stu", id:"s1", j:_mk(o), prev:_mk(${JSON.stringify(mkStu('s1',''))})}); _pendingPersist(); })()`);
    const T = seed(); T.sandbox.currentUser = { email: 'a@b.c' };
    for(const [k, v] of S.sandbox.__store) T.sandbox.__store.set(k, v);
    T.run('_pendingRestoreOnce()');
    const out = T.run(`_guardApplyList("stu", [${JSON.stringify(mkStu('s1',''))}], _pending, Date.now(), Infinity)`);
    check('(ב) השרת טרם קיבל → ההערה מוחלת מחדש', out[0].notes === 'הערה');
    check('(ב) הממתין נשמר להמשך ניסיונות', T.pending().size === 1);
  }
  // (ג) מישהו אחר ערך אחרינו → נסוגים לטובתו, לא דורסים
  {
    const S = seed(); S.sandbox.currentUser = { email: 'a@b.c' };
    S.run(`(function(){ const o=${JSON.stringify(mkStu('s1','שלי'))};
      _pending.set(_pendKey("stu","s1"), {coll:"stu", id:"s1", j:_mk(o), prev:_mk(${JSON.stringify(mkStu('s1',''))})}); _pendingPersist(); })()`);
    const T = seed(); T.sandbox.currentUser = { email: 'a@b.c' };
    for(const [k, v] of S.sandbox.__store) T.sandbox.__store.set(k, v);
    T.run('_pendingRestoreOnce()');
    const out = T.run(`_guardApplyList("stu", [${JSON.stringify(mkStu('s1','של מישהו אחר'))}], _pending, Date.now(), Infinity)`);
    check('(ג) עריכת-אחר מנצחת — לא נדרסת', out[0].notes === 'של מישהו אחר');
    check('(ג) הממתין שוחרר', T.pending().size === 0);
  }
}

console.log('\n=== גבולות: חשבון אחר, ניקוי, ומכסת אחסון ===');
{
  // עריכות של חשבון אחר על אותו מכשיר — לא משוחזרות ולא נמחקות
  const S = makeSandbox(); S.sandbox.currentUser = { email: 'first@example.org' };
  S.run(`(function(){ const o=${JSON.stringify(mkStu('s1','x'))};
    _pending.set(_pendKey("stu","s1"), {coll:"stu", id:"s1", j:_mk(o), prev:null}); _pendingPersist(); })()`);
  const T = makeSandbox(); T.sandbox.currentUser = { email: 'second@example.org' };
  for(const [k, v] of S.sandbox.__store) T.sandbox.__store.set(k, v);
  check('חשבון אחר — לא משחזר את העריכות', T.run('_pendingRestoreOnce()') === false && T.pending().size === 0);
  check('חשבון אחר — גם לא מוחק אותן', !!T.raw());

  // ניקוי כשהתור מתרוקן
  const C = makeSandbox(); C.sandbox.currentUser = { email: 'a@b.c' };
  C.run(`(function(){ _pending.set("stu:s1",{coll:"stu",id:"s1",j:"{}",prev:null}); _pendingPersist(); })()`);
  check('יש עותק בדפדפן כשיש ממתינים', !!C.raw());
  C.run('_pending.clear(); _pendingPersist();');
  check('התרוקן התור → העותק נמחק', !C.raw());

  // מכסת אחסון מלאה — לא מפילה את השמירה, אבל מסמנת שרענון כבר לא בטוח
  const Q = makeSandbox(); Q.sandbox.currentUser = { email: 'a@b.c' };
  Q.sandbox.__failWrites(true);
  let threw = false;
  try{ Q.run(`(function(){ _pending.set("stu:s1",{coll:"stu",id:"s1",j:"{}",prev:null}); _pendingPersist(); })()`); }
  catch(e){ threw = true; }
  check('מכסה מלאה — לא נזרקת שגיאה למעלה', !threw);
  check('מכסה מלאה — מסומן שאין גיבוי (אזהרה לפני סגירה)', Q.run('_pendingPersisted') === false);
}

console.log('\n=== תפוסת מסמך השנה (אזהרה מקדימה) ===');
{
  const U = makeSandbox();
  U.sandbox.DB = { activeYear: 'תשפ"ו', students: [] };
  U.run(`DB.students = (function(){ const a=[]; for(let i=0;i<917;i++)
    a.push({id:"s"+i, year:'תשפ"ו', lastName:"אברמוביץ", firstName:"שרה לאה", notes:""}); return a; })()`);
  const u = U.run('studentsDocUsage()');
  check('נספרות רק תלמידות השנה הפעילה', u.count === 917);
  check('מזהה המסמך נגזר מהשנה', u.docId === 'students_תשפ_ו', u.docId);
  check('אחוז התפוסה מחושב מול 1MiB', u.pct > 0 && u.pct === u.bytes / 1048576);
  const other = U.run(`(DB.students.push({id:"z", year:'תשפ"ה', lastName:"x", firstName:"y", notes:""}), studentsDocUsage())`);
  check('שנה אחרת אינה נספרת בתפוסה', other.count === 917);
}

console.log(`\n${fail ? '❌' : '✅'}  ${pass} עברו · ${fail} נכשלו\n`);
process.exit(fail ? 1 : 0);
