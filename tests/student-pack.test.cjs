/* ============================================================================
   בדיקת דחיסת תיק התלמידה (pack) מול ההשלמה בקריאה (normStudent)
   ----------------------------------------------------------------------------
   הרקע: כל תלמידות השנה יושבות במסמך Firestore אחד, והתקרה שם היא 1MiB. תיק
   נשמר במלואו — עשרות דגלים שערכם false ומחרוזות ריקות — ~890 בייט לתיק, מתוכם
   רק כרבע מידע אמיתי. ב-1,046 תיקים המסמך הגיע ל-99.5% מהתקרה וכל שמירה נדחתה.

   הדחיסה מורידה כל שדה ששווה לברירת המחדל, וההשלמה מחזירה אותו בקריאה. הבדיקה
   הזו שומרת על התנאי שבלעדיו תאבד מידע: **השתיים חייבות להיות הופכיות במדויק**,
   כולל סדר השדות (מנגנון הסנכרון משווה רשומות ב-JSON.stringify).

   הקוד נשלף מ-index.html עצמו. סימולציה טהורה ב-Node, בלי רשת.
   הרצה:  node tests/student-pack.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function grab(decl){
  const at = SRC.indexOf(decl);
  if(at < 0) throw new Error('לא נמצא ב-index.html: ' + decl);
  let i = SRC.indexOf('{', at), depth = 0, q = '', esc = false, inLine = false, inBlock = false;
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
const grabLine = d => { const at = SRC.indexOf(d), e = SRC.indexOf('\n', at); return SRC.slice(at, e < 0 ? SRC.length : e); };

const sb = { Date, Math, Object, Array, JSON, DB: { activeYear: 'תשפ"ז' } };
vm.createContext(sb);
vm.runInContext([
  'function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }',
  'let _stuKeys=null, _stuBlank=null;',
  grabLine('function safeYearId'),
  grabLine('const FS_DOC_LIMIT'),
  grab('function fsStrBytes'), grab('function fsSize'), grab('function fsDocSize'),
  grab('function makeStudent'), grab('function stuKeys'), grab('function stuBlank'),
  grab('function packStudent'), grab('function packStudents'), grab('function normStudent')
].join('\n'), sb);
const G = k => vm.runInContext(k, sb);
const makeStudent = G('makeStudent'), packStudent = G('packStudent'),
      packStudents = G('packStudents'), normStudent = G('normStudent'), fsDocSize = G('fsDocSize');

let pass = 0, fail = 0;
const check = (name, cond, detail) => cond
  ? (pass++, console.log('  ✓ ' + name))
  : (fail++, console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')));

/* מעבר דרך JSON = מה ש-Firestore באמת מחזיר (שדות שלא נכתבו פשוט אינם שם) */
const roundTrip = s => normStudent(JSON.parse(JSON.stringify(packStudent(s))));

function filled(i, opts){
  opts = opts || {};
  const s = normStudent(makeStudent());
  Object.assign(s, { lastName:'אברמוביץ', firstName:'שרה לאה', tz:'31234'+String(i).padStart(4,'0'),
    dob:'2020-05-12', motherName:'רבקה לאה', fatherName:'יוסף חיים', phone:'037654321',
    mobile:'0551234567', dadMobile:'0521234567', street:'רבי עקיבא', building:'42',
    city:'בני ברק', campus:'קמפוס מרכז', ganId:'g8h2k4m6x', age:'3',
    email:'family'+i+'@gmail.com', notes:'הערה: תושבת חוץ' });
  s.docs = { nispach:true, idCopy:true, takanon:false };
  if(opts.drive){
    s.docFiles = { nispach:{ id:'1AbCdEfGhIjKlMnOpQrStUvWxYz012345', name:'נספח.pdf',
      link:'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view' } };
    s.driveFolder = 'אברמוביץ שרה לאה'; s.driveFolderId = '1QwErTyUiOpAsDfGhJkLzXcVbNm67890';
  }
  return s;
}

console.log('\n=== הדחיסה הפיכה — שום מידע לא נעלם ===');
{
  let bad = 0, firstBad = '';
  for(let i = 0; i < 300; i++){
    for(const drive of [false, true]){
      const before = filled(i, { drive });
      const after = roundTrip(before);
      if(JSON.stringify(before) !== JSON.stringify(after)){
        bad++; if(!firstBad) firstBad = JSON.stringify(before) + '\n≠\n' + JSON.stringify(after);
      }
    }
  }
  check('600 תיקים מלאים חוזרים זהים לחלוטין (כולל סדר השדות)', bad === 0, firstBad.slice(0, 400));

  const blank = normStudent(makeStudent());
  check('תיק ריק לגמרי חוזר זהה', JSON.stringify(blank) === JSON.stringify(roundTrip(blank)));
}

console.log('\n=== ערכים שנראים "ריקים" אך נושאים משמעות — נשמרים ===');
{
  // ברירת המחדל היא true; false הוא בחירה של המשתמש/ת ואסור שייעלם
  const s = normStudent(makeStudent()); s.placed = false; s.registeredByUs = false;
  const r = roundTrip(s);
  check('placed=false שורד (ברירת המחדל היא true)', r.placed === false);
  check('registeredByUs=false שורד', r.registeredByUs === false);
  check('placed=false אכן נכתב לענן', packStudent(s).placed === false);

  const t = normStudent(makeStudent()); t.education = ''; t.period = '';
  const rt = roundTrip(t);
  check('מחרוזת שרוקנה במפורש נשמרת ריקה (לא חוזרת ל"רגיל")', rt.education === '' && rt.period === '');

  const u = normStudent(makeStudent()); u.special.otherText = 'הערה חשובה'; u.support.shiluv = true;
  const ru = roundTrip(u);
  check('טקסט בתוך מפה מקוננת שורד', ru.special.otherText === 'הערה חשובה');
  check('דגל בתוך מפה מקוננת שורד', ru.support.shiluv === true);
  check('שאר המפה המקוננת חוזרת לברירות המחדל', ru.special.divorced === false && ru.support.prepA === false);
}

console.log('\n=== מה באמת לא נכתב לענן ===');
{
  const s = filled(1);
  const p = packStudent(s);
  check('דגלים שערכם false אינם נכתבים', !('finished' in p) && !('insurancePaid' in p) && !('retentionNext' in p));
  check('מחרוזות ריקות אינן נכתבות', !('momMobile' in p) && !('driveFolder' in p));
  check('מפה שכולה ברירות מחדל אינה נכתבת', !('support' in p) && !('programsPaid' in p));
  check('מתוך docs נכתבים רק הסימונים הפעילים',
    JSON.stringify(p.docs) === JSON.stringify({ nispach:true, idCopy:true }), JSON.stringify(p.docs));
  check('מידע אמיתי תמיד נכתב', p.lastName === 'אברמוביץ' && p.tz === '312340001' && p.notes === 'הערה: תושבת חוץ');
  check('מזהה, שנה ותאריך יצירה נשמרים תמיד', !!p.id && !!p.year && !!p.createdAt);
}

console.log('\n=== שדות שאינם בתבנית (למשל geo) לא הולכים לאיבוד ===');
{
  const s = filled(2);
  s.geo = { lat: 32.08, lng: 34.83, manual: true };
  const r = roundTrip(s);
  check('שדה חיצוני נכתב לענן', JSON.stringify(packStudent(s).geo) === JSON.stringify(s.geo));
  check('שדה חיצוני חוזר שלם', JSON.stringify(r.geo) === JSON.stringify(s.geo));
}

console.log('\n=== רשומות בפורמט הישן (לפני הדחיסה) ממשיכות להיקרא ===');
{
  // בדיוק מה שיושב היום בענן: תיק מלא, ובנוסף תיק עתיק שחסרים בו שדות שנוספו מאז
  const legacy = { id:'old1', year:'תשפ"ז', tz:'123456789', firstName:'רבקה', lastName:'לוי' };
  const n = normStudent(legacy);
  check('שדות חסרים מושלמים לברירות המחדל', n.placed === true && n.education === 'רגיל' && n.notes === '');
  check('מפות חסרות נבנות במלואן', n.docs.nispach === false && n.special.otherText === '' && n.support.shiluv === false);
  check('המידע הישן נשמר', n.tz === '123456789' && n.firstName === 'רבקה');
  check('אין אף שדה undefined', Object.values(n).every(v => v !== undefined));
  check('רשומה ישנה עוברת דחיסה והשלמה בלי שינוי', JSON.stringify(n) === JSON.stringify(roundTrip(n)));

  // סדר שדות שונה לגמרי (כפי ששרת עשוי להחזיר) — התוצאה חייבת להיות קנונית
  const s = filled(3);
  const shuffled = {}; Object.keys(s).sort().forEach(k => shuffled[k] = s[k]);
  check('סדר שדות מעורבב מתנרמל לסדר קנוני זהה',
    JSON.stringify(normStudent(shuffled)) === JSON.stringify(s));
}

console.log('\n=== המסמך יורד מתחת לתקרה ===');
{
  const build = (n, drive) => { const a = []; for(let i = 0; i < n; i++) a.push(filled(i, { drive })); return a; };
  const at = (n, drive) => {
    const list = build(n, drive);
    return { before: fsDocSize('students_תשפ_ז', { year:'תשפ"ז', students:list }),
             after:  fsDocSize('students_תשפ_ז', { year:'תשפ"ז', students:packStudents(list) }) };
  };
  const now = at(1046, false);
  console.log(`     1046 תיקים: ${(now.before/1024).toFixed(0)}KB → ${(now.after/1024).toFixed(0)}KB`);
  check('לפני הדחיסה — 1046 תיקים חורגים או נושקים לתקרה', now.before / 1048576 > 0.95);
  check('אחרי הדחיסה — 1046 תיקים נכנסים בנוחות', now.after < 1048576 * 0.6,
    (now.after/1048576*100).toFixed(0) + '%');
  check('הדחיסה חוסכת לפחות מחצית מהנפח', now.after < now.before * 0.5,
    (100 - now.after/now.before*100).toFixed(0) + '% נחסכו');
  const room = at(2000, false);
  check('נשאר מרחב גדילה אמיתי (2000 תיקים עדיין מתחת לתקרה)', room.after < 1048576,
    (room.after/1048576*100).toFixed(0) + '%');
}

console.log(`\n${fail ? '❌' : '✅'}  ${pass} עברו · ${fail} נכשלו\n`);
process.exit(fail ? 1 : 0);
