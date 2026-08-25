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

/* המגירה והרעלה — נלקחות כמות שהן מ-index.html, לא משוכפלות ביד */
const ds=html.indexOf('<div class="scrim"');
const de=html.indexOf('</aside>', ds);
if(ds<0||de<0) throw new Error('לא נמצאה המגירה ב-index.html');
const drawer=html.slice(ds, de+'</aside>'.length);

/* לשוניות הניווט — נגזרות ממערך TABS האמיתי, כך שהמתקן לא מתיישן */
const ta=html.indexOf('const TABS = [');
const te=html.indexOf('];', ta);
if(ta<0||te<0) throw new Error('לא נמצא מערך TABS ב-index.html');
const tabs=[...html.slice(ta,te).matchAll(/\{id:"([^"]+)",\s*label:"([^"]+)",\s*icon:"([^"]*)"\}/g)]
  .map(m=>({id:m[1],label:m[2],icon:m[3]}));
if(!tabs.length) throw new Error('TABS נמצא אך לא נותח');
/* מונים לדוגמה — renderTabs מציג אותם רק לתלמידות ולגנים */
const demoCounts={students:412,gans:29};
const navHtml=tabs.map(t=>{
  const c=demoCounts[t.id]!=null?`<span class="count">${demoCounts[t.id]}</span>`:'';
  return `<button data-tab="${t.id}" class="${t.id===(process.env.HARNESS_TAB||'home')?'active':''}">`
        +`<span class="ic">${t.icon}</span><span class="tl">${t.label}</span>${c}</button>`;
}).join('');

const demo=`
${drawer}
<header class="top"><div class="top-inner">
  <div class="brand"><span class="logo">🎒</span>
    <span class="txt"><span class="t1">מערכת ניהול</span><span class="t2">רשת הגנים מודיעין עילית</span></span></div>
  <div class="top-spacer"></div>
  <div class="top-chips"><span class="chip year">📅 תשפ״ח</span><span class="chip edu reg">חינוך רגיל</span></div>
  <button class="hamburger"><span></span></button>
</div></header>

<div id="view" style="max-width:1200px;margin:0 auto;padding:18px 14px">
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
    <div class="stu-stage"><div id="stuTable" style="flex:1 1 0;min-width:0">
    <div class="table-wrap"><table class="stu-table">
      <thead><tr><th class="sortable">שם מלא</th><th>ת״ז</th><th>גן</th><th>שיבוץ</th>
        <th>גיל</th><th>עיר</th><th>מסמכים</th><th>סטטוס</th></tr></thead>
      <tbody>
        <tr class="sel"><td><div class="nm">אברמוביץ׳ חנה׳לה</div></td><td class="tzcell">325417806</td><td>גן רימון · 4</td>
          <td><span class="chip edu reg">✔ משובצת</span></td><td>4</td><td>ירושלים</td>
          <td><span class="docchips"><span class="docchip on">נס</span><span class="docchip on">ת״ז</span><span class="docchip">תק</span></span></td>
          <td><span class="chip edu">פעילה</span></td></tr>
        <tr><td><div class="nm">גולדשטיין מירי</div></td><td class="tzcell">328990114</td><td>גן תפוח · 3</td>
          <td><span class="chip edu spec">ממתינה</span></td><td>3</td><td>ירושלים</td>
          <td><span class="docchips"><span class="docchip on">נס</span><span class="docchip">ת״ז</span><span class="docchip">תק</span></span></td>
          <td><span class="chip edu">פעילה</span></td></tr>
        <tr><td><div class="nm">וייס שרה</div></td><td class="tzcell">324110552</td><td>גן אגוז · 5</td>
          <td><span class="chip edu reg">✔ משובצת</span></td><td>5</td><td>מודיעין עילית</td>
          <td><span class="docchips"><span class="docchip on">נס</span><span class="docchip on">ת״ז</span><span class="docchip on">תק</span></span></td>
          <td><span class="chip edu">פעילה</span></td></tr>
      </tbody></table></div>
    <div class="selbar"><b>נבחרה 1 תלמידה</b>
      <button class="btn">סמן כקלוט</button>
      <button class="btn">שיבוץ לגן…</button>
      <button class="btn">ייצוא הבחירה</button></div>
    </div></div>
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

/* סטאב לוו הנתונים של המעבדה — במתקן אין Firebase */
const stub=`<script>
window.__uiLab={
  stats(){return {year:"תשפ\u05f4\u05d7",students:412,gansActive:29,gansTarget:30,
    email:"user@example.org"};},
  home(){return {year:"תשפ\u05f4\u05d7",total:412,placed:361,waiting:51,notMuni:74,
    missingDocs:28,topDoc:"תקנון",topAge:"3",topAgeN:33,
    noTeacherCount:6,noTeacherCampus:["קמפוס דרום"],gansActive:29,
    nearFull:["גן תפוח","גן דובדבן"],
    campuses:[{name:"קמפוס צפון",cap:180,used:168},{name:"קמפוס מרכז",cap:175,used:147},
              {name:"קמפוס דרום",cap:125,used:97}],
    ganCards:[
      {id:"1",name:"גן רימון",symbol:"4402",age:"4",edu:"רגיל",campus:"קמפוס צפון",teacher:"שרה ברקוביץ׳",used:32,cap:32},
      {id:"2",name:"גן דובדבן",symbol:"4409",age:"3/4",edu:"רגיל",campus:"קמפוס צפון",teacher:"מלכה לוי",used:29,cap:32},
      {id:"3",name:"גן שקד",symbol:"4421",age:"5",edu:"רגיל",campus:"קמפוס מרכז",teacher:"",used:28,cap:32},
      {id:"4",name:"גן אגוז",symbol:"4470",age:"5",edu:"ח״מ",campus:"קמפוס דרום",teacher:"חנה זילברשטיין",used:11,cap:14}],
    activity:[{who:"רכזת רישום",ts:Date.now()-3600e3,what:"12 תלמידות שובצו לגן רימון"},
              {who:"מזכירות",ts:Date.now()-9e6,what:"ייבוא 34 רשומות ממועד ב׳"},
              {who:"מזכירות",ts:Date.now()-9e7,what:"דוח עירייה לחודש אב הופק"}]};},
  go(tab,filter){console.log('go',tab,JSON.stringify(filter||{}));}
};
document.addEventListener('DOMContentLoaded',function(){
  var n=document.getElementById('tabs'); if(n) n.innerHTML=${JSON.stringify(navHtml)};
});
<\/script>`;

const page='<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
  +'<meta name="viewport" content="width=device-width,initial-scale=1">\n'
  +'<title>מתקן בדיקה — עיצוב</title>\n'+style+'\n</head>\n<body>'+demo+stub+'\n</body>\n</html>\n';

const out=process.argv[2]||path.join(require('os').tmpdir(),'design-harness.html');
fs.writeFileSync(out,page);
console.log('נכתב:', out, '·', page.length, 'בתים (בלוק style:', style.length+')');
