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

/* תוויות הניווט בקנבס קצרות מאלה שבקוד. שינוי המערך TABS עצמו היה משנה גם
   את התוכנה הרגילה, ולכן ההחלפה היא על הטקסט המוצג בלבד, בתוך המעבדה.
   מסך 02 בקנבס: "מסך בית" · "תלמידות" · "צוות" (בקוד: עמוד הבית / תיקי
   התלמידות / צוות הגנים). שאר התוויות זהות. */
var LABELS = { home:"מסך בית", students:"תלמידות", staff:"צוות" };

/* הקנבס משתמש בגליפים מונוכרומיים ולא באימוג׳י — נלקחו ממסך 02 אחד לאחד.
   (HANDOFF.md מתיר "אימוג׳י או גליפים"; הקנבס, שהוא המקור המחייב, בחר גליפים.)
   "מדריך" אינו מופיע בקנבס כלל, ולכן הגליף שלו הוא בחירה שלי. */
var ICONS = {
  home:"◫", students:"☰", gans:"⌂", map:"⌖", staff:"◈", assign:"⇄",
  templates:"▢", reports:"◔", municipality:"▤", management:"☏",
  messages:"✉", tools:"⚒", settings:"⚙", guide:"▧"
};

/* ⚠️ סקריפט שמוזרק דינמית אינו deferred — הדגל defer מתעלמים ממנו, והוא רץ
   ברגע שהגיע. לכן אסור לחפש אלמנטים כאן: ה-<body> עדיין לא נותח, החיפוש היה
   מחזיר null והמעבדה הייתה יוצאת בשקט בלי לעשות דבר. כל האיתור נדחה ל-init(). */
var nav = null, foot = null, view = null;

var busy = false;              /* מונע לולאה: השינויים שלנו מפעילים את הצופה */

/* החלטה 3: "ייצוא" מופיע בסרגל בקנבס, ו-viewExport כבר קיים בקוד ומחובר
   ב-route() — רק מנותק מהניווט. הלשונית מוזרקת כאן ולא נוספת ל-TABS, כדי
   שהתוכנה הרגילה תישאר בדיוק כפי שהיא עד לאישור הסופי. */
function exportTab(){
  if(nav.querySelector('[data-tab="export"]')) return;
  var after = nav.querySelector('[data-tab="municipality"]');
  if(!after) return;
  var b = document.createElement("button");
  b.dataset.tab = "export";
  b.innerHTML = '<span class="ic"></span><span class="tl"></span>';
  b.querySelector(".ic").textContent = "↧";
  b.querySelector(".tl").textContent = "ייצוא";
  b.onclick = function(){ go("export"); };
  after.parentNode.insertBefore(b, after.nextSibling);
}

/* החלטה 6: מוני הצוות והעירייה. renderTabs מחשב מונים לתלמידות ולגנים בלבד.
   מונה העירייה הוא התראה (רקע פליז), כמו בקנבס. */
function navCounts(s){
  if(!s) return;
  [["staff", s.staff, false], ["municipality", s.notMuni, true]].forEach(function(x){
    var btn = nav.querySelector('[data-tab="' + x[0] + '"]');
    if(!btn) return;
    var c = btn.querySelector(".count");
    if(!x[1]){ if(c) c.remove(); return; }
    if(!c){ c = document.createElement("span"); c.className = "count"; btn.appendChild(c); }
    var txt = String(x[1]);
    if(c.textContent !== txt) c.textContent = txt;   /* בלי זה — לולאת צופה */
    c.classList.toggle("alert", !!x[2]);
  });
}

function relabel(){
  for(var id in LABELS){
    var btn = nav.querySelector('[data-tab="'+id+'"] .tl');
    if(btn && btn.textContent !== LABELS[id]) btn.textContent = LABELS[id];
  }
  for(var gid in ICONS){
    var ic = nav.querySelector('[data-tab="'+gid+'"] .ic');
    if(ic && ic.textContent !== ICONS[gid]) ic.textContent = ICONS[gid];
  }
}

/* כותרת המשנה של המותג בקנבס היא שנה · מספר גנים, ולא שם הרשת */
function brandSub(s){
  var el = document.querySelector("#drawerBrand .txt .t2");
  if(!el || !s) return;
  var txt = s.year + (s.gansActive ? " · " + s.gansActive + " גנים" : "");
  if(el.textContent !== txt) el.textContent = txt;
}

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

/* ===========================================================================
   שלב 3 — מסך הבית (לוח 02 בקנבס)
   ---------------------------------------------------------------------------
   viewHome הקיים מרנדר לתוך #view. במקום לשנות אותו, המעבדה מחליפה את התוכן
   אחרי שהוא נכתב — אותו עיקרון של MutationObserver כמו בניווט.
   כל המספרים מגיעים מ-window.__uiLab.home(), שמחשב אותם מהנתונים החיים.
   =========================================================================== */

var homeBusy = false;

function el(tag, cls, txt){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(txt != null) e.textContent = txt;   /* תמיד textContent — לא innerHTML */
  return e;
}

/* יחס מספרי מבודד. כלל ה-bidi ב-HANDOFF.md: בלי רווחים סביב הלוכסן,
   אחרת 168 מתוך 180 מוצג כ-180 מתוך 168 (הקנבס עצמו נכשל בזה ב-15 מקומות). */
function ratio(a, b){
  var e = el("span", "lh-ratio");
  e.textContent = a + "/" + b;
  return e;
}

function greeting(){
  var h = new Date().getHours();
  if(h < 12) return "בוקר טוב";
  if(h < 17) return "צהריים טובים";
  if(h < 21) return "ערב טוב";
  return "לילה טוב";
}

function kpi(opts){
  var c = el("div", "lh-kpi" + (opts.dark ? " dark" : ""));
  c.appendChild(el("div", "lh-k", opts.label));
  var v = el("div", "lh-v", String(opts.value));
  if(opts.tone) v.classList.add(opts.tone);
  c.appendChild(v);
  if(opts.sub) c.appendChild(el("div", "lh-sub" + (opts.subTone ? " " + opts.subTone : ""), opts.sub));
  if(opts.bar != null){
    var bar = el("div", "lh-bar"), i = el("i");
    i.style.width = Math.max(0, Math.min(100, opts.bar)) + "%";
    bar.appendChild(i); c.appendChild(bar);
  }
  if(opts.ring != null){
    var pct = Math.max(0, Math.min(100, Math.round(opts.ring)));
    var ring = el("div", "lh-ring");
    ring.style.background = "conic-gradient(var(--lab-gold) 0 " + pct +
                            "%, rgba(255,255,255,.14) " + pct + "% 100%)";
    ring.appendChild(el("div", "lh-ring-in", pct + "%"));
    var wrap = el("div", "lh-kpi-body");
    while(c.firstChild) wrap.appendChild(c.firstChild);
    c.appendChild(wrap); c.appendChild(el("div", "lh-spacer")); c.appendChild(ring);
    c.classList.add("lh-kpi-ring");
  }
  return c;
}

function taskRow(n, tone, title, sub, btn, go){
  var r = el("div", "lh-task");
  var num = el("span", "lh-tnum " + tone, String(n));
  var mid = el("div", "lh-tmid");
  mid.appendChild(el("div", "lh-ttl", title));
  if(sub) mid.appendChild(el("div", "lh-tsub", sub));
  var b = el("button", "lh-tbtn" + (tone === "bad" ? " strong" : ""), btn);
  b.onclick = go;
  r.appendChild(num); r.appendChild(mid); r.appendChild(b);
  return r;
}

function panel(title, link, onLink){
  var p = el("div", "lh-panel");
  var h = el("div", "lh-phead");
  h.appendChild(el("h3", null, title));
  if(link){ var a = el("button", "lh-plink", link); a.onclick = onLink; h.appendChild(a); }
  p.appendChild(h);
  return p;
}

function go(tab, filter){
  if(window.__uiLab && window.__uiLab.go) window.__uiLab.go(tab, filter);
}

function renderHome(){
  if(!view) return;
  var d = (window.__uiLab && window.__uiLab.home) ? window.__uiLab.home() : null;
  if(!d) return;

  var root = el("div", "lab-home");

  /* --- כותרת --- */
  var head = el("div", "lh-head");
  var left = el("div");
  left.appendChild(el("div", "lh-date",
    new Date().toLocaleDateString("he-IL", {weekday:"long", day:"numeric", month:"long"})));
  left.appendChild(el("h2", "lh-greet", greeting() + (d.name ? ", " + d.name : "")));
  var bits = [];
  if(d.waiting) bits.push(d.waiting + " תלמידות ממתינות לשיבוץ");
  if(d.notMuni) bits.push(d.notMuni + " תיקים לא נקלטו בעירייה");
  left.appendChild(el("div", "lh-hsub", bits.length ? bits.join(", ") + "." : "אין משימות פתוחות."));
  head.appendChild(left);
  root.appendChild(head);

  /* --- ארבעת כרטיסי ה-KPI --- */
  var kpis = el("div", "lh-kpis");
  kpis.appendChild(kpi({
    dark:true, label:"סה״כ רשומות", value:d.total,
    sub:d.gansActive ? d.gansActive + " גנים פעילים" : "",
    ring: d.total ? d.placed / d.total * 100 : 0
  }));
  kpis.appendChild(kpi({
    label:"משובצות סופית", value:d.placed, tone:"good",
    bar: d.total ? d.placed / d.total * 100 : 0
  }));
  kpis.appendChild(kpi({
    label:"ממתינות לשיבוץ", value:d.waiting,
    sub: d.topAge ? d.topAgeN + " מהן בגיל " + d.topAge : ""
  }));
  var k4 = kpi({ label:"לא קלוט בעירייה", value:d.notMuni, tone:"bad" });
  if(d.notMuni){
    var lnk = el("button", "lh-klink", "דורש טיפול ←");
    lnk.onclick = function(){ go("students", {muni:"no"}); };
    k4.appendChild(lnk);
  }
  kpis.appendChild(k4);
  root.appendChild(kpis);

  /* --- שתי העמודות --- */
  var cols = el("div", "lh-cols");

  /* דורש טיפול */
  var tasks = panel("דורש טיפול");
  var any = false;
  if(d.notMuni){ any = true; tasks.appendChild(taskRow(d.notMuni, "bad",
    "תיקים שלא נקלטו בעירייה", "מתוך " + d.total + " תיקים פעילים", "טפל",
    function(){ go("students", {muni:"no"}); })); }
  if(d.waiting){ any = true; tasks.appendChild(taskRow(d.waiting, "warn",
    "ממתינות לשיבוץ",
    d.nearFull.length ? d.nearFull.slice(0,2).join(" ו") + " קרובים לתפוסה מלאה" : "",
    "לשיבוץ", function(){ go("students", {placed:"no"}); })); }
  if(d.missingDocs){ any = true; tasks.appendChild(taskRow(d.missingDocs, "warn",
    "תיקים עם מסמך חסר", d.topDoc ? "החסר הנפוץ: " + d.topDoc : "", "רשימה",
    function(){ go("students"); })); }
  if(d.noTeacherCount){ any = true; tasks.appendChild(taskRow(d.noTeacherCount, "good",
    "גנים ללא גננת משובצת",
    (d.noTeacherCampus.length ? d.noTeacherCampus.join(" · ") + " · " : "") + "לשנת " + d.year,
    "צוות", function(){ go("gans"); })); }
  if(!any) tasks.appendChild(el("div", "lh-empty", "אין משימות פתוחות. הכול מטופל."));
  cols.appendChild(tasks);

  /* עמודה שנייה */
  var side = el("div", "lh-side");

  var camps = panel("תפוסה לפי קמפוס");
  if(d.campuses.length){
    d.campuses.forEach(function(c){
      var row = el("div", "lh-camp");
      var top = el("div", "lh-camp-top");
      top.appendChild(el("b", null, c.name));
      var r = el("span", "lh-camp-n");
      r.appendChild(c.cap ? ratio(c.used, c.cap) : el("span", null, String(c.used)));
      top.appendChild(r);
      row.appendChild(top);
      var bar = el("div", "lh-bar"), i = el("i");
      var pct = c.cap ? Math.min(100, c.used / c.cap * 100) : 0;
      i.style.width = pct + "%";
      if(pct >= 95) i.classList.add("full");
      else if(pct >= 85) i.classList.add("near");
      bar.appendChild(i); row.appendChild(bar);
      camps.appendChild(row);
    });
  } else {
    camps.appendChild(el("div", "lh-empty", "לא הוגדרו קמפוסים."));
  }
  side.appendChild(camps);

  var act = panel("פעילות אחרונה");
  if(d.activity && d.activity.length){
    d.activity.forEach(function(a){
      var row = el("div", "lh-act");
      row.appendChild(el("span", "lh-adot"));
      var m = el("div");
      m.appendChild(el("div", "lh-atxt", a.what || "עדכון"));
      var when = new Date(a.ts);
      m.appendChild(el("div", "lh-awho",
        a.who + " · " + (isNaN(when) ? "" : when.toLocaleString("he-IL",
          {day:"numeric", month:"numeric", hour:"2-digit", minute:"2-digit"}))));
      row.appendChild(m);
      act.appendChild(row);
    });
  } else {
    act.appendChild(el("div", "lh-empty", "אין עדיין פעילות מתועדת."));
  }
  side.appendChild(act);

  cols.appendChild(side);
  root.appendChild(cols);

  /* --- כרטיסי הגנים ---
     לוח 02 בקנבס השמיט אותם, אבל HANDOFF.md §2 דורש אותם במפורש:
     "כרטיסי הגנים נשמרים, עם הגננת בתחתית הכרטיס וסימון ללא גננת
     משובצת באדום". המפרט גובר על השמטה בלוח. */
  if(d.ganCards && d.ganCards.length){
    var gp = panel("הגנים · תפוסה מול רף השיבוץ");
    var grid = el("div", "lh-gans");
    d.ganCards.forEach(function(g){
      var card = el("button", "lh-gan");
      card.onclick = function(){ go("gans"); };

      var top = el("div", "lh-gan-top");
      top.appendChild(el("b", null, g.name));
      if(g.edu && g.edu !== "רגיל") top.appendChild(el("span", "lh-gan-edu", g.edu));
      card.appendChild(top);

      var meta = [];
      if(g.symbol) meta.push("סמל " + g.symbol);
      if(g.age)    meta.push("גיל " + g.age);
      if(g.campus) meta.push(g.campus);
      card.appendChild(el("div", "lh-gan-meta", meta.join(" · ")));

      var cap = el("div", "lh-gan-cap");
      cap.appendChild(el("span", "lh-gan-caplbl", "תפוסה"));
      var r = el("span", "lh-gan-capn");
      r.appendChild(g.cap ? ratio(g.used, g.cap) : el("span", null, String(g.used)));
      cap.appendChild(r);
      card.appendChild(cap);

      var bar = el("div", "lh-bar"), bi = el("i");
      var pct = g.cap ? Math.min(100, g.used / g.cap * 100) : 0;
      bi.style.width = pct + "%";
      if(pct >= 100) bi.classList.add("full");
      else if(pct >= 85) bi.classList.add("near");
      bar.appendChild(bi); card.appendChild(bar);

      if(g.cap){
        var freeN = g.cap - g.used;
        card.appendChild(el("div", "lh-gan-free" + (freeN <= 0 ? " full" : ""),
          freeN > 0 ? freeN + " מקומות פנויים" : "מלא"));
      }

      /* הגננת בתחתית הכרטיס — ובאדום כשאין */
      card.appendChild(el("div", "lh-gan-t" + (g.teacher ? "" : " none"),
        g.teacher || "ללא גננת משובצת"));
      grid.appendChild(card);
    });
    gp.appendChild(grid);
    root.appendChild(gp);
  }

  homeBusy = true;
  view.innerHTML = "";
  view.appendChild(root);
  homeBusy = false;
}

/* ===========================================================================
   שלב 4 — תיקי התלמידות (לוח 01 בקנבס)
   ---------------------------------------------------------------------------
   כאן *לא* מחליפים את המסך. viewStudents מחזיק מיון, סינון, בחירה מרובה,
   התיק המקוצר בצד, קישורי דרייב ועדכון קבוצתי — כל אלה מחווטים בקוד הקיים,
   והחלפת ה-DOM הייתה שוברת אותם. לכן: עיצוב ב-CSS, ותוספות נקודתיות בלבד.

   שלוש תוספות: שורת ה-KPI מעל הטבלה, ראשי תיבות בעיגול לכל שורה,
   ומונה המסמכים (2/3) לצד מד שלושת הפסים.
   =========================================================================== */

function initialsFrom(name){
  var w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if(!w.length) return "";
  return (w[0].charAt(0) + (w[1] ? w[1].charAt(0) : "")).trim();
}

function studentsKpis(){
  var stage = view.querySelector(".stu-stage");
  if(!stage || view.querySelector(".lab-skpis")) return;
  var d = (window.__uiLab && window.__uiLab.home) ? window.__uiLab.home() : null;
  if(!d) return;
  var row = el("div", "lh-kpis lab-skpis");
  row.appendChild(kpi({ dark:true, label:"סה״כ רשומות", value:d.total,
    sub:d.gansActive ? d.gansActive + " גנים פעילים" : "",
    ring: d.total ? d.placed / d.total * 100 : 0 }));
  row.appendChild(kpi({ label:"משובצות סופית", value:d.placed, tone:"good",
    bar: d.total ? d.placed / d.total * 100 : 0 }));
  row.appendChild(kpi({ label:"ממתינות לשיבוץ", value:d.waiting,
    sub: d.topAge ? d.topAgeN + " מהן בגיל " + d.topAge : "" }));
  row.appendChild(kpi({ label:"לא קלוט בעירייה", value:d.notMuni, tone:"bad" }));
  stage.parentNode.insertBefore(row, stage);
}

function studentsRows(){
  /* ראשי תיבות — נגזרים מהשם שכבר בתא, בלי להיזקק לנתון נוסף */
  view.querySelectorAll(".stu-table .nm").forEach(function(nm){
    if(nm.previousElementSibling && nm.previousElementSibling.classList.contains("lab-ini")) return;
    var ini = initialsFrom(nm.textContent);
    if(!ini) return;
    var sp = el("span", "lab-ini", ini);
    nm.parentNode.insertBefore(sp, nm);
    nm.parentNode.classList.add("lab-namecell");
  });

  /* מונה המסמכים לצד המד */
  view.querySelectorAll(".stu-table .docchips").forEach(function(box){
    var chips = box.querySelectorAll(".docchip");
    if(!chips.length) return;
    var on = box.querySelectorAll(".docchip.on").length;
    var n = box.parentNode.querySelector(".lab-docn");
    if(!n){ n = el("span", "lab-docn"); box.parentNode.insertBefore(n, box.nextSibling); }
    /* רק אם השתנה — כתיבת textContent היא בעצמה שינוי DOM, ובלי התנאי
       הזה הצופה היה מפעיל את עצמו שוב ושוב בלולאה. */
    var txt = on + "/" + chips.length;            /* בלי רווחים — כלל ה-bidi */
    if(n.textContent !== txt) n.textContent = txt;
    box.classList.toggle("lab-docfull", on === chips.length);
  });
}

/* ===========================================================================
   שלב 7 — צביעת פסי התפוסה בכל המסכים
   ---------------------------------------------------------------------------
   בקנבס פס תפוסה מחליף צבע לפי כמה הוא מלא: ירוק · ענבר מ-85% · אדום ב-100%.
   הרוחב נקבע ב-style inline מתוך הקוד, ו-CSS אינו יכול להסתעף עליו — לכן
   הקריאה נעשית כאן. חל על כרטיסי הגנים, מסך הבית וכל מקום שמשתמש ב-.bar.
   =========================================================================== */
function tintBars(){
  view.querySelectorAll(".bar > i").forEach(function(i){
    var w = parseFloat(i.style.width);
    if(isNaN(w)) return;
    var cls = w >= 100 ? "full" : (w >= 85 ? "near" : "");
    if(i.dataset.labTint === cls) return;         /* בלי זה — לולאת צופה */
    i.dataset.labTint = cls;
    i.classList.remove("near", "full");
    if(cls) i.classList.add(cls);
  });
}

/* ===========================================================================
   שלב 6 — לוח התקנים בשיבוץ צוות (לוח 05 בקנבס)
   ---------------------------------------------------------------------------
   שתי סטיות מכוונות מהלוח, ושתיהן לטובת נאמנות לנתונים:

   1. אין תקרה של שלושה תקנים. הלוח מציג n/3, אבל במערכת 17 תפקידים, וגן עם
      גננת, סייעת, סייעת רפואית וגננת משלימה היה נחתך שם בלי להודיע. כאן
      מוצגים שלושת תקני הליבה תמיד, ובנוסף כרטיס לכל תפקיד אחר שמשובץ.
   2. אין גרירה. קלף פנוי פותח את מודאל openGanAssign הקיים — שמכיר את כל
      הכללים ובדוק. כך המעבדה נשארת קוראת-בלבד, וזו הסיבה שמותר להריץ אותה
      על הנתונים החיים.

   מוחלף רק תוכן #asgList. בורר ההקשר, הסיכום, בוחר הגן וכפתור הייצוא
   נשארים כמו שהם.
   =========================================================================== */

function slotCard(o){
  /* החלטה 1: קלף פנוי הוא כפתור שפותח את מודאל השיבוץ — שם כל 17 התפקידים,
     על הכללים הבדוקים. קלף נעול נשאר תצוגה בלבד. */
  var tag = (o.onOpen ? "button" : "div");
  var c = el(tag, "la-slot" + (o.cls ? " " + o.cls : ""));
  if(o.onOpen){ c.onclick = o.onOpen; c.title = "פתיחת שיבוץ הגן"; }
  c.appendChild(el("div", "la-role", o.role));
  if(o.name){
    var who = el("div", "la-who");
    who.appendChild(el("span", "la-ini", initialsFrom(o.name)));
    who.appendChild(el("b", null, o.name));
    c.appendChild(who);
  }else{
    c.appendChild(el("div", "la-empty-txt", o.emptyText || "תקן פנוי"));
  }
  if(o.extra) c.appendChild(el("div", "la-extra", o.extra));
  if(o.students) c.appendChild(el("div", "la-kids", "👧 " + o.students));
  return c;
}

function renderAssignBoard(host){
  var d = (window.__uiLab && window.__uiLab.assignBoard) ? window.__uiLab.assignBoard() : null;
  if(!d || !d.gans) return false;

  var board = el("div", "lab-asg");

  var legend = el("div", "la-legend");
  legend.appendChild(el("span", "la-lg on",   "מאויש"));
  legend.appendChild(el("span", "la-lg free", "תקן פנוי"));
  legend.appendChild(el("span", "la-lg lock", "נעול עד לסף"));
  board.appendChild(legend);

  d.gans.forEach(function(g){
    var row = el("div", "la-row");

    /* פרטי הגן */
    var info = el("div", "la-gan");
    var top = el("div", "la-gan-top");
    top.appendChild(el("b", null, g.name));
    if(g.edu && g.edu !== "רגיל") top.appendChild(el("span", "lh-gan-edu", g.edu));
    info.appendChild(top);
    var meta = [];
    if(g.symbol) meta.push("סמל " + g.symbol);
    if(g.age)    meta.push("גיל " + g.age);
    if(g.campus) meta.push(g.campus);
    info.appendChild(el("div", "la-gan-meta", meta.join(" · ")));
    info.appendChild(el("div", "la-gan-reg", g.reg + " רשומות"));
    if(g.mandatory) info.appendChild(el("div", "la-gan-mand", "גן חובה"));
    row.appendChild(info);

    /* הכרטיסים */
    var slots = el("div", "la-slots");
    var byRole = {};
    g.filled.forEach(function(f){ byRole[f.role] = f; });

    var shown = {}, filledN = 0, slotN = 0;
    var openThis = function(){
      if(window.__uiLab && window.__uiLab.openGan) window.__uiLab.openGan(g.id);
    };
    function addRole(role, opts){
      opts = opts || {};
      var f = byRole[role];
      shown[role] = true;
      if(f){ filledN++; slotN++;
        slots.appendChild(slotCard({ role:role, name:f.name, cls:"on",
          extra: f.extra ? (f.extraLabel ? f.extraLabel + ": " + f.extra : f.extra) : "",
          students: f.students }));
      }else if(opts.locked){
        slots.appendChild(slotCard({ role:role, cls:"lock",
          emptyText:"נפתחת מ-" + g.bMin + " בנות · כרגע " + g.reg }));
      }else{ slotN++;
        slots.appendChild(slotCard({ role:role, cls:"free", emptyText:"+ שיבוץ",
          onOpen:openThis }));
      }
    }

    /* שלושת תקני הליבה */
    addRole("גננת");
    addRole("סייעת");
    if(!g.mandatory) addRole(g.bRole, { locked: !g.bEligible });

    /* וכל תפקיד אחר שמשובץ בפועל — בלי תקרה */
    g.filled.forEach(function(f){
      if(shown[f.role]) return;
      filledN++; slotN++;
      slots.appendChild(slotCard({ role:f.role, name:f.name, cls:"on",
        extra: f.extra ? (f.extraLabel ? f.extraLabel + ": " + f.extra : f.extra) : "",
        students: f.students }));
    });
    /* קלף "+" בסוף השורה — כל תפקיד אחר מתוך 17, דרך המודאל */
    var add = el("button", "la-slot la-add");
    add.title = "הוספת תפקיד נוסף";
    add.appendChild(el("span", "la-add-plus", "+"));
    add.appendChild(el("span", "la-add-txt", "תפקיד נוסף"));
    add.onclick = openThis;
    slots.appendChild(add);

    row.appendChild(slots);

    /* המונה — בלי רווחים סביב הלוכסן */
    var side = el("div", "la-side");
    var cnt = el("div", "la-count" + (filledN === slotN ? " full" : ""));
    cnt.appendChild(ratio(filledN, slotN));
    side.appendChild(cnt);
    var edit = el("button", "la-edit", "עריכה");
    edit.onclick = function(){ if(window.__uiLab && window.__uiLab.openGan) window.__uiLab.openGan(g.id); };
    side.appendChild(edit);
    row.appendChild(side);

    if(g.freeDays.length){
      row.appendChild(el("div", "la-free", "🏖️ יום חופשי: " +
        g.freeDays.map(function(x){ return x.role + " (" + x.days.join(", ") + ")"; }).join(" · ")));
    }
    board.appendChild(row);
  });

  board.appendChild(el("div", "lh-empty",
    d.gans.length + " גנים · הקשר: " + d.contextLabel));

  host.innerHTML = "";
  host.appendChild(board);
  return true;
}

function maybeAssign(){
  if(homeBusy || !view) return;
  var b = nav.querySelector('[data-tab="assign"]');
  if(!(b && b.classList.contains("active"))) return;
  var host = view.querySelector("#asgList");
  if(!host || host.querySelector(".lab-asg")) return;
  homeBusy = true;
  try{ renderAssignBoard(host); }catch(e){}
  homeBusy = false;
}

function maybeStudents(){
  if(homeBusy || !view) return;
  var b = nav.querySelector('[data-tab="students"]');
  if(!(b && b.classList.contains("active"))) return;
  homeBusy = true;                                /* אותו דגל — חוסם כניסה חוזרת */
  try{ studentsKpis(); studentsRows(); }catch(e){}
  homeBusy = false;
}

function isHome(){
  var b = nav.querySelector('[data-tab="home"]');
  return !!(b && b.classList.contains("active"));
}

function maybeHome(){
  if(homeBusy || !view) return;
  try{ tintBars(); }catch(e){}
  if(!isHome()){ maybeStudents(); maybeAssign(); return; }
  if(view.querySelector(".lab-home")) return;   /* כבר שלנו */
  renderHome();
}

function paint(){
  if(busy) return;
  busy = true;
  try{
    exportTab();
    groupNav();
    relabel();
    var s = (window.__uiLab && window.__uiLab.stats) ? window.__uiLab.stats() : null;
    navCounts(s);
    brandSub(s);
    maybeHome();
    if(foot){
      targetCard(s);
      userRow(s);
    }
  }catch(e){ /* המעבדה לעולם לא תפיל את התוכנה */ }
  busy = false;
}

function init(){
  nav  = document.getElementById("tabs");
  foot = document.querySelector(".drawer-foot");
  view = document.getElementById("view");
  if(!nav) return;             /* management.html / register.html — אין ניווט */

  /* מקטע הניווט מקבל סימון, כדי שה-CSS יסתיר את התווית "ניווט" שמעליו —
     היא כפולה מול כותרות הקבוצות שאנחנו מזריקים. */
  var navSec = nav.closest(".drawer-sec");
  if(navSec) navSec.classList.add("lab-navsec");

  new MutationObserver(paint).observe(nav, {childList:true});
  if(view) new MutationObserver(maybeHome).observe(view, {childList:true, subtree:true});
  paint();
  maybeHome();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init, {once:true});
}else{
  init();
}

})();
