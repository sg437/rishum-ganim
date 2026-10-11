/* ============================================================================
   הגשת קבצים לשרתי הבדיקה המקומיים
   ----------------------------------------------------------------------------
   שרת בדיקה שבונה נתיב בדיסק מתוך כתובת הבקשה (path.join(ROOT, url)) יכול
   להגיש כל קובץ במחשב — "../../" יוצא מהתיקייה. CodeQL מסמן את זה כחולשה
   (Uncontrolled data used in path expression), גם כשזה רק שרת בדיקה.

   כאן הכתובת אף פעם אינה הופכת לנתיב: הקבצים נאספים מראש מהתיקיות שמותר
   להגיש, ונשמרים במפה "כתובת → נתיב". הבקשה רק בוחרת מפתח מהמפה — מה שאינו
   ברשימה מקבל 404.

   שימוש:
     const serveFiles = require('./serve-files.cjs');
     const FILES = serveFiles([['/', ROOT], ['/__stub/', TMP]]);
     const f = FILES.get(url);   // נתיב בדיסק, או undefined
   ============================================================================ */
const fs = require('fs'), path = require('path');

const SKIP = new Set(['node_modules', '.git']);

function walk(dir, prefix, map) {
  let list;
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const d of list) {
    if (SKIP.has(d.name)) continue;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, prefix + d.name + '/', map);
    else if (d.isFile()) map.set(prefix + d.name, full);
  }
}

/* roots: [[קידומת בכתובת, תיקייה], ...]. קידומת ארוכה יותר גוברת על "/" */
module.exports = function serveFiles(roots) {
  let map = new Map();
  const build = () => {
    const m = new Map();
    roots.slice().sort((a, b) => a[0].length - b[0].length)
      .forEach(([prefix, dir]) => walk(dir, prefix, m));
    map = m;
  };
  build();
  return {
    /* קבצים שנכתבים לתיקייה הזמנית אחרי עליית השרת — נאספים מחדש בפספוס */
    get(url) {
      if (!map.has(url)) build();
      return map.get(url);
    }
  };
};
