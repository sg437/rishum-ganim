/* ===========================================================================
   ui-lab.js — מעבדת עיצוב, שלב 2: סרגל צד קבוע
   ---------------------------------------------------------------------------
   נטען *רק* כשהמעבדה דלוקה (‎?ui=new‎). בתוכנה הרגילה הקובץ אינו נטען כלל,
   ולכן אינו יכול להשפיע על אף משתמש.

   מה הקובץ עושה — שלושה דברים שה-CSS לבדו לא יכול:
     1. קיבוץ הניווט לשתי קבוצות עם כותרות (יומיום · ניתוח והפקה)
     2. כרטיס יעד בתחתית הסרגל
     3. שורת המשתמש המחובר

   למה MutationObserver: renderTabs() בונה מחדש את #tabs בכל מעבר מסך ומוחק
   כל מה שהוספנו. הפונקציה יושבת בתוך <script type="module"> ולכן אינה
   נגישה מבחוץ לעטיפה. הצפייה בשינויי הצומת היא הדרך הנקייה להיצמד אליה
   בלי לגעת בקוד הקיים.

   הנתונים מגיעים מ-window.__uiLab.stats() — וו קריאה-בלבד ב-index.html,
   שגם הוא תחום לאותו דגל. אין כאן שום נתיב כתיבה למסד.
   =========================================================================== */
(function(){
"use strict";

/* קיבוץ הניווט לפי HANDOFF.md.
   הערה: המפרט מונה בקבוצה השנייה גם "ייצוא", שאינו לשונית בפני עצמה בתוכנה
   (הייצוא יושב בתוך המסכים). "מדריך" אינו מופיע במפרט כלל — שובץ כאן בסוף
   קבוצת הניתוח וההפקה, כמסך עיון. שתי הנקודות פתוחות להחלטה. */
var GROUPS = [
  { title:"יומיום",        tabs:["home","students","gans","map","staff","assign"] },
  { title:"ניתוח והפקה",   tabs:["templates","reports","municipality","management",
                                 "messages","tools","settings","guide"] }
];

var nav = document.getElementById("tabs");
var foot = document.querySelector(".drawer-foot");
if(!nav) return;               /* management.html / register.html — אין ניווט */

var busy = false;              /* מונע לולאה: השינויים שלנו מפעילים את הצופה */

/* מקטע הניווט מקבל סימון, כדי שה-CSS יוכל להסתיר את התווית "ניווט" שמעליו —
   היא כפולה מול כותרות הקבוצות שאנחנו מזריקים. */
var navSec = nav.closest(".drawer-sec");
if(navSec) navSec.classList.add("lab-navsec");

function groupNav(){
  for(var i=0;i<GROUPS.length;i++){
    var g = GROUPS[i], first = null;
    for(var k=0;k<g.tabs.length;k++){
      first = nav.querySelector('[data-tab="'+g.tabs[k]+'"]');
      if(first) break;
    }
    if(!first) continue;
    if(first.previousElementSibling &&
       first.previousElementSibling.classList.contains("lab-navgroup")) continue;
    var h = document.createElement("div");
    h.className = "lab-navgroup";
    h.textContent = g.title;
    nav.insertBefore(h, first);
  }
}

/* ---- כרטיס היעד ושורת המשתמש ----
   ⚠️ המפרט מבקש "כרטיס יעד רישום" (כמה נרשמו מתוך יעד). יעד רישום לתלמידות
   אינו קיים במודל הנתונים — מה שקיים בהגדרות הוא gansTarget, יעד מספר הגנים.
   לכן הכרטיס מציג את היעד שבאמת קיים, ומסומן ככזה. הוספת יעד רישום תדרוש
   שדה חדש בהגדרות, והיא החלטת מוצר ולא החלטת עיצוב. */
function targetCard(s){
  var box = document.getElementById("labTarget");
  if(!box){
    box = document.createElement("div");
    box.id = "labTarget";
    box.className = "lab-target";
    foot.insertBefore(box, foot.firstChild);
  }
  if(!s || !s.gansTarget){ box.style.display="none"; return; }
  box.style.display = "";
  var pct = Math.max(0, Math.min(100, Math.round(s.gansActive / s.gansTarget * 100)));
  box.innerHTML =
    '<div class="lt-head"><span class="lt-lbl">יעד גנים</span>'+
      '<span class="lt-year"></span></div>'+
    '<div class="lt-num"><b></b><span class="lt-of"></span></div>'+
    '<div class="lt-bar"><i></i></div>';
  /* טקסט דרך textContent — הנתונים מגיעים מהמסד ואין להזריק אותם כ-HTML */
  box.querySelector(".lt-year").textContent = s.year || "";
  box.querySelector(".lt-num b").textContent = String(s.gansActive);
  /* בלי רווחים סביב הלוכסן — עם רווחים היחס מתהפך ב-RTL (כלל ה-bidi ב-HANDOFF) */
  box.querySelector(".lt-of").textContent = "/" + s.gansTarget;
  box.querySelector(".lt-bar i").style.width = pct + "%";
}

function userRow(s){
  var row = document.getElementById("labUser");
  if(!row){
    row = document.createElement("div");
    row.id = "labUser";
    row.className = "lab-user";
    foot.appendChild(row);
  }
  var mail = (s && s.email) || "";
  if(!mail){ row.style.display="none"; return; }
  row.style.display = "";
  row.innerHTML = '<span class="lu-ini"></span><span class="lu-mail"></span>';
  row.querySelector(".lu-ini").textContent = mail.slice(0,2).toUpperCase();
  row.querySelector(".lu-mail").textContent = mail;
  row.title = mail;
}

function paint(){
  if(busy) return;
  busy = true;
  try{
    groupNav();
    if(foot){
      var s = (window.__uiLab && window.__uiLab.stats) ? window.__uiLab.stats() : null;
      targetCard(s);
      userRow(s);
    }
  }catch(e){ /* המעבדה לעולם לא תפיל את התוכנה */ }
  busy = false;
}

new MutationObserver(paint).observe(nav, {childList:true});
paint();

})();
