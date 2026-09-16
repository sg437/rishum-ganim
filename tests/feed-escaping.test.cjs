/* ============================================================================
   בדיקה ללא רשת — בריחת HTML בפיד המרכזי ובמסמך הרישום
   ----------------------------------------------------------------------------
   רקע: הפיד במרכזי (pushFeed) מציג את האירועים עם innerHTML, ו-tx נבנה
   ב-diffEvents עם <b> מכוון. הערכים שנכנסים לשם מגיעים מ-Firestore — שם
   התצוגה של משתמש/ת עיר, שם העיר, וטקסט שגיאה. בלי בריחה, משתמש/ת עיר אחת
   יכולה להריץ קוד בדפדפן של מפעיל/ת המרכזי, שרואה את כל הערים — כלומר
   לשבור את גבול הערים שמתואר ב-docs/SECURITY.md סעיף 5.
   (CodeQL — "DOM text reinterpreted as HTML", management.html)

   ב-register.html הפונקציה esc() רק המירה למחרוזת ולא ברחה כלל, למרות שהיא
   בונה את מסמך הרישום ב-innerHTML ומאפייני value="…".

   הבדיקה מריצה את פונקציות הבריחה האמיתיות מתוך הדפים (לא העתק שלהן),
   ומוודאת שאתרי הקריאה עדיין עוטפים את הערכים.
   הרצה:  node tests/feed-escaping.test.cjs
   ============================================================================ */
const fs=require('fs'), path=require('path'), assert=require('assert');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const mg=read('management.html'), rg=read('register.html');

/* חילוץ פונקציה מתוך הדף והרצתה — כך הבדיקה נשברת אם הקוד האמיתי משתנה */
function extract(src, re, name){
  const m=src.match(re);
  assert(m, `לא נמצאה הפונקציה ${name} — ייתכן ששמה או מבנה שלה השתנו`);
  return new Function(`${m[0]}; return ${name};`)();
}

const PAYLOAD = '<img src=x onerror=alert(1)>';
const ATTR    = 'שם" onmouseover="alert(1)';

/* ---------- 1. evEsc במרכזי ---------- */
const evEsc = extract(mg, /const evEsc *=[\s\S]*?\}\)\[c\]\);/, 'evEsc');
assert(!/[<>]/.test(evEsc(PAYLOAD)), 'evEsc: תגיות לא ברחו');
assert.strictEqual(evEsc('<b>&"\'' ), '&lt;b&gt;&amp;&quot;&#39;', 'evEsc: טבלת הבריחה אינה מלאה');
assert.strictEqual(evEsc(null), '', 'evEsc: null צריך להפוך למחרוזת ריקה');
assert.strictEqual(evEsc(undefined), '', 'evEsc: undefined צריך להפוך למחרוזת ריקה');
assert.strictEqual(evEsc(7), '7', 'evEsc: מספר צריך לעבור כמו שהוא');

/* ---------- 2. אתרי הקריאה בבלוק של diffEvents ---------- */
/* כל בלוק הסקריפט של המודול — מ-evEsc ועד סוף הבלוק — כדי לכסות גם את startHQ */
const _b0 = mg.indexOf('const evEsc');
const block = mg.slice(_b0, mg.indexOf('</script>', _b0));
assert(/const mt=evEsc\(c\.name\)\+" · עכשיו"/.test(block),
  'שם העיר נכנס ל-mt של כל אירוע — חייב לעבור evEsc');
assert(/"<b>"\+evEsc\(x\.name\|\|x\.email\)\+"<\/b> נכנס\/ה/.test(block),
  'שם/מייל של משתמש/ת עיר — הנתיב המסוכן ביותר — חייב לעבור evEsc');
assert(/evEsc\(c\.name\|\|c\.id\)/.test(block),
  'הודעת "אין גישה לנתוני …" חייבת לברוח משם העיר');
assert(/evEsc\(err&&err\.code\|\|err\)/.test(block),
  'טקסט שגיאת org/hq חייב לברוח');

/* ארבעת הערכים שמגיעים מהשרת לא מופיעים ב-tx/mt בלי evEsc.
   קודם מנטרלים כל קריאה ל-evEsc(...), ואז מחפשים מה נשאר חשוף.
   מונים מספריים (n.placed וכו') אינם נבדקים — הם לא טקסט חופשי. */
/* הערה על גבולות הבדיקה: היא נועלת את ארבעת אתרי הקריאה שנבדקו לעיל, ולא
   סורקת גנרית כל הזרקה עתידית — השורות כאן ארוכות ומערבות לוגיקה (p.presence.map,
   pe.has) עם בניית ה-tx, וסריקה גסה מייצרת התרעות שווא. הכיסוי הגנרי הוא CodeQL. */

/* הסינק עצמו — אם מישהו יחליף אותו ל-textContent, כדאי לדעת שהבריחה הפכה לשכבה שנייה */
assert(/d\.innerHTML='<div class="ic">'\+ev\.ic/.test(mg),
  'pushFeed השתנה — לוודא שהבריחה ב-diffEvents עדיין נדרשת/מספיקה');

/* ---------- 3. esc במסמך הרישום ---------- */
const esc = extract(rg, /function esc\(s\)\{[\s\S]*?\}\)\[c\]\); \}/, 'esc');
assert(!/[<>]/.test(esc(PAYLOAD)), 'esc: תגיות לא ברחו');
assert(!/"/.test(esc(ATTR)), 'esc: גרש כפול חייב לברוח — הערכים נכנסים ל-value="…"');
assert.strictEqual(esc(null), '', 'esc: null צריך להפוך למחרוזת ריקה');

/* ---------- 4. הצבה ל-value/textContent אינה הקשר HTML ---------- */
const str = extract(rg, /function str\(s\)\{[^}]*\}/, 'str');
assert.strictEqual(str('א&ב'), 'א&ב', 'str: אסור לברוח — המשתמש/ת תראה &amp; בשדה');
assert(/\$\("#ganSymbol"\)\.value = g\? str\(/.test(rg), 'שדה סמל הגן חייב str, לא esc');
assert(/\$\("#ganAddress"\)\.value = g\? str\(/.test(rg), 'שדה כתובת הגן חייב str, לא esc');
assert(/\$\("#declSymbol"\)\.textContent = g\? str\(/.test(rg), 'סמל בהצהרה חייב str, לא esc');

console.log('✅ feed-escaping: הפיד במרכזי ומסמך הרישום בורחים מכל ערך שמגיע מהשרת או מהטופס.');
