/* ============================================================================
   מתקן בדיקה לעיצוב — בונה דף בודק מה-CSS האמיתי של index.html
   ----------------------------------------------------------------------------
   למה: את המעבדה אי אפשר לראות בלי התחברות ל-Firebase, ו-app-artifact.html
   היא גרסת דמו ישנה עם פלטה משלה — כלומר לא בסיס השוואה נכון. הסקריפט הזה
   שולף את בלוק ה-<style> מ-index.html עצמו ומרכיב סביבו מסך לדוגמה עם
   הרכיבים המרכזיים: כותרת, כרטיסי מספרים, סינון, טבלה, כרטיסי גנים וכפתורים.
   כך שינוי ב-index.html משתקף מיד במתקן, ואין דריפט בין השניים.

   הרצה:  node tests/design-harness.cjs [נתיב-פלט]
   ואז:   לפתוח את קובץ הפלט בדפדפן. להוספת המחלקה ui-lab ידנית בקונסולה:
          document.documentElement.classList.add('ui-lab')
          + <link rel="stylesheet" href="ui-lab.css">
   ============================================================================ */
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

const a=html.indexOf('<style>');
const b=html.indexOf('</style>', a);
if(a<0||b<0) throw new Error('לא נמצא בלוק ה-<style> ב-index.html');
const style=html.slice(a, b+'</style>'.length);

const demo=`
<header class="top"><div class="top-inner">
  <div class="brand"><span class="logo">🎒</span>
    <span class="txt"><span class="t1">מערכת ניהול</span><span class="t2">רשת הגנים מודיעין עילית</span></span></div>
  <div class="top-spacer"></div>
  <div class="top-chips"><span class="chip year">📅 תשפ״ח</span><span class="chip edu reg">חינוך רגיל</span></div>
  <button class="hamburger"><span></span></button>
</div></header>

<div style="max-width:1200px;margin:0 auto;padding:18px 14px">
  <div class="section-title">תיקי התלמידות · שנת תשפ״ח</div>

  <div class="stats" style="margin:14px 0 18px">
    <div class="stat hero"><div class="k">רשומות</div><div class="v">412</div></div>
    <div class="stat"><div class="k">משובצות</div><div class="v">361</div></div>
    <div class="stat"><div class="k">ממתינות לשיבוץ</div><div class="v">51</div></div>
    <div class="stat"><div class="k">קלוט בעירייה</div><div class="v">338 <small>מתוך 412</small></div></div>
  </div>

  <div class="panel">
    <h2>סינון</h2><div class="sub">בחירת גן, גיל וסטטוס. הסינון חל על כל המסכים.</div>
    <div class="fchips" style="margin-bottom:12px">
      <span class="fchip">גיל 3</span><span class="fchip">גיל 4</span>
      <span class="fchip">ממתינות</span><span class="fchip">גן רימון</span>
    </div>
    <div class="grid g3">
      <div><label>חיפוש (שם / ת״ז)</label><input placeholder="הקלד/י שם או ת״ז…"></div>
      <div><label>גן</label><select><option>הכל</option><option>גן רימון</option></select></div>
      <div><label>טלפון</label><div class="fieldwrap tel"><input type="tel" value="052-1234567"><a class="act">📞</a></div></div>
    </div>
  </div>

  <div class="panel" style="padding-inline:0">
    <div class="table-wrap"><table>
      <thead><tr><th class="sortable">שם מלא</th><th>ת״ז</th><th>גן</th><th>שיבוץ</th>
        <th>גיל</th><th>עיר</th><th>מסמכים</th><th>סטטוס</th></tr></thead>
      <tbody>
        <tr><td><span class="ini">אח</span> אברמוביץ׳ חנה׳לה</td><td>325417806</td><td>גן רימון · 4</td>
          <td><span class="chip edu reg">✔ משובצת</span></td><td>4</td><td>ירושלים</td>
          <td><span class="docchip">נס</span><span class="docchip">ת״ז</span></td>
          <td><span class="chip edu">פעילה</span></td></tr>
        <tr><td><span class="ini">גמ</span> גולדשטיין מירי</td><td>328990114</td><td>גן תפוח · 3</td>
          <td><span class="chip edu spec">ממתינה</span></td><td>3</td><td>ירושלים</td>
          <td><span class="docchip">נס</span></td>
          <td><span class="chip edu">פעילה</span></td></tr>
        <tr><td><span class="ini">לב</span> לוי ברכה</td><td>331204558</td><td>—</td>
          <td><span class="chip edu spec">ממתינה</span></td><td>5</td><td>מודיעין עילית</td>
          <td><span class="docchip">תק</span></td>
          <td><span class="chip edu">פעילה</span></td></tr>
      </tbody></table></div>
  </div>

  <div class="panel">
    <h2>גנים</h2><div class="sub">תפוסה מול רף השיבוץ</div>
    <div class="gan-grid">
      <div class="gan-card"><b>גן רימון</b><div class="hint">סמל 4821 · גיל 4</div><div class="bar"><i style="width:78%"></i></div></div>
      <div class="gan-card"><b>גן תפוח</b><div class="hint">סמל 4822 · גיל 3</div><div class="bar"><i style="width:100%"></i></div></div>
      <div class="gan-card"><b>גן אלון</b><div class="hint">סמל 4823 · גיל 5</div><div class="bar"><i style="width:41%"></i></div></div>
    </div>
    <div class="toolbar" style="margin-top:14px">
      <button class="btn">➕ הוספת ילדה</button>
      <button class="btn ghost">⬆ ייבוא מקובץ</button>
      <button class="btn ghost">✔ עדכון קבוצתי</button>
    </div>
  </div>
</div>`;

const page='<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
  +'<meta name="viewport" content="width=device-width,initial-scale=1">\n'
  +'<title>מתקן בדיקה — עיצוב</title>\n'+style+'\n</head>\n<body>'+demo+'\n</body>\n</html>\n';

const out=process.argv[2]||path.join(require('os').tmpdir(),'design-harness.html');
fs.writeFileSync(out,page);
console.log('נכתב:', out, '·', page.length, 'בתים (בלוק style:', style.length+')');
