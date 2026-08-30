/* ============================================================================
   בדיקת חישוב הצהרון — קבוצות, מגבלות לפי חינוך וצירוף בקמפוס
   ----------------------------------------------------------------------------
   מריצה את הפונקציות האמיתיות מתוך index.html (בלי דפדפן ובלי רשת): הקוד
   של מקטע הצהרון נחתך מהקובץ, נטען עם דמויות מינימליות של מה שהוא נשען
   עליו, ונבדק מול הטבלה שבתוכנית (docs/TZAHARON_PLAN.md, סעיף 3).

   הרצה:  node tests/tzaharon.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), vm = require('vm');

const SRC = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(SRC, 'utf8');

/* --- חיתוך מקטע הצהרון מתוך הקובץ החי --- */
const START = '/* המגבלות של סוג חינוך.';
const END   = '/* מעבר למבנה שיבוץ עם הקשרים';
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < 0 || b <= a) {
  console.error('❌ לא נמצא מקטע הצהרון ב-index.html — האם הפונקציות שונו או הוזזו?');
  process.exit(1);
}
const code = html.slice(a, b);

/* --- הדמויות שהמקטע נשען עליהן --- */
const ctx = {
  EDU_TYPES: ['רגיל', 'ח"מ'],
  DB: null,
  console,
  uid: () => Math.random().toString(36).slice(2, 9),
  eduLabel: x => (x && x.education) ? x.education : 'רגיל',
  eduScope: list => list,                       // בלי סינון חינוך פעיל
  ganById: id => ctx.DB.gans.find(g => g.id === id),
  ganName: id => { const g = ctx.ganById(id); return g ? g.ganName : '—'; },
  ganCampus: id => { const g = ctx.ganById(id); return g ? (g.campus || '') : ''; },
  studentsOfYear: () => ctx.DB.students.filter(s => s.year === ctx.DB.activeYear)
};
vm.createContext(ctx);
vm.runInContext(code, ctx);

/* --- עזרי בנייה --- */
let seq = 0;
function db(gans, limits, opts) {
  const students = [];
  gans.forEach(g => {
    for (let i = 0; i < (g.reg || 0); i++) {
      students.push({ id: 's' + (++seq), year: 'תשפ"ז', ganId: g.id, finished: false,
                      programs: { tzaharon: true } });
    }
    /* ילדה אחת שאינה רשומה לצהרון — כדי לוודא שהיא לא נספרת */
    students.push({ id: 's' + (++seq), year: 'תשפ"ז', ganId: g.id, finished: false, programs: {} });
  });
  return Object.assign({
    activeYear: 'תשפ"ז',
    gans: gans.map(g => ({ id: g.id, ganName: g.id, active: true,
                           campus: g.campus || '', education: g.edu || 'רגיל' })),
    students,
    assignments: {},
    tzGroups: {},
    settings: limits ? { tzaharonLimits: limits } : {}
  }, opts || {});
}
const REG = { 'רגיל': { min: 15, max: 25 }, 'ח"מ': { min: 8, max: 14 } };

let pass = 0, fail = 0;
function is(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + '\n      התקבל: ' + JSON.stringify(got) +
                             '\n      צפוי:  ' + JSON.stringify(want)); }
}

/* ======================= 1. טבלת שלב ב' שבתוכנית ======================= */
console.log('\n1. גנים שעומדים בעצמם — הטבלה שבסעיף 3 של התוכנית');
[
  ['רגיל · 40 נרשמות → 2 קבוצות',            'רגיל', 40, 2],
  ['רגיל · 28 נרשמות → קבוצה אחת',            'רגיל', 28, 1],
  ['רגיל · 50 נרשמות → 2 קבוצות מלאות',       'רגיל', 50, 2],
  ['רגיל · 9 נרשמות → 0',                    'רגיל',  9, 0],
  ['ח"מ · 9 נרשמות → קבוצה אחת',              'ח"מ',   9, 1]
].forEach(([name, edu, reg, want]) => {
  ctx.DB = db([{ id: 'g1', reg, edu }], REG);
  is(name, ctx.tzPlan().openableTotal, want);
});

/* 28 נרשמות ומקסימום 25 — קבוצה אחת, והחריגה מדווחת */
ctx.DB = db([{ id: 'g1', reg: 28, edu: 'רגיל' }], REG);
is('חריגה מהמקסימום מדווחת (28 מול 25)', ctx.tzPlan().overMaxGans.map(r => r.overMax), [3]);

/* ======================= 2. tzLimits ======================= */
console.log('\n2. המגבלות נפרדות לכל סוג חינוך');
ctx.DB = db([], REG);
is('מינימום ברגיל', ctx.tzLimits('רגיל').min, 15);
is('מינימום בח"מ',  ctx.tzLimits('ח"מ').min, 8);
is('מקסימום בח"מ',  ctx.tzLimits('ח"מ').max, 14);

ctx.DB = db([], null, { settings: { tzaharonMin: 12 } });
is('תאימות אחורה — ההגדרה הישנה חלה על שני סוגי החינוך',
   [ctx.tzLimits('רגיל').min, ctx.tzLimits('ח"מ').min], [12, 12]);
is('תאימות אחורה — אין מקסימום', ctx.tzLimits('רגיל').max, 0);
is('tzHasLimits מזהה שהוגדר משהו', ctx.tzHasLimits(), true);

ctx.DB = db([], null, { settings: {} });
is('בלי שום הגדרה — 0', ctx.tzLimits('רגיל').min, 0);
is('tzHasLimits שלילי', ctx.tzHasLimits(), false);

/* ======================= 3. צירוף בקמפוס ======================= */
console.log('\n3. צירוף גנים בתוך הקמפוס');

ctx.DB = db([{ id: 'g1', reg: 9, campus: 'רשב"ם' },
             { id: 'g2', reg: 8, campus: 'רשב"ם' }], REG);
let P = ctx.tzPlan();
is('שני גנים חסרים באותו קמפוס = הצעת צירוף אחת', P.mergeSuggestions.length, 1);
is('סכום ההצעה', P.mergeSuggestions[0].total, 17);
is('ניתן לפתוח', P.openableTotal, 1);
is('אין גנים מתחת למינימום אחרי הצירוף', P.belowMinGans.length, 0);

ctx.DB = db([{ id: 'g1', reg: 9, campus: 'רשב"ם' },
             { id: 'g2', reg: 8, campus: 'אחר' }], REG);
P = ctx.tzPlan();
is('צירוף לא חוצה קמפוסים', P.mergeSuggestions.length, 0);
is('שניהם נשארים מתחת למינימום', P.belowMinGans.length, 2);

ctx.DB = db([{ id: 'g1', reg: 9, campus: 'רשב"ם', edu: 'רגיל' },
             { id: 'g2', reg: 8, campus: 'רשב"ם', edu: 'ח"מ' }], REG);
P = ctx.tzPlan();
is('צירוף לא חוצה סוגי חינוך', P.mergeSuggestions.length, 0);
is('הגן של ח"מ נפתח לבדו (8 = המינימום שלו)', P.openableStandalone, 1);
is('רק הגן הרגיל נשאר חסר', P.belowMinGans.map(r => r.ganId), ['g1']);

/* גילים שונים באותו קמפוס — צירוף חוקי לגמרי */
ctx.DB = db([{ id: 'g3', reg: 9, campus: 'רשב"ם' },
             { id: 'g4', reg: 8, campus: 'רשב"ם' }], REG);
ctx.DB.gans[0].age = '3'; ctx.DB.gans[1].age = '4';
is('צירוף בין גילים שונים — מותר', ctx.tzPlan().mergeSuggestions.length, 1);

/* כמה שצריך מאותו קמפוס — שלושה גנים קטנים */
ctx.DB = db([{ id: 'g1', reg: 6, campus: 'רשב"ם' },
             { id: 'g2', reg: 5, campus: 'רשב"ם' },
             { id: 'g3', reg: 5, campus: 'רשב"ם' }], REG);
P = ctx.tzPlan();
is('שלושה גנים מצטרפים לקבוצה אחת', P.mergeSuggestions.length, 1);
is('כל השלושה בהצעה', P.mergeSuggestions[0].ganIds.sort(), ['g1', 'g2', 'g3']);

/* שארית — כמה חסר לקמפוס כולו */
ctx.DB = db([{ id: 'g1', reg: 5, campus: 'רשב"ם' },
             { id: 'g2', reg: 4, campus: 'רשב"ם' }], REG);
P = ctx.tzPlan();
is('אין הצעה כשהסכום מתחת למינימום', P.mergeSuggestions.length, 0);
is('חסר לגן הבודד', P.byGan['g1'].gap, 10);
is('חסר לקמפוס כולו', P.byGan['g1'].campusGap, 6);

/* ======================= 4. קבוצות שנפתחו ======================= */
console.log('\n4. קבוצות פתוחות והמונים');

ctx.DB = db([{ id: 'g1', reg: 20 }, { id: 'g2', reg: 20 }], REG);
P = ctx.tzPlan();
is('לפני הפתיחה — ניתן לפתוח 2', P.openableTotal, 2);
is('לפני הפתיחה — נפתחו 0', P.openedCount, 0);
is('סה"כ אפשריות', P.totalPossible, 2);

ctx.DB.tzGroups['תשפ"ז'] = [{ id: 'tz_1', name: 'א', campus: '', ganIds: ['g1'],
                              education: 'רגיל', status: 'open' }];
P = ctx.tzPlan();
is('אחרי פתיחה — נפתחו 1', P.openedCount, 1);
is('אחרי פתיחה — ניתן לפתוח יורד ל-1', P.openableTotal, 1);
is('סה"כ אפשריות נשאר 2', P.totalPossible, 2);
is('הגן שנפתח מסומן כמשויך', P.byGan['g1'].state, 'grouped');

ctx.DB.tzGroups['תשפ"ז'][0].status = 'planned';
P = ctx.tzPlan();
is('קבוצה מתוכננת אינה נספרת כ"נפתחה"', P.openedCount, 0);
is('והגן שלה עדיין לא נספר שוב ב"ניתן לפתוח"', P.openableTotal, 1);

/* ======================= 5. ספירת הנרשמות ======================= */
console.log('\n5. ספירה');
ctx.DB = db([{ id: 'g1', reg: 20 }, { id: 'g2', reg: 5 }], REG);
is('סה"כ נרשמות — רק מי שסומנה', ctx.tzPlan().totalRegistered, 25);
ctx.DB.students[0].finished = true;
is('תלמידה שסיימה אינה נספרת', ctx.tzPlan().totalRegistered, 24);

is('פירוק לפי חינוך — רגיל', ctx.tzPlan().byEdu['רגיל'].registered, 24);
is('פירוק לפי חינוך — ח"מ ריק', ctx.tzPlan().byEdu['ח"מ'].registered, 0);

/* ======================= 6. מיגרציה ======================= */
console.log('\n6. מיגרציית שיבוצי הצהרון הישנים');
ctx.DB = db([{ id: 'g1', reg: 20 }], REG);
ctx.DB.assignments = { 'תשפ"ז': { tzaharon: { g1: { 'סייעת': { staffId: 'x', name: 'שרה' } } } } };
ctx.migrateTzGroups();
const groups = ctx.DB.tzGroups['תשפ"ז'];
is('נוצרה קבוצה חד-גנית', groups.length, 1);
is('הקבוצה פתוחה', groups[0].status, 'open');
is('הגן שלה', groups[0].ganIds, ['g1']);
is('נשמר מזהה הגן המקורי', groups[0].legacyGanId, 'g1');
is('מזהה הקבוצה בתחילית tz_', groups[0].id.slice(0, 3), 'tz_');
const ctxA = ctx.DB.assignments['תשפ"ז'].tzaharon;
is('השיבוץ עבר למפתח הקבוצה', !!ctxA[groups[0].id], true);
is('המפתח הישן נמחק', ctxA.g1, undefined);
is('השיבוץ עצמו נשמר', ctxA[groups[0].id]['סייעת'].name, 'שרה');

ctx.migrateTzGroups();
is('הרצה שנייה לא משכפלת', ctx.DB.tzGroups['תשפ"ז'].length, 1);
is('והשיבוץ עדיין שם', !!ctx.DB.assignments['תשפ"ז'].tzaharon[groups[0].id], true);

/* ======================= סיכום ======================= */
console.log('\n' + '─'.repeat(52));
console.log(fail ? `❌ ${fail} נכשלו · ${pass} עברו` : `✅ כל ${pass} הבדיקות עברו`);
process.exit(fail ? 1 : 0);
