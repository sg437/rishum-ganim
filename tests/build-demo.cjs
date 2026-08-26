/* ============================================================================
   בונה את demo.html — גרסת דמו של העיצוב החדש, בלי נתונים אמיתיים
   ----------------------------------------------------------------------------
   למה סקריפט ולא קובץ שנכתב ביד: דמו שנכתב ביד מתיישן תוך שבוע. כאן ה-<style>,
   הכותרת, המגירה, פאנל העוזר ומערך TABS נשלפים מ-index.html עצמו, ושכבת העיצוב
   היא בדיוק אותם ui-lab.css ו-ui-lab.js שרצים בייצור. שינוי באחד מהם משתקף
   בדמו בהרצה הבאה, ואין דריפט.

   מה שכן מומצא כאן: הנתונים בלבד — 29 גנים, 412 תלמידות, 58 אנשי צוות,
   כולם מיוצרים מזרע קבוע כדי שהמספרים יהיו עקביים בין המסכים.

   אין Firebase, אין התחברות, אין רשת ואין כתיבה לשום מקום.

   הרצה:  node tests/build-demo.cjs
   ============================================================================ */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const cut = (startNeedle, endNeedle, what) => {
  const a = html.indexOf(startNeedle);
  if (a < 0) throw new Error('לא נמצא ב-index.html: ' + what);
  const b = html.indexOf(endNeedle, a);
  if (b < 0) throw new Error('לא נמצא סוף של: ' + what);
  return html.slice(a, b + endNeedle.length);
};

const style   = cut('<style>', '</style>', 'בלוק ה-style');
const header  = cut('<header class="top">', '</header>', 'הכותרת העליונה');
const drawer  = cut('<div class="scrim"', '</aside>', 'המגירה');
const aipanel = cut('<aside class="aipanel"', '</aside>', 'פאנל העוזר החכם');

/* מערך הלשוניות — נגזר מהקוד, כך שלשונית חדשה תופיע בדמו מאליה */
const ta = html.indexOf('const TABS = [');
const te = html.indexOf('];', ta);
if (ta < 0 || te < 0) throw new Error('לא נמצא מערך TABS');
const TABS = [...html.slice(ta, te).matchAll(/\{id:"([^"]+)",\s*label:"([^"]+)",\s*icon:"([^"]*)"\}/g)]
  .map(m => ({ id: m[1], label: m[2], icon: m[3] }));
if (!TABS.length) throw new Error('TABS נמצא אך לא נותח');

/* צבעי הגילאים — מהקוד, לא משוכפלים ביד */
const hue = html.match(/const AGE_HUE = (\{[^}]*\});/);
if (!hue) throw new Error('לא נמצא AGE_HUE');
const AGE_HUE = hue[1];

const navHtml = TABS.map(t =>
  `<button data-tab="${t.id}"><span class="ic">${t.icon}</span><span class="tl">${t.label}</span></button>`
).join('\n      ');

const demoJs = fs.readFileSync(path.join(__dirname, 'demo-app.js'), 'utf8')
  .replace('/*__AGE_HUE__*/null', AGE_HUE)
  .replace('/*__TABS__*/null', JSON.stringify(TABS));

const out = `<!doctype html>
<html lang="he" dir="rtl" class="ui-lab">
<head>
<meta charset="utf-8">
<!-- ==========================================================================
   מערכת ניהול רשת הגנים · גרסת דמו לעיצוב
   Copyright © 2026 שמואל גולדמן (Shmuel Goldman). כל הזכויות שמורות.
   תוכנה קניינית — תנאים מלאים בקובץ LICENSE שבשורש הפרויקט.

   נוצר על ידי tests/build-demo.cjs — אין לערוך ידנית.
   הנתונים בעמוד זה מומצאים במלואם ואינם קשורים לאף אדם או גן.
   ========================================================================== -->
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#15342a">
<title>רשת הגנים · דמו עיצוב</title>
<!-- גופני העיצוב מוקדמים ל-ui-lab.css כדי שהעמוד לא יהבהב בגופן המערכת
     לפני שהם מגיעים. ההגדרות עצמן (@font-face) יושבות בתוך ui-lab.css. -->
<link rel="preload" as="font" type="font/woff2" crossorigin href="fonts/assistant-hebrew.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin href="fonts/heebo-hebrew.woff2">
${style}
<link rel="stylesheet" href="ui-lab.css">
<style>
/* רצועת הדמו — כדי שאיש לא יתבלבל ויחשוב שאלה נתונים אמיתיים.
   הרצועה קבועה בראש המסך, ולכן *כל* האלמנטים הקבועים האחרים — הכותרת,
   המגירה ופאנל העוזר — מוסטים באותו גובה. בלי זה הרצועה נוחתת על גבי
   כותרת המגירה. */
:root{ --demo-bar:30px }
.demo-flag{position:fixed;inset-block-start:0;inset-inline:0;z-index:90;
  background:#a97f2e;color:#fff;font-weight:700;font-size:.78rem;line-height:1.5;
  padding:5px 14px;text-align:center;letter-spacing:-.01em}
body{padding-block-start:var(--demo-bar)}
header.top{inset-block-start:var(--demo-bar)}
.drawer,.aipanel{inset-block-start:var(--demo-bar)}
@media print{.demo-flag{display:none} body{padding-block-start:0}}
</style>
</head>
<body>

<div class="demo-flag">גרסת דמו · העיצוב החדש · כל הנתונים בעמוד מומצאים ואינם קשורים לאף אדם או גן</div>

${drawer}
${header}

<main id="view"></main>

${aipanel}

<div class="overlay" id="overlay"><div class="modal" id="modal"></div></div>
<div class="toast" id="toast"></div>

<script>
${demoJs}
</script>
<script src="ui-lab.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'demo.html'), out, 'utf8');
console.log('נכתב demo.html · ' + (out.length / 1024).toFixed(0) + 'KB · ' + TABS.length + ' לשוניות');
