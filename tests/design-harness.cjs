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

/* הכותרת העליונה — נלקחת כמות שהיא, כדי שכפתור החזרה והשבבים לא יתיישנו */
const ha=html.indexOf('<header class="top">');
const he=html.indexOf('</header>', ha);
if(ha<0||he<0) throw new Error('לא נמצאה הכותרת ב-index.html');
const header=html.slice(ha, he+'</header>'.length);

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
${header}

<div id="view" style="max-width:1200px;margin:0 auto;padding:18px 14px">
  ${process.env.HARNESS_TAB==='students'?'<div id="stuSummary" class="sticky"><div class="stats">'
    +'<div class="stat"><div class="k">רשומות</div><div class="v">906</div></div>'
    +'<div class="stat"><div class="k">משובצות</div><div class="v" style="color:var(--good)">897</div></div>'
    +'<div class="stat"><div class="k">ממתינות לשיבוץ</div><div class="v" style="color:var(--warn)">9</div></div>'
    +'<div class="stat"><div class="k">קלוט בעירייה</div><div class="v">818</div></div>'
    +'<div class="stat"><div class="k">לא קלוט</div><div class="v" style="color:var(--bad)">88</div></div>'
    +'</div></div>':''}
  ${process.env.HARNESS_TAB==='staff'?'<div class="panel"><div class="section-title"><h2>רשימת צוות הגנים</h2></div>'
    +'<div class="searchbar"><div class="search-field"><span class="mag">🔎</span><input placeholder="חיפוש שם / טלפון / עיר…"></div><button class="filter-toggle">☰ סינון</button></div>'
    +'<div class="toolbar"><button class="btn">➕ הוספת איש/אשת צוות</button><button class="btn ghost">📣 שליחת הודעות</button><button class="btn ghost">⬆️ ייבוא מקובץ</button></div>'
    +'<div id="staffTable"><div class="table-wrap"><table class="stu-table"><thead><tr><th>שם משפחה</th><th>שם פרטי</th><th>תפקיד</th><th>חינוך</th><th>נייד</th></tr></thead><tbody>'
    +'<tr><td><b>ברקוביץ׳</b></td><td>שרה</td><td>גננת</td><td>רגיל</td><td>052-8841190</td></tr>'
    +'<tr><td><b>לוי</b></td><td>מלכה</td><td>גננת</td><td>רגיל</td><td>053-3120774</td></tr>'
    +'<tr><td><b>בלוי</b></td><td>פייגי</td><td>סייעת</td><td>רגיל</td><td>054-8110297</td></tr>'
    +'</tbody></table></div></div></div>':''}
  ${process.env.HARNESS_TAB==='map'?'<div class="panel"><div class="row"><b>מפת שיבוץ</b>'
    +'<button class="btn sm" id="map-auto">⚡ שיבוץ אוטומטי לפי קרבה</button></div>'
    +'<details class="map-fold" open><summary>סינון וגנים להצגה</summary><div class="map-fold-body">'
    +'<div id="map-gan-list" style="max-height:150px;overflow:auto;padding:8px;border:1px solid var(--border);border-radius:10px">'
    +'<div style="border-top:1px dashed var(--border);padding:6px 0;margin-top:4px">'
    +'<label class="check"><input type="checkbox" data-camp="קמפוס צפון" checked> 🏫 קמפוס צפון <span class="hint">(3)</span></label>'
    +'<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:5px;padding-inline-start:18px">'
    +'<label class="check"><input type="checkbox" data-gid="1" checked> גן רימון</label>'
    +'<label class="check"><input type="checkbox" data-gid="2" checked> גן גפן</label>'
    +'<label class="check"><input type="checkbox" data-gid="3"> גן דובדבן</label>'
    +'<label class="check"><input type="checkbox" data-gid="4"> גן תפוח</label>'
    +'</div></div></div></div></details>'
    +'<div id="map-stage" style="height:280px;background:#e8ece7;border-radius:16px;margin-top:14px"></div>'
    +'</div>':''}
  ${process.env.HARNESS_TAB==='gans'?'<div class="panel"><div class="section-title"><h2>רשימת הגנים</h2></div>'
    +'<div class="searchbar"><div class="search-field"><span class="mag">🔎</span><input placeholder="חיפוש שם הגן / גננת / סמל / כתובת…"></div><button class="filter-toggle">☰ סינון</button></div>'
    +'<div class="toolbar"><button class="btn">➕ הוספת גן</button><button class="btn ghost">⬆️ ייבוא מקובץ</button><button class="btn ghost">📤 ייצוא / הדפסה</button></div>'
    +'<div id="ganTable"><div class="table-wrap"><table><thead><tr><th>שם הגן</th><th>גיל</th></tr></thead><tbody><tr><td>גן זית</td><td>3</td></tr></tbody></table></div></div></div>':''}
  ${process.env.HARNESS_TAB==='assign'?'<div class="panel"><div class="section-title"><h2>שיבוץ צוות</h2></div><div id="asgList"></div></div>':''}
  <div class="section-title">תיקי התלמידות · שנת תשפ״ח</div>

  ${process.env.HARNESS_TAB==='students'?'':`<div class="stats" style="margin:14px 0 18px">
    <div class="stat hero"><div class="k">רשומות</div><div class="v">412</div></div>
    <div class="stat"><div class="k">משובצות</div><div class="v">361</div></div>
    <div class="stat"><div class="k">ממתינות לשיבוץ</div><div class="v">51</div></div>
    <div class="stat"><div class="k">קלוט בעירייה</div><div class="v">338 <small>מתוך 412</small></div></div>
  </div>`}

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
              {name:"קמפוס דרום",cap:125,used:97},{name:"שדי חמד",cap:72,used:64},
              {name:"אבני נזר",cap:108,used:95},{name:"מרומי שדה",cap:108,used:79},
              {name:"ריטב״א",cap:108,used:93}],
    docBreak:[{label:"תקנון",missing:906},{label:"צילום תעודת זהות",missing:41},{label:"נספח",missing:12}],
    ganCards:[
      {id:"1",name:"גן זית",symbol:"4404",age:"3",edu:"רגיל",campus:"קמפוס צפון",teacher:"אסתר גרוס",ageInk:"#4c9a6a",ageKey:3,used:24,cap:32},
      {id:"2",name:"גן תפוח",symbol:"4418",age:"3",edu:"רגיל",campus:"קמפוס מרכז",teacher:"רבקה קליין",ageInk:"#4c9a6a",ageKey:3,used:30,cap:30},
      {id:"3",name:"גן דובדבן",symbol:"4409",age:"3/4",edu:"רגיל",campus:"קמפוס צפון",teacher:"מלכה לוי",ageInk:"#4c9a6a",ageKey:3,used:29,cap:32},
      {id:"4",name:"גן רימון",symbol:"4402",age:"4",edu:"רגיל",campus:"קמפוס צפון",teacher:"שרה ברקוביץ׳",ageInk:"#7a6bb0",ageKey:4,used:32,cap:32},
      {id:"5",name:"גן אגוז",symbol:"4470",age:"5",edu:"ח״מ",campus:"קמפוס דרום",teacher:"חנה זילברשטיין",ageInk:"#b08a2e",ageKey:5,used:11,cap:14},
      {id:"6",name:"גן שקד",symbol:"4421",age:"5",edu:"רגיל",campus:"קמפוס מרכז",teacher:"",ageInk:"#b08a2e",ageKey:5,used:28,cap:32}],
    activity:[{who:"רכזת רישום",ts:Date.now()-3600e3,what:"12 תלמידות שובצו לגן רימון"},
              {who:"מזכירות",ts:Date.now()-9e6,what:"ייבוא 34 רשומות ממועד ב׳"},
              {who:"מזכירות",ts:Date.now()-9e7,what:"דוח עירייה לחודש אב הופק"}]};},
  go(tab,filter){console.log('go',tab,JSON.stringify(filter||{}));},
  addStudent(){console.log('addStudent');},
  subtitle(tab){return {students:"906 תלמידות · תשפ\u05f4ז",gans:"29 גנים · 3 קמפוסים · תשפ\u05f4ז",
    staff:"מאגר כללי · 202 אנשי צוות פעילים · תשפ\u05f4ז"}[tab]||"תשפ\u05f4ז";},
  staffBoard(){return {total:202,ganenet:31,sayaat:21,noCert:9,assigned:178,unassigned:24};},
  ganColors(){return {"1":"#2c6a4c","2":"#3f7cac","3":"#7b5ea7","4":"#c65d5d"};},
  gansBoard(){return {total:6,campuses:[
    {name:"קמפוס צפון",cap:106,used:85,gans:[
      {id:"1",name:"גן זית",symbol:"4404",age:"3",edu:"רגיל",campus:"קמפוס צפון",teacher:"אסתר גרוס",teacherPhone:"055-6620481",active:true,ageInk:"#4c9a6a",ageKey:3,used:24,cap:32,waiting:0},
      {id:"3",name:"גן דובדבן",symbol:"4409",age:"3/4",edu:"רגיל",campus:"קמפוס צפון",teacher:"מלכה לוי",teacherPhone:"053-3120774",active:true,ageInk:"#4c9a6a",ageKey:3,used:29,cap:32,waiting:0},
      {id:"4",name:"גן רימון",symbol:"4402",age:"4",edu:"רגיל",campus:"קמפוס צפון",teacher:"שרה ברקוביץ׳",teacherPhone:"052-8841190",active:true,ageInk:"#7a6bb0",ageKey:4,used:32,cap:32,waiting:4}]},
    {name:"קמפוס מרכז",cap:62,used:58,gans:[
      {id:"2",name:"גן תפוח",symbol:"4418",age:"3",edu:"רגיל",campus:"קמפוס מרכז",teacher:"רבקה קליין",teacherPhone:"052-7003318",active:true,ageInk:"#4c9a6a",ageKey:3,used:30,cap:30,waiting:9},
      {id:"6",name:"גן שקד",symbol:"4421",age:"5",edu:"רגיל",campus:"קמפוס מרכז",teacher:"",teacherPhone:"",active:true,ageInk:"#b08a2e",ageKey:5,used:28,cap:32,waiting:0}]},
    {name:"קמפוס דרום",cap:14,used:11,gans:[
      {id:"5",name:"גן אגוז",symbol:"4470",age:"5",edu:"ח״מ",campus:"קמפוס דרום",teacher:"חנה זילברשטיין",teacherPhone:"054-8110297",active:true,ageInk:"#b08a2e",ageKey:5,used:11,cap:14,waiting:0}]}
  ]};},
  ageLegend(){return '<div class="hint" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-top:8px">'+
    ['3','4','5'].map(function(a){var c={3:'#4c9a6a',4:'#7a6bb0',5:'#b08a2e'}[a];
      return '<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:14px;border-radius:4px;border:1px solid var(--border);background:color-mix(in srgb, '+c+' 55%, var(--surface))"></span>גיל '+a+'</span>';}).join(' ')+
    ' <span style="color:var(--muted)">· גן דו-גילאי במעבר צבעים</span></div>';},
  openGan(id){console.log('openGan',id);},
  assignBoard(){return {context:"activity",contextLabel:"פעילות הגן",gans:[
    /* גן רגיל — שלושה תקנים מאוישים, כמו בלוח */
    {id:"1",name:"גן רימון",symbol:"4402",age:"4",edu:"רגיל",campus:"קמפוס צפון",
     reg:32,mandatory:false,bRole:"סייעת ב'",bMin:30,bEligible:true,freeDays:[],
     filled:[{role:"גננת",name:"שרה ברקוביץ׳",extraLabel:"",extra:"",students:""},
             {role:"סייעת",name:"פייגי בלוי",extraLabel:"",extra:"",students:""}]},
    /* גן מתחת לסף — התקן השלישי נעול */
    {id:"2",name:"גן שקד",symbol:"4421",age:"4",edu:"רגיל",campus:"קמפוס מרכז",
     reg:21,mandatory:false,bRole:"סייעת ב'",bMin:30,bEligible:false,
     freeDays:[{role:"ממלאת מקום",days:["כל השבוע"]}],
     filled:[{role:"סייעת",name:"חיה גולד",extraLabel:"",extra:"",students:""},
             {role:"סייעת ממלאת מקום",name:"ברכי רוט",extraLabel:"תקופה",extra:"3 חודשים",students:""}]},
    /* גן חובה (גיל 5) — אין סייעת ב׳ כלל */
    {id:"3",name:"גן אלון",symbol:"4433",age:"5",edu:"רגיל",campus:"קמפוס צפון",
     reg:34,mandatory:true,bRole:"סייעת ב'",bMin:30,bEligible:false,freeDays:[],
     filled:[{role:"גננת",name:"רבקה קליין",extraLabel:"",extra:"",students:""},
             {role:"סייעת",name:"טובה ויסמן",extraLabel:"",extra:"",students:""}]},
    /* ⚠️ המקרה שהלוח לא יודע להציג — חמישה תפקידים */
    {id:"4",name:"גן אגוז",symbol:"4470",age:"5",edu:"ח״מ",campus:"קמפוס דרום",
     reg:11,mandatory:true,bRole:"סייעת ב'",bMin:30,bEligible:false,
     freeDays:[{role:"משלימה",days:["ג׳","ה׳"]}],
     filled:[{role:"גננת",name:"חנה זילברשטיין",extraLabel:"",extra:"",students:""},
             {role:"סייעת",name:"נחמה פישר",extraLabel:"",extra:"",students:""},
             {role:"סייעת רפואית",name:"מרים לוין",extraLabel:"",extra:"",students:""},
             {role:"סייעת צמודה",name:"דבורה פרנקל",extraLabel:"",extra:"",students:"וייס שרה"},
             {role:"גננת משלימה",name:"רויזי שוורץ",extraLabel:"ימים",extra:"ג׳, ה׳",students:""}]}
  ]};}
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
