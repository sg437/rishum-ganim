/* ==========================================================================
   מערכת ניהול רשת הגנים  ·  Rishum Ganim
   Copyright © 2026 שמואל גולדמן (Shmuel Goldman). כל הזכויות שמורות / All rights reserved.

   תוכנה קניינית. אין להעתיק, לשכפל, להפיץ, לפרסם, לשנות, לתרגם, ליצור עבודות
   נגזרות או לעשות כל שימוש בקוד זה — כולו או חלקו — ללא אישור מפורש ובכתב
   מבעל הזכויות. הדבר חל גם על שכפול באמצעות כלי בינה מלאכותית או כל אמצעי
   אוטומטי אחר. עצם היכולת לצפות בקוד המקור בדפדפן אינה מעניקה כל רישיון.

   Proprietary. Unauthorized copying, distribution, modification, or derivative
   works — including reproduction by AI tools or any automated means — are
   prohibited. Source visibility in a browser grants no license.

   תנאים מלאים: קובץ LICENSE שבשורש הפרויקט.  ·  רישוי: sg@taharat.org
   ========================================================================== */

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
  { title:"ניתוח והפקה",   tabs:["templates","reports","management",
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
  templates:"▢", reports:"◔", management:"☏",
  messages:"✉", tools:"⚒", settings:"⚙", guide:"▧"
};

/* ⚠️ סקריפט שמוזרק דינמית אינו deferred — הדגל defer מתעלמים ממנו, והוא רץ
   ברגע שהגיע. לכן אסור לחפש אלמנטים כאן: ה-<body> עדיין לא נותח, החיפוש היה
   מחזיר null והמעבדה הייתה יוצאת בשקט בלי לעשות דבר. כל האיתור נדחה ל-init(). */
var nav = null, foot = null, view = null;

var busy = false;              /* מונע לולאה: השינויים שלנו מפעילים את הצופה */

/* שתי לשוניות שאינן בניווט של העיצוב החדש. renderTabs() בונה את הסרגל
   מחדש בכל מעבר מסך ומחזיר אותן, ולכן ההסרה חוזרת בכל צביעה.

   "ייצוא" (החלטה 3, מעודכנת): הקנבס הציג אותו כפריט ניווט, אבל בתוכנה
   הייצוא יושב *בתוך* המסכים — כפתור "ייצוא" שבלשונית התלמידות פותח את
   viewExport כחלון, ו-exportScreen() מעצב אותו בדיוק כפי שעיצב את הלשונית.

   "עירייה": לשונית שלמה עבור פעולה אחת — הדבקת רשימת ת"ז והתאמה. בעיצוב
   החדש הפעולה הזאת ירדה לתחתית חלון "עדכון לפי ת"ז" שבלשונית התלמידות,
   ליד עדכון קבוצתי אחר לפי אותה רשימת ת"ז. אותו מקטע בדיוק, אותו קוד
   (muniSectionHTML/wireMuniSection ב-index.html) — רק בלי לשונית משלו.
   המונה "לא נקלט בעירייה" לא אבד: הוא כרטיס במסך הבית, עם קישור לרשימה
   המסוננת. */
function dropTabs(){
  ["export", "municipality"].forEach(function(t){
    var b = nav.querySelector('[data-tab="' + t + '"]');
    if(b) b.remove();
  });
}

/* החלטה 6: מונה הצוות. renderTabs מחשב מונים לתלמידות ולגנים בלבד. */
function navCounts(s){
  if(!s) return;
  [["staff", s.staff, false]].forEach(function(x){
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

/* ===========================================================================
   נייד — סרגל לשוניות תחתון (לוח 16)
   ---------------------------------------------------------------------------
   מוצג רק מתחת ל-900px. המגירה נשארת קיימת ונפתחת מ"עוד", כך ששאר עשר
   הלשוניות נגישות ושום דבר לא נחסם.

   האייקונים הם הגליפים של שאר התוכנה ולא אימוג׳י — בלוח הם צבעוניים, ואצלנו
   כל הניווט מונוכרומי. "עוד" קיבל ⋯ ולא ☰, כי ☰ כבר שייך לתלמידות.
   =========================================================================== */
/* אין כאן "+": התוכנה עצמה מציגה כפתור מרחף בפינה השמאלית התחתונה, והוא
   כבר יודע להציע את פעולות ההוספה של המסך הפתוח. */
var BOTTOM = [
  { tab:"home",     icon:"◫", label:"בית" },
  { tab:"students", icon:"☰", label:"תלמידות" },
  { tab:"map",      icon:"⌖", label:"שיבוץ" },
  { menu:true,      icon:"⋯", label:"עוד" }
];

function bottomBar(){
  var bar = document.getElementById("labBottom");
  if(!bar){
    bar = document.createElement("nav");
    bar.id = "labBottom";
    bar.className = "lab-bottom";
    BOTTOM.forEach(function(it){
      var b = el("button", "lb-item");
      b.appendChild(el("span", "lb-ic", it.icon));
      b.appendChild(el("span", "lb-tx", it.label));
      if(it.menu){
        b.dataset.menu = "1";
        b.onclick = function(){ if(window.__uiLab && window.__uiLab.openMenu) window.__uiLab.openMenu(); };
      }else{
        b.dataset.for = it.tab;
        b.onclick = function(){ go(it.tab); };
      }
      bar.appendChild(b);
    });
    document.body.appendChild(bar);
  }
  /* סימון הלשונית הפעילה */
  bar.querySelectorAll("[data-for]").forEach(function(b){
    var src = nav.querySelector('[data-tab="' + b.dataset.for + '"]');
    var on  = !!(src && src.classList.contains("active"));
    if(b.classList.contains("on") !== on) b.classList.toggle("on", on);
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

/* ---- שורת המשתמש בתחתית הסרגל ----
   ⚠️ כרטיס "יעד גנים" שהיה כאן הוסר לבקשת המשתמש — הוא תפס את תחתית
   הסרגל ולא הוסיף מידע שאינו כבר במסך הבית ובדוחות. */
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

  /* הכפתורים בצד שמאל למעלה — לוח 02 */
  var acts = el("div", "lh-acts");
  var rep = el("button", "lh-btn ghost", "דוח יומי");
  rep.onclick = function(){ go("reports"); };   /* אין "דוח יומי" נפרד — מסך הדוחות */
  acts.appendChild(rep);
  var add = el("button", "lh-btn primary", "+ הוספת ילדה");
  add.onclick = function(){ if(window.__uiLab && window.__uiLab.addStudent) window.__uiLab.addStudent(); };
  acts.appendChild(add);
  head.appendChild(acts);

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
  var tasks = panel("דורש טיפול", "כל המשימות", function(){ go("students"); });
  var any = false;
  if(d.notMuni){ any = true; tasks.appendChild(taskRow(d.notMuni, "bad",
    "תיקים שלא נקלטו בעירייה", "מתוך " + d.total + " תיקים פעילים", "טפל",
    function(){ go("students", {muni:"no"}); })); }
  if(d.waiting){ any = true; tasks.appendChild(taskRow(d.waiting, "warn",
    "ממתינות לשיבוץ",
    d.nearFull.length ? d.nearFull.slice(0,2).join(" ו") + " קרובים לתפוסה מלאה" : "",
    "לשיבוץ", function(){ go("students", {placed:"no"}); })); }
  if(d.missingDocs){ any = true;
    /* פירוט לפי סוג — "906 מתוך 906" לבדו אינו אומר דבר */
    var br = (d.docBreak || []).filter(function(x){ return x.missing; })
               .map(function(x){ return x.label + " " + x.missing; }).join(" · ");
    tasks.appendChild(taskRow(d.missingDocs, "warn",
      "תיקים עם מסמך חסר", br, "רשימה", function(){ go("students"); })); }
  if(d.noTeacherCount){ any = true; tasks.appendChild(taskRow(d.noTeacherCount, "good",
    "גנים ללא גננת משובצת",
    (d.noTeacherCampus.length ? d.noTeacherCampus.join(" · ") + " · " : "") + "לשנת " + d.year,
    "צוות", function(){ go("gans"); })); }
  if(!any) tasks.appendChild(el("div", "lh-empty", "אין משימות פתוחות. הכול מטופל."));
  cols.appendChild(tasks);

  /* עמודה שנייה */
  var side = el("div", "lh-side");

  var camps = panel("תפוסה לפי קמפוס");
  var CAMP_SHOWN = 5;
  if(d.campuses.length){
    d.campuses.forEach(function(c, ci){
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
      if(ci >= CAMP_SHOWN) row.classList.add("lh-camp-more");
      camps.appendChild(row);
    });
    if(d.campuses.length > CAMP_SHOWN){
      var rest = d.campuses.length - CAMP_SHOWN;
      var more = el("button", "lh-more", "הצגת " + rest + " נוספים");
      more.onclick = function(){
        var open = camps.classList.toggle("lh-open");
        more.textContent = open ? "הצגת פחות" : "הצגת " + rest + " נוספים";
      };
      camps.appendChild(more);
    }
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
      /* מסגרת בצבע הגיל — מאותה מפה שהתוכנה כבר משתמשת בה (AGE_HUE) */
      if(g.ageInk) card.style.setProperty("--age-ink", g.ageInk);

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
    /* מקראת הגילאים — אותה מקראה שבמסכים הרגילים */
    var lg = (window.__uiLab && window.__uiLab.ageLegend) ? window.__uiLab.ageLegend() : "";
    if(lg){
      var box = el("div", "lh-legend");
      box.innerHTML = lg;                      /* מקור פנימי מהתוכנה, לא קלט משתמש */
      gp.appendChild(box);
    }
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

/* פס הסיכום של מסך התלמידות כבר קיים (#stuSummary), חי, ומגיב לסינון.
   הזרקת שורת KPI שנייה יצרה כפילות של אותם מספרים — לכן כאן רק מעצבים
   את הקיים: המשבצת הראשונה הופכת לכהה ומקבלת טבעת אחוזים. */
/* ===========================================================================
   מסך התלמידות — שורת הכרטיסים (לוח 01)
   ---------------------------------------------------------------------------
   בלוח ארבעה כרטיסים, לא חמישה: "קלוט בעירייה" אינו שם — הוא המשלים של
   "לא קלוט" ולא מוסיף מידע. לכל כרטיס שורת פירוט מתחת למספר, וכל כרטיס
   לחיץ ומסנן את הטבלה למה שכתוב עליו.
   =========================================================================== */
function styleStuSummary(){
  var sum = view.querySelector("#stuSummary");
  if(!sum) return;
  var tiles = sum.querySelectorAll(".stat");
  if(tiles.length < 5) return;

  var d = (window.__uiLab && window.__uiLab.stuKpis) ? window.__uiLab.stuKpis() : null;

  var num = function(t){
    var v = t.querySelector(".v");
    return v ? (parseInt(String(v.textContent).replace(/[^\d]/g, ""), 10) || 0) : 0;
  };
  var total = num(tiles[0]), placed = num(tiles[1]);

  /* --- הכרטיס הכהה: "סה״כ רשומות" עם טבעת ושורת המועד --- */
  var first = tiles[0];
  if(!first.classList.contains("lab-hero")) first.classList.add("lab-hero");
  var k0 = first.querySelector(".k");
  if(k0 && k0.textContent.indexOf("בגן") < 0 && k0.textContent !== "סה״כ רשומות"){
    k0.textContent = "סה״כ רשומות";
  }
  var pct = total ? Math.round(placed / total * 100) : 0;
  var ring = first.querySelector(".lh-ring");
  if(!ring){
    ring = el("div", "lh-ring");
    ring.appendChild(el("div", "lh-ring-in", ""));
    first.appendChild(ring);
  }
  var rtxt = pct + "%";
  if(ring.firstChild.textContent !== rtxt){
    ring.firstChild.textContent = rtxt;
    ring.style.background = "conic-gradient(var(--lab-gold) 0 " + pct +
                            "%, rgba(255,255,255,.14) " + pct + "% 100%)";
  }

  /* --- שורות הפירוט --- */
  function sub(tile, text, cls){
    if(!text) return;
    var e = tile.querySelector(".lab-ksub");
    if(!e){ e = el("div", "lab-ksub"); tile.appendChild(e); }
    if(cls && e.className.indexOf(cls) < 0) e.className = "lab-ksub " + cls;
    if(e.textContent !== text) e.textContent = text;    /* בלי זה — לולאת צופה */
  }
  if(d){
    if(d.sinceN) sub(first, "▲ " + d.sinceN + " מאז מועד " + d.sincePeriod, "gold");
    if(d.topAgeN) sub(tiles[2], d.topAgeN + " מהן בגילאי " + d.topAge);
  }
  /* מד התקדמות בכרטיס "משובצות סופית", כמו בלוח */
  var k1 = tiles[1].querySelector(".k");
  if(k1 && k1.textContent === "משובצות") k1.textContent = "משובצות סופית";
  var bar = tiles[1].querySelector(".lab-kbar");
  if(!bar){ bar = el("div", "lab-kbar"); bar.appendChild(el("i")); tiles[1].appendChild(bar); }
  bar.firstChild.style.width = pct + "%";

  /* "קלוט בעירייה" יורד — הוא המשלים של הכרטיס שלידו */
  tiles[3].classList.add("lab-hidden");

  var k4 = tiles[4].querySelector(".k");
  if(k4 && k4.textContent === "לא קלוט") k4.textContent = "לא קלוט בעירייה";
  sub(tiles[4], "דורש טיפול ←", "bad");

  /* --- כל כרטיס מסנן את הטבלה למה שכתוב עליו --- */
  var FILTER = [ {}, { placed:"yes" }, { placed:"no" }, null, { muni:"no" } ];
  Array.prototype.forEach.call(tiles, function(t, i){
    if(t.dataset.labClick || !FILTER[i]) return;
    t.dataset.labClick = "1";
    t.classList.add("lab-clickable");
    t.setAttribute("role", "button");
    t.setAttribute("tabindex", "0");
    var fire = function(){ go("students", FILTER[i]); };
    t.onclick = fire;
    t.onkeydown = function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); fire(); } };
  });
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
   שלב 6 — שיבוץ צוות (לוח 05 בקנבס)
   ---------------------------------------------------------------------------
   המסך בנוי כמו בלוח: כותרת ותת־כותרת, כפתור "ייצוא" בצד שמאל, רצועת
   ההקשרים ולצידה בורר "כרטיסים | טבלה", שלוש משבצות מספרים, ומתחתן שתי
   עמודות — "איוש לפי גן" והטור שבצד (זמינים לשיבוץ · ימי חופש · מניעת
   שיבוץ כפול).

   שלוש סטיות מכוונות מהלוח, כולן לטובת נאמנות לנתונים:

   1. אין תקרה של שלושה תקנים. הלוח מציג n/3, אבל במערכת 17 תפקידים, וגן עם
      גננת, סייעת, סייעת רפואית וגננת משלימה היה נחתך שם בלי להודיע. כאן
      מוצגים שלושת תקני הליבה תמיד, ובנוסף כרטיס לכל תפקיד אחר שמשובץ.
   2. אין גרירה. קלף פנוי פותח את מודאל openGanAssign הקיים — שמכיר את כל
      הכללים ובדוק. כך המעבדה נשארת קוראת-בלבד, וזו הסיבה שמותר להריץ אותה
      על הנתונים החיים.
   3. למקרא נוסף "נעול עד לסף" — מצב שלישי שקיים בנתונים (סייעת ב׳ שטרם
      הגיעה לסף הבנות) ואינו מיוצג בשני הצבעים שבלוח.

   "בחירת גן לשיבוץ" — הטבלה הכפולה שמעל הרשימה — מוסתרת: היא חוזרת על
   אותם גנים עצמם, ולחיצה על תקן פנוי כבר פותחת את אותו מודאל שיבוץ.
   הפקדים עצמם נשארים בדום ומחווטים, ולכן שום מנגנון לא אבד.
   =========================================================================== */

var asgMode = "list";              /* טבלה (רשימות) | כרטיסים */

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

/* קלפי התקנים של גן אחד — זהים בשני מצבי התצוגה (סעיף 6: הכרטיסיות
   נשארות בדיוק כפי שהן; רק האריזה סביבן משתנה). */
function ganSlots(g){
  var open = function(){
    if(window.__uiLab && window.__uiLab.openGan) window.__uiLab.openGan(g.id);
  };
  var slots = el("div", "la-slots");
  var byRole = {};
  g.filled.forEach(function(f){ byRole[f.role] = f; });

  var shown = {}, filledN = 0, slotN = 0;
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
        onOpen:open }));
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
  /* קלף "+" בסוף — כל תפקיד אחר מתוך 17, דרך המודאל */
  var add = el("button", "la-slot la-add");
  add.title = "הוספת תפקיד נוסף";
  add.appendChild(el("span", "la-add-plus", "+"));
  add.appendChild(el("span", "la-add-txt", "תפקיד נוסף"));
  add.onclick = open;
  slots.appendChild(add);

  return { box:slots, filled:filledN, total:slotN };
}

/* פרטי הגן — הבלוק הימני בשורה ובראש הכרטיס */
function ganInfo(g){
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
  return info;
}

/* שורת ימי החופש של הגן — ⚠️ בלי ההגנה הזו, שדה freeDays חסר זורק,
   וכל הלוח נעלם בשקט (הקריאה עטופה ב-try/catch). */
function ganFreeLine(g){
  var fd = g.freeDays || [];
  if(!fd.length) return null;
  return el("div", "la-free", "🏖️ יום חופשי: " +
    fd.map(function(x){ return x.role + " (" + (x.days || []).join(", ") + ")"; }).join(" · "));
}

function editBtn(g){
  var b = el("button", "la-edit", "עריכה");
  b.onclick = function(){ if(window.__uiLab && window.__uiLab.openGan) window.__uiLab.openGan(g.id); };
  return b;
}

/* --- מצב "טבלה": שורה בתוך לוח "איוש לפי גן", כמו בלוח ------------------ */
function ganRow(g){
  var row = el("div", "la-row");
  if(g.ageInk) row.style.setProperty("--age-ink", g.ageInk);   /* סעיף 9 */
  row.appendChild(ganInfo(g));

  var s = ganSlots(g);
  row.appendChild(s.box);

  var side = el("div", "la-side");
  var cnt = el("div", "la-count" + (s.filled === s.total ? " full" : ""));
  cnt.appendChild(ratio(s.filled, s.total));    /* בלי רווחים סביב הלוכסן */
  side.appendChild(cnt);
  side.appendChild(editBtn(g));
  row.appendChild(side);

  var free = ganFreeLine(g);
  if(free) row.appendChild(free);
  return row;
}

/* --- מצב "כרטיסים": כרטיס לכל גן, במסגרת צבע הגיל ---------------------- */
function ganAsgCard(g){
  var c = el("div", "la-card");
  if(g.ageInk) c.style.setProperty("--age-ink", g.ageInk);     /* סעיף 9 */

  var head = el("div", "la-card-head");
  head.appendChild(ganInfo(g));
  var s = ganSlots(g);
  var cnt = el("div", "la-count" + (s.filled === s.total ? " full" : ""));
  cnt.appendChild(ratio(s.filled, s.total));
  head.appendChild(cnt);
  c.appendChild(head);

  c.appendChild(s.box);

  var free = ganFreeLine(g);
  if(free) c.appendChild(free);

  var foot = el("div", "la-card-foot");
  foot.appendChild(editBtn(g));
  c.appendChild(foot);
  return c;
}

/* --- הטור שבצד (סעיף 10) ------------------------------------------------ */
function asidePanel(title, sub){
  var p = el("div", "la-panel");
  var h = el("div", "la-panel-h");
  h.appendChild(el("div", "la-panel-t", title));
  if(sub) h.appendChild(el("div", "la-panel-s", sub));
  p.appendChild(h);
  return p;
}

var POOL_MAX = 12;             /* הטור בצד אינו רשימת הצוות המלאה */

/* שורת צוות בטור שבצד — לחיצה פותחת את תיק השיבוץ: איפה משובצ/ת בשנה
   הפעילה, ומשם אפשר לשנות ולשבץ. אותו כרטיס בשלושת הלוחות שבטור. */
function staffRow(m, sub){
  var r = el("button", "la-prow");
  r.title = "פתיחת תיק השיבוץ";
  r.onclick = function(){
    if(window.__uiLab && window.__uiLab.openStaffAssign) window.__uiLab.openStaffAssign(m.id);
  };
  var ini = el("span", "la-ini", m.ini || initialsFrom(m.name));
  if(m.roleInk) ini.style.setProperty("--role-ink", m.roleInk);
  r.appendChild(ini);
  var b = el("div", "la-pmain");
  b.appendChild(el("div", "la-pname", m.name));
  if(sub) b.appendChild(el("div", "la-pmeta", sub));
  r.appendChild(b);
  return r;
}

/* "איפה משובצ/ת ובאיזה שיבוץ" — שורת המשנה הקטנה שמתחת לשם */
function placesLine(places, none){
  if(!places || !places.length) return none || "ללא שיבוץ בשנה זו";
  var first = places[0].gan + " · " + places[0].role;
  return places.length > 1 ? first + " · ועוד " + (places.length - 1) : first;
}

function poolPanel(d){
  var pool = d.pool || [];
  var p = asidePanel("זמינים לשיבוץ", "רק צוות מאותו חינוך של הגן");
  if(!pool.length){
    p.appendChild(el("div", "la-panel-empty", "כל הצוות הפעיל משובץ בהקשר זה."));
    return p;
  }
  pool.slice(0, POOL_MAX).forEach(function(m){
    var meta = [];
    if(m.role)  meta.push(m.role);
    if(m.years) meta.push(m.years + " שנות ותק");
    if(m.last)  meta.push(m.last);
    p.appendChild(staffRow(m, meta.join(" · ")));
  });
  if(pool.length > POOL_MAX)
    p.appendChild(el("div", "la-panel-more", "ועוד " + (pool.length - POOL_MAX) + " במאגר הצוות"));
  return p;
}

/* --- חלון החיפוש: מדגם אקראי, וחיפוש חי שקופץ כבר מהתו השני -------------
   הטור צר מכדי להחזיק מאגר של עשרות אנשי צוות, ולכן ברירת המחדל היא מדגם;
   מי שמחפש מישהו מסוים מקליד ומקבל אותו מיד. */
var FIND_MAX = 8;
var findQ = "";                /* נשמר בין רינדורים של הלוח */

function findPanel(){
  var p = asidePanel("חיפוש איש צוות", "");
  var head = p.querySelector(".la-panel-h");

  var box = el("div", "la-find");
  var inp = el("input", "la-findi");
  inp.type = "search";
  inp.placeholder = "הקלד/י שם, תפקיד או טלפון…";
  inp.value = findQ;
  box.appendChild(el("span", "la-findmag", "🔎"));
  box.appendChild(inp);
  head.appendChild(box);

  var list = el("div", "la-findlist");
  p.appendChild(list);

  function paintList(){
    var d = (window.__uiLab && window.__uiLab.staffFind)
              ? window.__uiLab.staffFind(findQ, FIND_MAX) : null;
    list.innerHTML = "";
    if(!d || !d.rows.length){
      list.appendChild(el("div", "la-panel-empty",
        findQ ? "אין איש/אשת צוות בשם הזה." : "אין צוות פעיל במאגר."));
      return;
    }
    d.rows.forEach(function(m){
      list.appendChild(staffRow(m, placesLine(m.places)));
    });
    if(!d.query && d.total > d.rows.length)
      list.appendChild(el("div", "la-panel-more",
        "מדגם מתוך " + d.total + " אנשי צוות — הקלד/י שם כדי למצוא מישהו/י מסוים/ת"));
  }

  /* ⚠️ בלי ה-blur/focus הזה הרינדור מחדש היה גוזל את הפוקוס באמצע ההקלדה */
  inp.oninput = function(){ findQ = inp.value; paintList(); };
  paintList();
  return p;
}

function freeDaysPanel(d){
  var p = asidePanel("🏖️ ימי חופש בגנים", "");
  var rows = [];
  (d.gans || []).forEach(function(g){
    (g.freeDays || []).forEach(function(x){
      rows.push({ gan:g.name, role:x.role, days:(x.days || []).join(", ") });
    });
  });
  if(!rows.length){
    p.appendChild(el("div", "la-panel-empty", "לא נרשמו ימי חופש בהקשר זה."));
    return p;
  }
  rows.forEach(function(r){
    var line = el("div", "la-fday");
    line.appendChild(el("b", null, r.gan));
    line.appendChild(el("span", null, " · " + r.role + ": " + r.days));
    p.appendChild(line);
  });
  return p;
}

/* שיבוץ בכמה גנים — שני מצבים שונים לחלוטין, ולכן שתי רשימות.
   משלימה שכל יום בגן אחר אינה תקלה אלא המצב התקין, וקודם היא נצבעה
   אדום כמו התנגשות. אדום נשמר לשתי ההתנגשויות האמיתיות בלבד:
   אותו יום בשני גנים, או תפקיד שאינו לפי ימים בשני גנים. */
function dupesPanel(d){
  var dupes = d.dupes || [], multi = d.multi || [];
  var p = asidePanel("שיבוץ בכמה גנים", "");

  if(!dupes.length && !multi.length){
    p.appendChild(el("div", "la-note ok", "אין שיבוץ כפול בהקשר זה ✓"));
    return p;
  }

  dupes.forEach(function(x){
    var n = el("button", "la-note la-note-b");
    n.title = "פתיחת תיק השיבוץ";
    n.onclick = function(){
      if(window.__uiLab && window.__uiLab.openStaffAssign) window.__uiLab.openStaffAssign(x.id);
    };
    n.appendChild(el("span", "la-note-i", "⚠"));
    var b = el("div", null);
    b.appendChild(el("div", "la-pname", x.name));
    b.appendChild(el("div", "la-note-w", x.reason));
    b.appendChild(el("div", "la-note-w", (x.where || []).map(function(w){
      return w.gan + " (" + w.role + (w.days && w.days.length ? " · " + w.days.join(", ") : "") + ")";
    }).join(" · ")));
    n.appendChild(b);
    p.appendChild(n);
  });

  if(multi.length){
    p.appendChild(el("div", "la-panel-sub",
      "משובצות בכמה גנים כדין — לפי ימים או בתפקיד סיוע:"));
    multi.forEach(function(x){
      p.appendChild(staffRow(x, (x.where || []).map(function(w){
        return w.gan + (w.days && w.days.length ? " (" + w.days.join(", ") + ")" : "");
      }).join(" · ")));
    });
  }
  return p;
}

/* --- הלוח כולו --------------------------------------------------------- */
function renderAssignBoard(host){
  var d = (window.__uiLab && window.__uiLab.assignBoard) ? window.__uiLab.assignBoard() : null;
  if(!d || !d.gans) return false;

  var wrap = el("div", "lab-asg lab-2col aside");

  /* --- לוח "איוש לפי גן" --- */
  var main = el("div", "la-main");
  var head = el("div", "la-phead");
  var ht = el("div", "la-phead-t");
  ht.appendChild(el("div", "la-ptitle", "איוש לפי גן"));
  var bMin = (d.gans[0] && d.gans[0].bMin) || 30;
  ht.appendChild(el("div", "la-psub",
    "לחיצה על תקן פנוי פותחת את שיבוץ הגן · סייעת ב׳ נפתחת מ-" + bMin +
    " בנות · בגן חובה (גיל 5) אין סייעת ב׳"));
  head.appendChild(ht);

  /* המקרא — שלושה מצבים, לא שניים (סעיף 5) */
  var legend = el("div", "la-legend");
  legend.appendChild(el("span", "la-lg on",   "מאויש"));
  legend.appendChild(el("span", "la-lg free", "תקן פנוי"));
  legend.appendChild(el("span", "la-lg lock", "נעול עד לסף"));
  head.appendChild(legend);
  main.appendChild(head);

  /* הגנים — כבר ממוינים לפי גיל עולה ואז א״ב (סעיף 8), בשני המצבים */
  if(asgMode === "cards"){
    var grid = el("div", "la-grid");
    d.gans.forEach(function(g){ grid.appendChild(ganAsgCard(g)); });
    main.appendChild(grid);
  }else{
    var list = el("div", "la-list");
    d.gans.forEach(function(g){ list.appendChild(ganRow(g)); });
    main.appendChild(list);
  }

  main.appendChild(el("div", "la-foot",
    d.gans.length + " גנים · הקשר: " + d.contextLabel));

  /* מקראת הגילאים — אותה מקראה של לשונית הגנים (סעיף 9) */
  var lg = (window.__uiLab && window.__uiLab.ageLegend) ? window.__uiLab.ageLegend() : "";
  if(lg){ var box = el("div", "lh-legend"); box.innerHTML = lg; main.appendChild(box); }

  wrap.appendChild(main);

  /* --- הטור שבצד --- */
  var side = el("div", "la-aside");
  side.appendChild(poolPanel(d));
  side.appendChild(freeDaysPanel(d));
  side.appendChild(findPanel());
  side.appendChild(dupesPanel(d));
  wrap.appendChild(side);

  host.innerHTML = "";
  host.appendChild(wrap);
  return true;
}

/* בורר ההקשר הוא <select> בקוד. הוא נשאר — ולצידו מוזרקות לשוניות
   שמניעות אותו, כמו בלוח. כך אין אובדן מנגנון. לצידן, בקצה השמאלי של
   אותה שורה, בורר "כרטיסים | טבלה" (סעיף 4). */
function assignTabs(){
  var sel = view.querySelector("#asgCtxSel");
  if(!sel || view.querySelector(".la-bar")) return;

  var bar   = el("div", "la-bar");
  var strip = el("div", "lab-ctx");
  Array.prototype.slice.call(sel.options).forEach(function(o){
    var b = el("button", "lab-ctxb" + (o.selected ? " on" : ""), o.textContent);
    b.onclick = function(){
      sel.value = o.value;
      sel.dispatchEvent(new Event("change", {bubbles:true}));
    };
    strip.appendChild(b);
  });
  bar.appendChild(strip);

  var tg = el("div", "la-mode");
  [["cards", "כרטיסים"], ["list", "טבלה"]].forEach(function(m){
    var b = el("button", "la-modeb" + (asgMode === m[0] ? " on" : ""), m[1]);
    b.dataset.mode = m[0];
    b.onclick = function(){
      if(asgMode === m[0]) return;
      asgMode = m[0];
      tg.querySelectorAll(".la-modeb").forEach(function(x){ x.classList.toggle("on", x === b); });
      var host = view.querySelector("#asgList");
      if(!host) return;
      homeBusy = true;
      try{ renderAssignBoard(host); }catch(e){}
      homeBusy = false;
    };
    tg.appendChild(b);
  });
  bar.appendChild(tg);

  /* הרצועה נכנסת *לפני* השורה הישנה של הבורר והכפתור, והשורה עצמה
     מסומנת — assignTop מסתיר אותה אחרי שהוא מוציא ממנה את "ייצוא". */
  var field = sel.closest(".field") || sel.parentNode;
  var row   = sel.closest(".row") || field;
  row.classList.add("la-oldrow");
  row.parentNode.insertBefore(bar, row);
  field.classList.add("lab-hidden");     /* ה-select נשאר בדום ומחווט */
}

/* הכותרת: "ייצוא" בצד שמאל, באותו כפתור שהתוכנה כבר חיווטה (סעיף 2) */
function assignTop(){
  var head = view.querySelector(".lab-shead");
  if(!head) return;
  var acts = head.querySelector(".lab-sacts");
  if(!acts){ acts = el("div", "lab-sacts"); head.appendChild(acts); }
  var xp = view.querySelector("#exportAsg");
  if(xp){
    if(xp.textContent.trim() !== "ייצוא") xp.textContent = "ייצוא";
    if(xp.parentNode !== acts) acts.appendChild(xp);     /* העברה — המאזין נשמר */
  }
  /* השורה שהחזיקה את הבורר ואת הכפתור נשארה ריקה — מסתירים אותה */
  var row = view.querySelector(".la-oldrow");
  if(row && !row.querySelector(".btn")) row.classList.add("lab-hidden");
}

/* "בחירת גן לשיבוץ" והכותרת שמעל הרשימה — כפילות מול הלוח (סעיף 7) */
function assignTrim(){
  var pick = view.querySelector(".asg-picker");
  if(pick) pick.classList.add("lab-hidden");
  var panel = view.querySelector(".panel");
  if(panel) panel.classList.add("lab-bare");
  view.querySelectorAll(".panel > h3").forEach(function(h){
    if(/רשימת השיבוץ/.test(h.textContent)) h.classList.add("lab-hidden");
  });
}

function assignKpis(){
  var host = view.querySelector("#asgList");
  if(!host || view.querySelector(".lab-akpis")) return;
  var d = (window.__uiLab && window.__uiLab.assignBoard) ? window.__uiLab.assignBoard() : null;
  var st = (window.__uiLab && window.__uiLab.staffBoard) ? window.__uiLab.staffBoard() : null;
  if(!d || !d.gans) return;

  var filled = 0, slots = 0, noTeacher = 0;
  d.gans.forEach(function(g){
    var byRole = {}; g.filled.forEach(function(f){ byRole[f.role] = 1; });
    var core = 2 + (g.mandatory ? 0 : (g.bEligible ? 1 : 0));
    slots += Math.max(core, g.filled.length);
    filled += g.filled.length;
    if(!byRole["גננת"]) noTeacher++;
  });

  var row = el("div", "lh-kpis lab-akpis");
  row.appendChild(kpi({
    dark:true, label:"תקנים מאוישים", value:filled,
    sub:(slots - filled) + " תקנים פתוחים",
    ring: slots ? filled / slots * 100 : 0
  }));
  row.appendChild(kpi({
    label:"גנים ללא גננת", value:noTeacher, tone:noTeacher ? "bad" : "good",
    sub:noTeacher ? "לשיבוץ לפני תחילת השנה" : ""
  }));
  var pool = (d.pool || []).length;
  row.appendChild(kpi({
    label:"זמינים לשיבוץ", value:pool, tone:"good",
    sub: st ? (st.ganenet + " גננות · " + st.sayaat + " סייעות במאגר") : ""
  }));
  host.parentNode.insertBefore(row, host);
}

function maybeAssign(){
  if(homeBusy || !view) return;
  var b = nav.querySelector('[data-tab="assign"]');
  if(!(b && b.classList.contains("active"))) return;
  homeBusy = true;
  try{ assignTabs(); assignKpis(); assignTop(); assignTrim(); }catch(e){}
  homeBusy = false;
  var host = view.querySelector("#asgList");
  if(!host || host.querySelector(".lab-asg")) return;
  homeBusy = true;
  try{ renderAssignBoard(host); }catch(e){}
  homeBusy = false;
}

/* ===========================================================================
   נייד — תיק הילדה כמסך מלא עם לשוניות (לוח 16, הטלפון השלישי)
   ---------------------------------------------------------------------------
   התיק במודאל בנוי מתשעה fieldset עם legend. הלוח מציג ארבע לשוניות —
   פרטים · מסמכים · משפחה · היסטוריה — ושתיים מהן אינן ניתנות למימוש כפי
   שהן: "משפחה" היא שדות ההורים, והם יושבים בתוך "פרטים אישיים" ולא במקטע
   נפרד; ו"היסטוריה" אינה קיימת במודל הנתונים כלל — אין יומן פר-תיק.

   לכן ארבע לשוניות לפי המקטעים האמיתיים, שמכסות את כל התשעה. המיפוי לפי
   טקסט ה-legend, וכל מקטע שלא זוהה נופל ללשונית האחרונה — כך שאף מקטע לא
   נעלם, גם אם ייווסף מקטע חדש בעתיד.

   אף אלמנט אינו מוזז: כל fieldset מקבל סימון, וההסתרה נעשית ב-CSS. הזזת
   צמתים הייתה מסכנת מאזינים שהקוד הקיים כבר קשר אליהם.
   =========================================================================== */
/* שמות הלשוניות לפי לוח 07. "משפחה וקשר" ו"היסטוריה" שבלוח אינם ניתנים
   למימוש: שדות ההורים יושבים בתוך "פרטים אישיים" ולא במקטע נפרד, ואין
   יומן פר-תיק במודל. ארבע לשוניות שמכסות את כל תשעת המקטעים. */
var PANES = [
  { name:"פרטי הילדה",   legends:["פרטים אישיים", "כתובת", "שיבוץ ורישום"] },
  { name:"מסמכים",       legends:["מסמכים", "תיקיית דרייב"] },
  { name:"תוכניות ושונות", legends:["תוכניות ומועדונים", "סיוע והעשרה", "שונות"] },
  { name:"הערות",        legends:["הערות וסיום"] }
];

function paneOf(legend){
  var t = String(legend || "").trim();
  for(var i = 0; i < PANES.length; i++){
    if(PANES[i].legends.indexOf(t) >= 0) return i;
  }
  return PANES.length - 1;      /* מקטע לא מוכר — לא נעלם, נופל לאחרונה */
}

function dossierTabs(){
  var modal = document.getElementById("modal");
  if(!modal) return;
  if(!modal.querySelector("#s-firstName")) return;      /* לא תיק ילדה */
  if(modal.querySelector(".lab-dtabs")) return;         /* כבר טופל */

  var sets = modal.querySelectorAll("fieldset");
  if(!sets.length) return;
  var used = {};
  sets.forEach(function(fs){
    var lg = fs.querySelector("legend");
    var p  = paneOf(lg && lg.textContent);
    fs.dataset.labPane = String(p);
    used[p] = true;
  });

  var strip = el("div", "lab-dtabs");
  PANES.forEach(function(pane, i){
    if(!used[i]) return;                                 /* לשונית בלי תוכן — לא מוצגת */
    var b = el("button", "lab-dtab" + (i === 0 ? " on" : ""), pane.name);
    b.onclick = function(){
      modal.dataset.labPane = String(i);
      strip.querySelectorAll(".lab-dtab").forEach(function(x){ x.classList.toggle("on", x === b); });
      modal.scrollTop = 0;
    };
    strip.appendChild(b);
  });
  modal.dataset.labPane = "0";

  /* שם הילדה ות״ז בכותרת, כמו בלוח */
  var h3 = modal.querySelector("h3");
  var fn = modal.querySelector("#s-firstName"), ln = modal.querySelector("#s-lastName");
  var tz = modal.querySelector("#s-tz");
  var full = [(ln && ln.value) || "", (fn && fn.value) || ""].join(" ").trim();

  var anchor = h3 || null;
  if(h3 && full){
    var who = el("div", "lab-dwho");
    who.appendChild(el("span", "lab-dini", initialsFrom(full)));
    var box = el("div", "lab-dwho-t");
    box.appendChild(el("div", "lab-dname", full));
    var meta = [];
    if(tz && tz.value) meta.push(tz.value);
    var age = modal.querySelector("#s-age"), gan = modal.querySelector("#s-ganId");
    if(age && age.value) meta.push("בת " + age.value);
    if(gan && gan.selectedIndex >= 0){
      var gt = (gan.options[gan.selectedIndex] || {}).textContent || "";
      if(gt && gt.indexOf("—") < 0) meta.push(gt.trim());
    }
    if(meta.length) box.appendChild(el("div", "lab-dtz", meta.join(" · ")));
    who.appendChild(box);
    h3.parentNode.insertBefore(who, h3.nextSibling);
    anchor = who;
  }
  if(anchor) anchor.parentNode.insertBefore(strip, anchor.nextSibling);
  else modal.insertBefore(strip, modal.firstChild);
}

/* ===========================================================================
   מסך הגנים — תצוגת כרטיסים (לוח 03)
   ---------------------------------------------------------------------------
   בורר טבלה / כרטיסים. תצוגת הטבלה נשארת של התוכנה בדיוק כפי שהיא;
   בתצוגת הכרטיסים מוחלף תוכן #ganTable בלבד. הנתונים מ-gansScoped(),
   כלומר החיפוש והסינון של המסך נשמרים.
   =========================================================================== */
var gansMode = "cards";          /* בלוח, "כרטיסים" הוא הפעיל */

function ganCard(g){
  var c = el("div", "lg-card" + (g.active ? "" : " off"));
  if(g.ageInk) c.style.setProperty("--age-ink", g.ageInk);

  /* לחיצה על כרטיס פותחת את תיק הגן — בדיוק כמו לחיצה על שורה בטבלה.
     בלי זה לוח הכרטיסים היה לצפייה בלבד, והמעבר בין "כרטיסים" ל"טבלה"
     שינה לא רק את המראה אלא גם את מה שאפשר לעשות במסך.
     role/tabindex ומקלדת — כי זה div ולא כפתור: כפתור עוטף היה מבטל את
     פריסת ה-flex של הכרטיס ואת הגלישה של שם הגן. */
  c.setAttribute("role", "button");
  c.tabIndex = 0;
  c.title = "פתיחת תיק הגן";
  var openFile = function(){
    if(window.__uiLab && window.__uiLab.editGan) window.__uiLab.editGan(g.id);
  };
  c.onclick = openFile;
  c.onkeydown = function(e){
    if(e.key === "Enter" || e.key === " " || e.key === "Spacebar"){ e.preventDefault(); openFile(); }
  };

  var top = el("div", "lg-top");
  var t = el("div", "lg-ttl");
  t.appendChild(el("b", null, g.name));
  if(g.edu && g.edu !== "רגיל") t.appendChild(el("span", "lh-gan-edu", g.edu));
  top.appendChild(t);
  top.appendChild(el("span", "lg-icon", "⌂"));
  c.appendChild(top);

  var meta = [];
  if(g.age) meta.push("גיל " + g.age);
  meta.push("חינוך " + (g.edu === "רגיל" ? "רגיל" : "מיוחד"));
  if(g.symbol) meta.push("סמל " + g.symbol);
  c.appendChild(el("div", "lg-meta", meta.join(" · ")));

  var cap = el("div", "lg-cap");
  cap.appendChild(el("span", "lg-cap-l", "תפוסה"));
  var r = el("span", "lg-cap-n");
  r.appendChild(g.cap ? ratio(g.used, g.cap) : el("span", null, String(g.used)));
  cap.appendChild(r);
  c.appendChild(cap);

  var bar = el("div", "lh-bar"), bi = el("i");
  var pct = g.cap ? Math.min(100, g.used / g.cap * 100) : 0;
  bi.style.width = pct + "%";
  if(pct >= 100) bi.classList.add("full"); else if(pct >= 85) bi.classList.add("near");
  bar.appendChild(bi); c.appendChild(bar);

  if(g.cap){
    var free = g.cap - g.used;
    c.appendChild(free > 0
      ? el("div", "lg-free", free + " מקומות פנויים")
      : el("div", "lg-free full", "מלא" + (g.waiting ? " · " + g.waiting + " בהמתנה" : "")));
  }

  /* הגננת בתחתית — ובאדום כשאין */
  var tr = el("div", "lg-teach" + (g.teacher ? "" : " none"));
  if(g.teacher){
    tr.appendChild(el("span", "lab-ini", initialsFrom(g.teacher)));
    var tb = el("div", null);
    tb.appendChild(el("div", "lg-tname", g.teacher));
    tb.appendChild(el("div", "lg-tsub", "גננת" + (g.teacherPhone ? " · " + g.teacherPhone : "")));
    tr.appendChild(tb);
  }else{
    tr.appendChild(el("span", "lab-ini q", "?"));
    var nb = el("div", null);
    nb.appendChild(el("div", "lg-tname", "ללא גננת משובצת"));
    nb.appendChild(el("div", "lg-tsub", "לשיבוץ לפני תחילת השנה"));
    tr.appendChild(nb);
  }
  c.appendChild(tr);
  return c;
}

/* המשבצת המקווקוות שבלוח — פותחת את "הוספת גן" הקיים, בלי נתיב חדש */
function addGanCard(campus){
  var c = el("button", "lg-add");
  c.type = "button";
  c.appendChild(el("span", "lg-add-plus", "+"));
  /* שמות הקמפוסים כבר פותחים ב"קמפוס" — בלי זה יוצא "לקמפוס קמפוס צפון" */
  var to = campus ? (campus.indexOf("קמפוס") === 0 ? " ל" + campus : " לקמפוס " + campus) : "";
  c.appendChild(el("span", "lg-add-t", "הוספת גן" + to));
  c.appendChild(el("span", "lg-add-s", "שם, גיל, תקן ותפוסה"));
  c.onclick = function(){ if(window.__uiLab && window.__uiLab.addGan) window.__uiLab.addGan(); };
  return c;
}

function renderGansBoard(host){
  var d = (window.__uiLab && window.__uiLab.gansBoard) ? window.__uiLab.gansBoard() : null;
  if(!d || !d.campuses) return false;

  var wrap = el("div", "lab-gans");
  d.campuses.forEach(function(camp){
    var head = el("div", "lg-camp");
    head.appendChild(el("b", null, camp.name));
    var sub = camp.gans.length === 1 ? "גן אחד" : camp.gans.length + " גנים";
    if(camp.cap) sub += " · " + camp.used + " מתוך " + camp.cap + " מקומות";
    head.appendChild(el("span", "lg-camp-sub", sub));
    wrap.appendChild(head);

    var grid = el("div", "lg-grid");
    camp.gans.forEach(function(g){ grid.appendChild(ganCard(g)); });
    grid.appendChild(addGanCard(camp.name));
    wrap.appendChild(grid);
  });

  /* מקראת הגילאים — אותה מקראה של המסכים הרגילים */
  var lg = (window.__uiLab && window.__uiLab.ageLegend) ? window.__uiLab.ageLegend() : "";
  if(lg){ var box = el("div", "lh-legend"); box.innerHTML = lg; wrap.appendChild(box); }

  host.innerHTML = "";
  host.appendChild(wrap);
  return true;
}

function gansToggle(host){
  var bar = view.querySelector(".lab-gtoggle");
  if(bar) return bar;                       /* גם אם כבר הועבר לכותרת */
  bar = el("div", "lab-gtoggle");
  [["cards", "כרטיסים"], ["table", "טבלה"]].forEach(function(m){
    var b = el("button", "lg-tab" + (gansMode === m[0] ? " on" : ""), m[1]);
    b.onclick = function(){
      if(gansMode === m[0]) return;
      gansMode = m[0];
      bar.querySelectorAll(".lg-tab").forEach(function(x){ x.classList.toggle("on", x === b); });
      if(window.__uiLab && window.__uiLab.go) window.__uiLab.go("gans");   /* רינדור מחדש */
    };
    bar.appendChild(b);
  });
  host.parentNode.insertBefore(bar, host);
  return bar;
}

/* ===========================================================================
   מסך הגנים — הסרגל העליון והסינון (לוח 03)
   ---------------------------------------------------------------------------
   בלוח: הכותרת "גנים" בלבד, ובצד שמאל "+ גן חדש · ייבוא · ייצוא" ולצידם
   בורר "כרטיסים | טבלה". שורת הסינון היא שבבים — בלי המילה "סינון".
   =========================================================================== */
/* "הוספת גן" אינו כאן — הוא בכפתור המרחף של התוכנה */
var GAN_TOP = ["impGan", "exportGans"];
var GAN_REN = { impGan:"ייבוא", exportGans:"ייצוא" };

function gansTop(){
  var head = view.querySelector(".lab-shead");
  if(!head) return;
  var h2 = head.querySelector("h2");
  if(h2 && h2.textContent.trim() === "רשימת הגנים") h2.textContent = "גנים";

  var acts = head.querySelector(".lab-sacts");
  if(!acts){ acts = el("div", "lab-sacts"); head.appendChild(acts); }
  orderInto(acts, GAN_TOP, GAN_REN);

  /* הבורר "כרטיסים | טבלה" עולה לכותרת, ליד הכפתורים */
  var bar = view.querySelector(".lab-gtoggle");
  if(bar && bar.parentNode !== acts){ bar.classList.add("in-head"); acts.insertBefore(bar, acts.firstChild); }
}

/* שורת הסינון של הגנים: שדה חיפוש ואחריו שבב לכל סינון — גיל, תפוסה,
   קמפוס, אזור. כל שבב מצביע על ה-<select> האמיתי שבפאנל הסינון (שנשאר
   בדף, מוסתר), ולכן הבחירה עוברת בדיוק באותו onchange של התוכנה. */
function gansFilters(){
  var sb = view.querySelector(".searchbar");
  if(!sb) return;
  if(!sb.classList.contains("lab-fbar")) sb.classList.add("lab-fbar");

  var chips = (window.__uiLab && window.__uiLab.ganChips) ? window.__uiLab.ganChips() : null;
  if(chips && !sb.querySelector(".lab-selchip")){
    chips.forEach(function(c){
      var sel = view.querySelector(c.sel);
      if(!sel) return;
      var chip = el("label", "lab-selchip");
      chip.appendChild(el("span", "lab-sclbl", c.label));
      /* העטיפה בפאנל נשארת ריקה אחרי ההעברה — מסתירים אותה, אחרת
         נראית שם תווית בלי פקד */
      var field = sel.closest(".field");
      chip.appendChild(sel);                    /* העברה — המאזין נשמר */
      if(field && !field.querySelector("select,input")) field.classList.add("lab-hidden");
      /* סימון הפעיל מיד עם הבחירה. addEventListener ולא onchange —
         כדי לא לדרוס את המאזין שהתוכנה כבר קשרה לאותו <select>. */
      sel.addEventListener("change", function(){
        chip.classList.toggle("on", !!sel.value);
      });
      sb.appendChild(chip);
    });
  }
  /* השבב מסומן כפעיל כשנבחר בו ערך */
  sb.querySelectorAll(".lab-selchip").forEach(function(chip){
    var sel = chip.querySelector("select");
    var on = !!(sel && sel.value);
    if(chip.classList.contains("on") !== on) chip.classList.toggle("on", on);
  });

  var tg = sb.querySelector(".filter-toggle");
  if(tg && tg.textContent.indexOf("עוד") < 0){
    /* "☰ סינון" → "עוד ▾"; הפאנל המלא נשאר ונפתח בלחיצה בלבד */
    var cnt = tg.querySelector(".fcount");
    tg.textContent = "עוד ▾";
    if(cnt) tg.appendChild(cnt);
  }
  if(tg && tg !== sb.lastElementChild) sb.appendChild(tg);
}

function maybeGans(){
  if(homeBusy || !view) return;
  var b = nav.querySelector('[data-tab="gans"]');
  if(!(b && b.classList.contains("active"))) return;
  var host = view.querySelector("#ganTable");
  if(!host) return;
  if(gansMode === "cards" && host.querySelector(".lab-gans")) return;
  homeBusy = true;
  try{
    gansToggle(host);
    if(gansMode === "cards") renderGansBoard(host);
    gansTop(); gansFilters();
  }catch(e){}
  homeBusy = false;
}

/* ===========================================================================
   מפת שיבוץ (לוח 04)
   ---------------------------------------------------------------------------
   בלוח המסך בנוי מארבעה בלוקים, בסדר הזה: כותרת עם שלושה כפתורים · כרטיס
   סינון אחד · המפה עם רשימת הצד · שלושה כרטיסי כלים מתחת. בתוכנה אותם
   פקדים מפוזרים בשני מקטעים מתקפלים ובשורת סינון נפרדת, ולכן כאן הם
   *מועברים* ואינם נבנים מחדש: כל מאזין שהתוכנה כבר קשרה ממשיך לעבוד —
   הסינון, הגאוקוד, Leaflet והשיבוץ האוטומטי אינם יודעים שהמסך זז.

   שלוש החלטות שאינן בלוח עצמו:
     · "🗺️ הצג על המפה" יורד — בלוח אין כפתור כזה, ולכן כל שינוי בבחירה
       מחיל את עצמו (‎__uiLab.mapShow‎ = ‎mapApply‎ של התוכנה).
     · בורר החינוך יורד — בורר החינוך הכללי (הכל · רגיל · ח״מ) כבר קובע
       את כל התוכנה. הסנכרון עצמו יושב ב-‎viewMap‎, במעבדה בלבד.
     · בורר הגנים נפתח כחלון לפי קמפוסים, ובראש הכרטיס נרשם — בגוון בהיר —
       כמה גנים נבחרו.
   =========================================================================== */

/* --- הכותרת: שם המסך, שורת המצב שהתוכנה כותבת, ושלושת הכפתורים --------- */
var MAP_TOP = ["map-refresh", "map-full-btn", "map-auto"];

function mapHead(){
  var panel = view.querySelector(".panel");
  if(!panel) return;
  var head = view.querySelector(".lab-maphead");
  if(!head){
    var h2 = panel.querySelector("h2");
    if(!h2) return;
    head = el("div", "lab-shead lab-maphead");
    var t = el("div", "lab-shead-t");
    h2.textContent = "מפת שיבוץ";                /* בלוח בלי האימוג׳י */
    t.appendChild(h2);                           /* העברה — לא בנייה מחדש */
    /* תת־הכותרת היא שורת המצב של התוכנה עצמה — ‎mapStatus()‎ ממשיך לכתוב
       אליה, ולכן היא תמיד אומרת את האמת על הטעינה ועל מה שמוצג. */
    var stt = view.querySelector("#map-status");
    if(stt) t.appendChild(stt);
    else{                                        /* דמו — אין שורת מצב חיה */
      var sub = (window.__uiLab && window.__uiLab.subtitle) ? window.__uiLab.subtitle("map") : "";
      if(sub) t.appendChild(el("div", "lab-ssub", sub));
    }
    head.appendChild(t);
    head.appendChild(el("div", "lab-sacts"));
    view.insertBefore(head, view.firstChild);
    panel.classList.add("lab-bare");             /* בלוח אין כרטיס עוטף */
  }
  orderInto(head.querySelector(".lab-sacts"), MAP_TOP);
  var apply = view.querySelector("#map-apply");
  if(apply && !apply.classList.contains("lab-hidden")) apply.classList.add("lab-hidden");
  /* השורה שהחזיקה את הכותרת התרוקנה — "הצג על המפה" הוא כל מה שנשאר בה */
  var row = panel.querySelector(":scope > .row");
  if(row && !row.classList.contains("lab-hidden") && !row.querySelector(".btn:not(.lab-hidden)")){
    row.classList.add("lab-hidden");
  }
}

/* --- החלה מחדש אחרי שינוי בבחירה (במקום "הצג על המפה") ------------------ */
var mapApplyT = 0;
function mapApplySoon(){
  clearTimeout(mapApplyT);
  mapApplyT = setTimeout(function(){
    try{ if(window.__uiLab && window.__uiLab.mapShow) window.__uiLab.mapShow(); }catch(e){}
  }, 60);
}

/* --- כרטיס הסינון: גנים להצגה · עיר · צבע התלמידות · כל התלמידות ------- */
var MAP_SELS = [ { sel:"#map-city", label:"עיר" }, { sel:"#map-color", label:"צבע התלמידות" } ];

function mapFilters(){
  var stage = view.querySelector("#map-stage");
  if(!stage) return;
  var card = view.querySelector(".lab-mapfilter");
  if(!card){
    card = el("div", "lab-mapfilter");
    var r1 = el("div", "lab-mfrow lab-mfgans");
    r1.appendChild(el("b", "lab-mflab", "גנים להצגה"));
    r1.appendChild(el("span", "lab-mfcount", ""));
    var pick = el("button", "btn ghost sm lab-mfpick", "בחירת גנים");
    pick.type = "button";
    pick.onclick = function(){ mapPickOpen(); };
    r1.appendChild(pick);
    card.appendChild(r1);
    card.appendChild(el("div", "lab-mfrow lab-mfsel"));
    card.appendChild(el("div", "lab-mflegend"));
    card.appendChild(el("div", "lab-mfhold"));   /* מחסן לבורר הגנים בין פתיחות */
    stage.parentNode.insertBefore(card, stage);
  }

  /* "בחר הכל" · "נקה" — הכפתורים של התוכנה עצמם, עם החלה מיד אחרי הלחיצה.
     addEventListener ולא onclick, כדי לא לדרוס את המאזין הקיים. */
  var gans = card.querySelector(".lab-mfgans");
  ["map-gan-all", "map-gan-none"].forEach(function(id){
    var b = view.querySelector("#" + id);
    if(!b) return;
    if(!b.dataset.labApply){ b.dataset.labApply = "1"; b.addEventListener("click", mapApplySoon); }
    if(b.parentNode !== gans) gans.appendChild(b);
  });

  /* הבוררים — <select> מועבר, לא נבנה מחדש */
  var sels = card.querySelector(".lab-mfsel");
  MAP_SELS.forEach(function(c){
    var sel = view.querySelector(c.sel);
    if(!sel || sel.closest(".lab-selchip")) return;
    var chip = el("label", "lab-selchip lab-mfchip");
    chip.appendChild(el("span", "lab-sclbl", c.label + ":"));
    hideField(sel);
    chip.appendChild(sel);
    if(c.sel === "#map-city") sel.addEventListener("change", mapApplySoon);
    sels.appendChild(chip);
  });
  var all = view.querySelector("#map-all-students");
  if(all){
    var lab = all.closest("label");
    if(lab && lab.parentNode !== sels){
      lab.classList.add("lab-mfall");
      hideField(all);
      sels.appendChild(lab);
      all.addEventListener("change", mapApplySoon);
    }
  }
  /* המקרא של "צבע התלמידות" — שורה משלו מתחת לבוררים, כפי שביקש הלוח */
  var lg = view.querySelector("#map-legend-txt");
  var lgBox = card.querySelector(".lab-mflegend");
  if(lg && lgBox && lg.parentNode !== lgBox){
    var subRow = lg.closest(".sub");
    lgBox.appendChild(lg);
    if(subRow) subRow.classList.add("lab-hidden");
  }
  /* בורר הגנים של התוכנה נשמר במחסן כל עוד החלון סגור */
  var hold = card.querySelector(".lab-mfhold");
  var list = document.getElementById("map-gan-list");
  if(!mapPickBox && list && hold && list.parentNode !== hold) hold.appendChild(list);
}

/* --- חלון בחירת הגנים (לפי קמפוסים) ------------------------------------ */
/* ⚠️ החלון *מארח* את ‎#map-gan-list‎ של התוכנה ואינו משכפל אותו: כל תיבת
   סימון נשארת עם ה-onchange שהתוכנה קשרה לה, כולל תיבת הקמפוס שמסמנת את
   כל הגנים שבו. ‎mapRenderGanList‎ בונה את התוכן מחדש בכל סימון, ולכן צופה
   קטן מחזיר עליו את מראה השבבים ומעדכן את המונה. */
var mapPickBox = null, mapPickMo = null;

function mapPickKey(e){ if(e.key === "Escape") mapPickClose(); }

function mapPickOpen(){
  if(mapPickBox) return;
  var list = document.getElementById("map-gan-list");
  if(!list) return;

  var ov  = el("div", "lab-pickov");
  var box = el("div", "lab-pick");

  var h = el("div", "lab-pick-h"), ht = el("div");
  ht.appendChild(el("div", "lab-pick-t", "גנים להצגה"));
  ht.appendChild(el("div", "lab-pick-s", "סימון לפי קמפוס · מה שנבחר יוצג על המפה"));
  h.appendChild(ht);
  var x = el("button", "lab-pick-x", "✕");
  x.type = "button"; x.title = "סגירה";
  x.onclick = function(){ mapPickClose(); };
  h.appendChild(x);
  box.appendChild(h);

  var body = el("div", "lab-pick-b");
  body.appendChild(list);                        /* העברה — המאזינים נשמרים */
  box.appendChild(body);

  var f = el("div", "lab-pick-f");
  f.appendChild(el("span", "lab-pick-c", ""));
  [["בחר הכל", "#map-gan-all"], ["נקה", "#map-gan-none"]].forEach(function(o){
    var b = el("button", "btn ghost sm", o[0]);
    b.type = "button";
    b.onclick = function(){ var t = view.querySelector(o[1]); if(t) t.click(); };
    f.appendChild(b);
  });
  var done = el("button", "btn lab-pick-ok", "סיום");
  done.type = "button";
  done.onclick = function(){ mapPickClose(); };
  f.appendChild(done);
  box.appendChild(f);

  ov.appendChild(box);
  ov.onclick = function(e){ if(e.target === ov) mapPickClose(); };
  document.body.appendChild(ov);
  mapPickBox = ov;
  document.addEventListener("keydown", mapPickKey);
  /* childList בלבד — mapChips משנה מאפיינים, ולכן אינו מעיר את הצופה */
  mapPickMo = new MutationObserver(function(){ mapChips(); mapPickCount(); });
  mapPickMo.observe(body, { childList:true, subtree:true });
  mapChips(); mapPickCount();
}

function mapPickClose(silent){
  var ov = mapPickBox;
  if(!ov) return;
  mapPickBox = null;
  document.removeEventListener("keydown", mapPickKey);
  if(mapPickMo){ mapPickMo.disconnect(); mapPickMo = null; }
  var list = ov.querySelector("#map-gan-list");
  var hold = view && view.querySelector(".lab-mfhold");
  if(list){
    /* המסך נבנה מחדש בזמן שהחלון היה פתוח → יש כבר בורר חדש, וזה שבידינו
       הוא עותק מת. מחזירים רק כשהמחסן עדיין על המסך. */
    if(hold && hold.isConnected) hold.appendChild(list);
    else list.remove();
  }
  ov.remove();
  mapPickCount();
  if(!silent) mapApplySoon();
}

/* המונה שליד "גנים להצגה" — בגוון בהיר, וגם בתחתית החלון */
function mapPickCount(){
  var list = document.getElementById("map-gan-list");
  if(!list) return;
  var all = list.querySelectorAll("input[data-gid]").length;
  var on  = list.querySelectorAll("input[data-gid]:checked").length;
  var txt = !all ? "אין גנים פעילים"
          : !on  ? "לא נבחרו גנים"
          : on === 1 ? "גן אחד נבחר מתוך " + all
          : on + " גנים נבחרו מתוך " + all;
  [".lab-mfcount", ".lab-pick-c"].forEach(function(sel){
    var n = (sel === ".lab-pick-c" && mapPickBox) ? mapPickBox.querySelector(sel) : view.querySelector(sel);
    if(n && n.textContent !== txt) n.textContent = txt;   /* בלי זה — לולאת צופה */
  });
}

/* --- שלושת כרטיסי הכלים שמתחת למפה ------------------------------------- */
/* הכותרות והתיאורים מהלוח; הפקדים עצמם הם של התוכנה ומועברים פנימה, כך
   שהחיפוש, המיקום הידני והטעינה עובדים בדיוק כמו במקטע "כלים נוספים". */
var MAP_TOOLS = [
  { key:"find",  title:"🔎 חיפוש תלמידה",
    sub:"מיקוד על המפה + טבלת מרחקים לגנים, בלי לפתוח את המפה הגדולה",
    pick:function(){ var i = view.querySelector("#map-child-search"); return i && i.closest(".row"); } },
  { key:"place", title:"📍 מיקום ידני — גן או תלמידה",
    sub:"קפיצה לכתובת, גרירה על המפה ושמירה — לא נדרס ע״י גאוקוד",
    pick:function(){ var i = view.querySelector("#place-kind"); return i && i.closest(".row"); } },
  { key:"load",  title:"🔄 טעינת מיקומי תלמידות",
    sub:"הכתובות מומרות פעם אחת ונשמרות",
    pick:function(){ var b = view.querySelector("#map-load-students"); return b && b.closest(".row"); } }
];

function mapTools(){
  var stage = view.querySelector("#map-stage");
  if(!stage) return;
  var row = view.querySelector(".lab-maptools");
  if(!row){
    row = el("div", "lab-maptools");
    MAP_TOOLS.forEach(function(t){
      var card = el("details", "lab-mtool");
      card.dataset.tool = t.key;
      var sum = el("summary");
      sum.appendChild(el("div", "lab-mt-t", t.title));
      sum.appendChild(el("div", "lab-mt-s", t.sub));
      card.appendChild(sum);
      card.appendChild(el("div", "lab-mt-b"));
      row.appendChild(card);
    });
    stage.parentNode.insertBefore(row, stage.nextSibling);
  }
  MAP_TOOLS.forEach(function(t){
    var card = row.querySelector('[data-tool="' + t.key + '"]');
    var body = card && card.querySelector(".lab-mt-b");
    var src  = t.pick();
    if(body && src && src.parentNode !== body) body.appendChild(src);   /* העברה */
  });
  /* המספרים החיים שהלוח מציג בכרטיס הטעינה */
  var d = (window.__uiLab && window.__uiLab.mapBoard) ? window.__uiLab.mapBoard() : null;
  var s = row.querySelector('[data-tool="load"] .lab-mt-s');
  if(d && s){
    var txt = d.stuLoc + " נטענו · " + d.stuPending + " ממתינות"
            + (d.stuNoAddr ? " · " + d.stuNoAddr + " ללא כתובת" : "")
            + (d.ganNoCity ? " · " + d.ganNoCity + " גנים ללא עיר בכרטיס" : "");
    if(s.textContent !== txt) s.textContent = txt;      /* בלי זה — לולאת צופה */
  }
  /* שני המקטעים המתקפלים של התוכנה — כל מה שבהם כבר עבר לכרטיסים */
  view.querySelectorAll("details.map-fold").forEach(function(fold){
    fold.classList.add("lab-hidden");
  });
}

/* בורר הגנים נשאר תיבות סימון בקוד — רק נראה כשבבים. הצבע של כל שבב הוא
   הצבע של אותו גן במפה (ganColor), כך שהשבב, הדגל והנקודה מדברים באותה שפה. */
function mapChips(){
  var box = document.getElementById("map-gan-list");
  if(!box) return;
  var colors = (window.__uiLab && window.__uiLab.ganColors) ? window.__uiLab.ganColors() : null;
  if(!colors) return;
  box.querySelectorAll("input[data-gid]").forEach(function(inp){
    var lab = inp.closest("label");
    if(!lab) return;
    var c = colors[inp.dataset.gid];
    if(c && lab.style.getPropertyValue("--gan-ink") !== c) lab.style.setProperty("--gan-ink", c);
    lab.classList.add("lab-ganchip");
  });
  box.querySelectorAll("input[data-camp]").forEach(function(inp){
    var lab = inp.closest("label");
    if(lab) lab.classList.add("lab-campchip");
  });
  box.classList.add("lab-chipbox");
}

/* מקראה על המפה — אינה קיימת בתוכנה, ומופיעה בלוח. נבנית מהגנים שנבחרו. */
function mapLegend(){
  var stage = view.querySelector("#map-stage");
  if(!stage) return;
  var colors = (window.__uiLab && window.__uiLab.ganColors) ? window.__uiLab.ganColors() : null;
  if(!colors) return;
  var box = view.querySelector(".lab-maplegend");
  if(!box){
    box = el("div", "lab-maplegend");
    stage.appendChild(box);
  }
  var rows = [];
  var list = document.getElementById("map-gan-list");
  if(list) list.querySelectorAll("input[data-gid]").forEach(function(inp){
    if(!inp.checked) return;
    var lab = inp.closest("label");
    rows.push([colors[inp.dataset.gid] || "#8894a0", (lab ? lab.textContent : "").trim()]);
  });
  var key = rows.map(function(r){ return r.join("|"); }).join(",");
  if(box.dataset.key === key) return;                 /* בלי זה — לולאת צופה */
  box.dataset.key = key;
  box.innerHTML = "";
  if(!rows.length){ box.style.display = "none"; return; }
  box.style.display = "";
  box.appendChild(el("div", "lml-h", "מקרא"));
  rows.slice(0, 8).forEach(function(r){
    var row = el("div", "lml-r");
    var dot = el("span", "lml-d");
    dot.style.background = r[0];
    row.appendChild(dot);
    row.appendChild(el("span", null, "רשומה ל" + r[1]));
    box.appendChild(row);
  });
  if(rows.length > 8) box.appendChild(el("div", "lml-more", "ועוד " + (rows.length - 8)));
}

function maybeMap(){
  if(homeBusy || !view) return;
  var b = nav.querySelector('[data-tab="map"]');
  if(!(b && b.classList.contains("active"))) return;
  homeBusy = true;
  try{ mapHead(); mapFilters(); mapTools(); mapChips(); mapLegend(); mapPickCount(); }catch(e){}
  homeBusy = false;
}

/* ===========================================================================
   צוות הגנים (לוח 04)
   ---------------------------------------------------------------------------
   המסך שהתוכנה בונה הוא פאנל אחד: כותרת, שורת חיפוש, פאנל סינון, שורת
   כפתורים וטבלה בת תשע עמודות. הלוח מציג משהו אחר לגמרי — ולכן כאן:

     · ארבע משבצות מספרים מעל הכול, הרביעית "שאר הצוות";
     · שורת החיפוש יורדת *מתחת* למשבצות ונכנסת לעמודת הרשימה, כך שברגע
       שנפתח תיק בצד היא מתכווצת איתה ואינה נמתחת מתחתיו;
     · שבבי תפקיד לבחירה מרובה במקום בורר יחיד בפאנל נפתח;
     · הרשימה מוצגת בחמש עמודות בלבד (שם · טלפון · תפקיד · משובצת ב־ ·
       סטטוס), בטבלה או בכרטיסים;
     · תיק מקוצר שנפתח בצד, באותם רכיבים של תיק הילדה (‎.stu-quick‎);
     · פס כהה בתחתית עם פעולות על מי שנבחרה.

   ⚠️ הרשימה נבנית כאן ואינה מעצבת את הטבלה של התוכנה: ‎renderStaffTable‎
   עושה ‎innerHTML=‎ ל-‎#staffTable‎ בכל צביעה ומוחק כל דבר שנוגעים בו
   בתוכו. לכן הרשימה שלנו יושבת כאחות שלו, והוא עצמו מוסתר. המיון, החיפוש
   והסינון נשארים של התוכנה — הכול עובר דרך ‎__uiLab.setStaffFilter‎ /
   ‎setStaffSort‎, שקוראים ל-‎renderStaffTable‎ המקורי.
   =========================================================================== */
var staffMode = "table";     /* טבלה | כרטיסים — "טבלה" הוא הפעיל בלוח */
var staffOpen = "";          /* מזהה התיק הפתוח בצד ("" = סגור) */

function staffData(){
  return (window.__uiLab && window.__uiLab.staffRows) ? window.__uiLab.staffRows() : null;
}

/* --- ארבע המשבצות ------------------------------------------------------- */
function staffKpis(){
  var stage = staffStage();
  if(!stage || view.querySelector(".lab-stkpis")) return;
  var d = (window.__uiLab && window.__uiLab.staffBoard) ? window.__uiLab.staffBoard() : null;
  if(!d) return;
  var row = el("div", "lh-kpis lab-stkpis");
  row.appendChild(kpi({
    dark:true, label:"סה״כ אנשי צוות", value:d.total,
    sub:d.assigned + " משובצים · " + d.unassigned + " ללא גן",
    ring: d.total ? d.assigned / d.total * 100 : 0
  }));
  var gs = d.ganenetSplit || {}, ss = d.sayaatSplit || {};
  row.appendChild(kpi({ label:"גננות", value:d.ganenet,
    sub:(gs.regular != null ? gs.regular + " רגיל · " + gs.special + " ח״מ" : "") }));
  row.appendChild(kpi({ label:"סייעות", value:d.sayaat,
    sub:(d.sayaatKinds && d.sayaatKinds.length)
        ? d.sayaatKinds.map(function(k){ return k.n + " " + k.role; }).join(" · ")
        : (ss.regular != null ? ss.regular + " רגיל · " + ss.special + " ח״מ" : "") }));
  /* המשבצת הרביעית: המשלים המדויק של שתי שלידה — מי שאינו גננת ואינו סייעת */
  row.appendChild(kpi({ label:"שאר הצוות", value:d.other || 0,
    sub:(d.otherKinds && d.otherKinds.length)
        ? d.otherKinds.map(function(k){ return k.n + " " + k.role; }).join(" · ")
        : "אין תפקידים נוספים" }));
  stage.parentNode.insertBefore(row, stage);
}

/* --- הכותרת וכפתורי הפעולה ---------------------------------------------- */
/* הסדר בלוח, מימין לשמאל: שליחת הודעות · ייבוא · ייצוא · הוספה.
   ל"ייצוא" לא היה כפתור בלשונית הזאת — הוא נבנה כאן ופותח את חלון ייצוא
   הצוות (‎labStaffExport‎), שמייצא בדיוק את הרשימה שעל המסך. */
/* "הוספת איש צוות" עבר לכפתור המרחף, ו"שליחת הודעות" ללשונית ההודעות */
var STAFF_TOP = ["impStaff", "labStaffExp"];

function staffTop(){
  var head = view.querySelector(".lab-shead");
  if(!head) return;

  var h2 = head.querySelector("h2");
  if(h2 && h2.textContent.trim() !== "צוות הגנים") h2.textContent = "צוות הגנים";

  var d = staffData();
  if(d){
    var line = head.querySelector(".lab-ssub");
    if(!line){
      line = el("div", "lab-ssub");
      var t = head.querySelector(".lab-shead-t");
      if(t) t.insertBefore(line, t.firstChild);
    }
    var year = (window.__uiLab && window.__uiLab.stats && window.__uiLab.stats()) || {};
    var txt = "מאגר כללי · " + d.pool + " אנשי צוות פעילים" + (year.year ? " · " + year.year : "");
    if(line.textContent !== txt) line.textContent = txt;
  }

  var acts = head.querySelector(".lab-sacts");
  if(!acts){ acts = el("div", "lab-sacts"); head.appendChild(acts); }

  if(!acts.querySelector("#labStaffExp")){
    var xp = el("button", "btn ghost", "↧ ייצוא");
    xp.id = "labStaffExp";
    xp.onclick = function(){
      if(window.__uiLab && window.__uiLab.staffExport) window.__uiLab.staffExport(null);
    };
    acts.appendChild(xp);
  }
  orderInto(acts, STAFF_TOP, { impStaff:"↥ ייבוא", labStaffExp:"↧ ייצוא" });
  [ "#impStaff", "#labStaffExp" ].forEach(function(sel){
    var b = acts.querySelector(sel);
    if(b && !b.classList.contains("ghost")) b.classList.add("ghost");
  });
}

/* --- הבמה: עמודת הרשימה + התיק בצד ------------------------------------- */
/* אותם רכיבים של מסך התלמידות (‎.stu-stage‎ ו-‎.stu-quick‎), ולכן כל שכבת
   העיצוב שכבר נבנתה להם — כותרת כהה, כפתור דביק, פריסת עמודה בנייד —
   חלה כאן בלי כפילות. */
function staffStage(){
  var host = view.querySelector("#staffTable");
  if(!host) return null;
  var stage = view.querySelector(".lab-ststage");
  if(stage) return stage;

  stage = el("div", "stu-stage lab-ststage");
  var main = el("div", "lab-stmain");
  host.parentNode.insertBefore(stage, host);
  stage.appendChild(main);
  stage.appendChild(el("aside", "stu-quick lab-stquick empty-state"));

  var card = el("div", "lab-tablecard");
  main.appendChild(card);
  card.appendChild(host);                       /* העברה — המאזינים נשמרים */

  var panel = stage.closest(".panel");
  if(panel) panel.classList.add("lab-bare");
  return stage;
}

/* --- שורת החיפוש והשבבים ------------------------------------------------ */
/* ⚠️ הפקדים *מועברים* ואינם נבנים מחדש: ‎#fs-q‎ נושא את ה-oninput שהתוכנה
   קשרה אליו, ו-‎#fs-status‎ את ה-onchange שלו. בנייה מחדש הייתה מנתקת את
   שניהם, והחיפוש והסטטוס היו מפסיקים לסנן. */
var STAFF_HEAD_ROLES = ["גננת", "סייעת"];       /* שני השבבים הקבועים שבלוח */

function staffFilters(){
  var stage = view.querySelector(".lab-ststage");
  var main  = view.querySelector(".lab-stmain");
  var sb    = view.querySelector(".searchbar");
  if(!stage || !main || !sb) return;

  if(!sb.classList.contains("lab-fbar")) sb.classList.add("lab-fbar");
  if(sb.parentNode !== main) main.insertBefore(sb, main.firstChild);   /* מתחת למשבצות */

  var inp = sb.querySelector("#fs-q");
  if(inp && inp.placeholder !== "חיפוש שם, ת״ז, טלפון או עיר…"){
    inp.placeholder = "חיפוש שם, ת״ז, טלפון או עיר…";
  }
  /* הפאנל הנפתח מיותר — שני הבוררים שבו עלו לשבבים */
  var tg = sb.querySelector("#staffFilterToggle");
  if(tg) tg.classList.add("lab-hidden");
  var fp = view.querySelector("#staffFilterPanel");
  if(fp) fp.classList.add("lab-hidden");

  var st = (window.__uiLab && window.__uiLab.staffFilterState) ? window.__uiLab.staffFilterState() : null;
  if(!st) return;

  if(!sb.dataset.labChips){
    sb.dataset.labChips = "1";

    /* שני השבבים הקבועים — כל אחד מוסיף/מוריד את עצמו מהבחירה */
    STAFF_HEAD_ROLES.forEach(function(role){
      var b = el("button", "lab-rchip", role);
      b.type = "button";
      b.dataset.role = role;
      b.onclick = function(){ toggleStaffRole(role); };
      sb.appendChild(b);
    });

    /* שאר התפקידים — שבב שנפתח, עם תיבת סימון לכל תפקיד (בחירה מרובה) */
    var more = el("details", "lab-mchip lab-rmore");
    var sum  = el("summary", null, "תפקידים נוספים");
    more.appendChild(sum);
    var menu = el("div", "msel-menu");
    st.roles.filter(function(r){ return STAFF_HEAD_ROLES.indexOf(r) < 0; })
      .forEach(function(role){
        var lab = el("label", "lab-ropt");
        var cb  = el("input");
        cb.type = "checkbox"; cb.value = role;
        cb.onchange = function(){ toggleStaffRole(role); };
        lab.appendChild(cb);
        lab.appendChild(el("span", null, role));
        menu.appendChild(lab);
      });
    more.appendChild(menu);
    sb.appendChild(more);

    /* "פעילים ▾" — ה-<select> של התוכנה בלבוש שבב */
    var sel = view.querySelector("#fs-status");
    if(sel){
      var chip = el("label", "lab-selchip lab-stchip");
      hideField(sel);
      chip.appendChild(sel);                    /* העברה — המאזין נשמר */
      sb.appendChild(chip);
    }

    /* "נקה" — יורד רק כשיש מה לנקות */
    var clr = el("button", "lab-rclear", "נקה");
    clr.type = "button";
    clr.onclick = function(){
      if(!window.__uiLab || !window.__uiLab.setStaffFilter) return;
      var q = sb.querySelector("#fs-q");
      if(q) q.value = "";
      window.__uiLab.setStaffFilter({ roles:[], role:"", q:"", status:"active" });
    };
    sb.appendChild(clr);
  }

  /* סימון המצב — בלי לכתוב אם לא השתנה, אחרת נוצרת לולאת צופה */
  var picked = st.picked || [];
  sb.querySelectorAll(".lab-rchip").forEach(function(b){
    b.classList.toggle("on", picked.indexOf(b.dataset.role) >= 0);
  });
  var extra = picked.filter(function(r){ return STAFF_HEAD_ROLES.indexOf(r) < 0; });
  var more2 = sb.querySelector(".lab-rmore");
  if(more2){
    more2.classList.toggle("on", !!extra.length);
    var lbl = extra.length ? ("תפקידים נוספים · " + extra.length) : "תפקידים נוספים";
    var sm = more2.querySelector("summary");
    if(sm && sm.textContent !== lbl) sm.textContent = lbl;
    more2.querySelectorAll('input[type="checkbox"]').forEach(function(cb){
      var on = picked.indexOf(cb.value) >= 0;
      if(cb.checked !== on) cb.checked = on;
    });
  }
  var stc = sb.querySelector(".lab-stchip");
  if(stc) stc.classList.toggle("on", st.status !== "active");
  var clr2 = sb.querySelector(".lab-rclear");
  if(clr2){
    var dirty = !!picked.length || st.status !== "active" ||
                !!(inp && String(inp.value || "").trim());
    clr2.classList.toggle("lab-hidden", !dirty);
  }
}

function toggleStaffRole(role){
  if(!window.__uiLab || !window.__uiLab.staffFilterState) return;
  var st = window.__uiLab.staffFilterState();
  if(!st) return;
  var next = (st.picked || []).slice();
  var i = next.indexOf(role);
  if(i >= 0) next.splice(i, 1); else next.push(role);
  window.__uiLab.setStaffFilter({ roles:next });
}

/* --- שורת ההתאמות והבורר טבלה/כרטיסים ----------------------------------- */
function staffMatchLine(d){
  var card = view.querySelector(".lab-ststage .lab-tablecard");
  if(!card || !d) return;
  var line = card.querySelector(".lab-mline");
  if(!line){
    line = el("div", "lab-mline");
    var w = el("span", "lab-mtxt");
    w.appendChild(el("b", "lab-mnum", ""));
    w.appendChild(el("span", "lab-mof", ""));
    line.appendChild(w);
    card.insertBefore(line, card.firstChild);

    var bar = el("div", "lab-gtoggle lab-sttoggle in-line");
    [["table", "טבלה"], ["cards", "כרטיסים"]].forEach(function(m){
      var b = el("button", "lg-tab" + (staffMode === m[0] ? " on" : ""), m[1]);
      b.onclick = function(){
        if(staffMode === m[0]) return;
        staffMode = m[0];
        bar.querySelectorAll(".lg-tab").forEach(function(x){ x.classList.toggle("on", x === b); });
        staffList();
      };
      bar.appendChild(b);
    });
    line.appendChild(bar);
  }
  var head = d.total + " אנשי צוות תואמים";
  var tail = " · מתוך " + d.pool;
  var bn = line.querySelector(".lab-mnum"), bo = line.querySelector(".lab-mof");
  if(bn && bn.textContent !== head) bn.textContent = head;   /* בלי זה — לולאת צופה */
  if(bo && bo.textContent !== tail) bo.textContent = tail;
}

/* --- הרשימה: חמש עמודות, בטבלה או בכרטיסים ------------------------------ */
/* העמודות שהלוח מציג בחוץ, ורק הן. שאר השדות של התיק (ת״ז, מייל, עיר,
   חינוך, ותק) נשארים בתיק שנפתח בצד ובייצוא. */
var STAFF_COLS = [
  { key:"lastName", label:"שם משפחה ופרטי", sort:true },
  { key:"mobile",   label:"טלפון",          sort:true },
  { key:"role",     label:"תפקיד",          sort:true },
  { key:"gan",      label:"משובצת ב־",      sort:true },
  { key:"status",   label:"סטטוס",          sort:true }
];

function staffRowClick(r){
  return function(e){
    if(e.detail > 1) return;                    /* לחיצה כפולה — התיק המלא */
    staffOpen = (staffOpen === r.id) ? "" : r.id;
    staffPaintList(); staffQuick(); staffBottom();
  };
}
function staffRowDbl(r){
  return function(){
    if(window.__uiLab && window.__uiLab.openStaffFull) window.__uiLab.openStaffFull(r.id);
  };
}

function staffCell(r, key){
  if(key === "lastName"){
    var c = el("div", "lab-namecell");
    c.appendChild(el("span", "lab-ini", r.ini));
    var t = el("div", "lab-stname");
    t.appendChild(el("b", null, r.name));
    if(r.tz) t.appendChild(el("span", "lab-sttz", r.tz));
    c.appendChild(t);
    return c;
  }
  if(key === "mobile"){
    /* בלי אייקוני הפעולה שלצד המספר — הם חוזרים בתיק שנפתח בצד */
    var p = el("span", "lab-stphone", r.phone || "—");
    return p;
  }
  if(key === "role"){
    var role = el("span", "lab-role", r.role || "—");
    if(r.roleInk){
      role.style.background = "color-mix(in srgb, " + r.roleInk + " 16%, transparent)";
      role.style.color = r.roleInk;
    }
    return role;
  }
  if(key === "gan"){
    if(!r.gan) return el("span", "lab-stpill bad", "לא משובצת");
    var g = el("div", "lab-stgan");
    g.appendChild(el("b", null, r.gan));
    if(r.ganRole) g.appendChild(el("span", null, r.ganRole));
    return g;
  }
  return el("span", "lab-stpill " + r.tone, r.status);
}

function staffTable(box, d){
  var wrap = el("div", "table-wrap");
  var tb = el("table");
  var thead = el("thead"), tr = el("tr");
  STAFF_COLS.forEach(function(c){
    var th = el("th", c.sort ? "sortable" : null, c.label);
    if(c.sort){
      if(d.sort && d.sort.key === c.key){
        th.appendChild(el("span", "arr", d.sort.dir > 0 ? "▲" : "▼"));
      }
      th.onclick = function(){
        if(window.__uiLab && window.__uiLab.setStaffSort) window.__uiLab.setStaffSort(c.key);
      };
    }
    tr.appendChild(th);
  });
  thead.appendChild(tr); tb.appendChild(thead);
  var tbody = el("tbody");
  d.rows.forEach(function(r){
    var row = el("tr", "clickable" + (r.id === staffOpen ? " sel" : "") + (r.active ? "" : " lab-left"));
    row.dataset.sid = r.id;
    STAFF_COLS.forEach(function(c){
      var td = el("td");
      td.appendChild(staffCell(r, c.key));
      row.appendChild(td);
    });
    row.onclick = staffRowClick(r);
    row.ondblclick = staffRowDbl(r);
    tbody.appendChild(row);
  });
  tb.appendChild(tbody);
  wrap.appendChild(tb);
  box.appendChild(wrap);
  box.appendChild(el("div", "hint lab-sthint",
    "לחיצה על שורה פותחת את תיק העובדת · לחיצה כפולה פותחת את התיק המלא"));
}

function staffCards(box, d){
  var grid = el("div", "lab-stgrid");
  d.rows.forEach(function(r){
    var c = el("button", "lab-stcard" + (r.id === staffOpen ? " on" : "") + (r.active ? "" : " lab-left"));
    c.type = "button";
    c.dataset.sid = r.id;
    c.appendChild(el("span", "lab-stpill " + r.tone + " lab-stbadge", r.status));

    var body = el("span", "lab-stcbody");
    body.appendChild(el("span", "lab-ini", r.ini));
    var t = el("span", "lab-stct");
    t.appendChild(el("span", "lab-stcname", r.name));
    t.appendChild(el("span", "lab-stcsub", r.phone || "ללא טלפון"));
    body.appendChild(t);
    c.appendChild(body);

    var foot = el("span", "lab-stcfoot");
    var role = el("span", "lab-role", r.role || "—");
    if(r.roleInk){
      role.style.background = "color-mix(in srgb, " + r.roleInk + " 16%, transparent)";
      role.style.color = r.roleInk;
    }
    foot.appendChild(role);
    foot.appendChild(el("span", "lab-stcgan" + (r.gan ? "" : " none"), r.gan || "לא משובצת"));
    c.appendChild(foot);

    c.onclick = staffRowClick(r);
    c.ondblclick = staffRowDbl(r);
    grid.appendChild(c);
  });
  box.appendChild(grid);
}

/* חתימת הרשימה — בלי זה כל בנייה מחדש מפעילה את הצופה, שקורא לנו שוב */
function staffSig(d){
  return staffMode + "|" + staffOpen + "|" + d.total + "|" + d.pool + "|" +
         (d.sort ? d.sort.key + d.sort.dir : "") + "|" +
         d.rows.map(function(r){ return r.id + r.gan + r.role + r.phone + r.status; }).join(",");
}

function staffList(){
  var card = view.querySelector(".lab-ststage .lab-tablecard");
  var host = view.querySelector("#staffTable");
  if(!card || !host) return;
  var d = staffData();
  if(!d) return;

  host.classList.add("lab-hidden");             /* הטבלה של התוכנה — מקור הנתונים בלבד */
  var box = card.querySelector(".lab-strows");
  if(!box){ box = el("div", "lab-strows"); card.appendChild(box); }

  var sig = staffSig(d);
  if(box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = "";
  box.classList.toggle("cards", staffMode === "cards");
  if(!d.rows.length){
    box.appendChild(el("div", "lab-empty", "אין אנשי צוות התואמים לסינון."));
    return;
  }
  if(staffMode === "cards") staffCards(box, d); else staffTable(box, d);
}

/* סימון השורה הפתוחה בלי לבנות את הרשימה מחדש */
function staffPaintList(){
  var box = view.querySelector(".lab-strows");
  if(!box) return;
  box.querySelectorAll("[data-sid]").forEach(function(tr){
    tr.classList.toggle("sel", tr.dataset.sid === staffOpen);
  });
  box.querySelectorAll(".lab-stcard").forEach(function(c){
    c.classList.toggle("on", c.dataset.sid === staffOpen);
  });
}

/* --- התיק המקוצר שנפתח בצד --------------------------------------------- */
function qf(k, v, cls){
  var f = el("div", "qf");
  f.appendChild(el("div", "k", k));
  var val = String(v == null ? "" : v).trim();
  f.appendChild(el("div", "v" + (val ? (cls ? " " + cls : "") : " dim"), val || "—"));
  return f;
}

function staffQuick(){
  var box = view.querySelector(".lab-stquick");
  if(!box) return;
  var d = (staffOpen && window.__uiLab && window.__uiLab.staffDossier)
            ? window.__uiLab.staffDossier(staffOpen) : null;
  if(!d){
    if(!box.classList.contains("empty-state")){
      box.classList.add("empty-state"); box.innerHTML = "";
    }
    return;
  }
  if(box.dataset.sid === d.id && !box.classList.contains("empty-state")) return;
  box.dataset.sid = d.id;
  box.classList.remove("empty-state");
  box.innerHTML = "";

  var card = el("div", "qcard");

  /* --- כותרת כהה: ראשי תיבות, שם, ותפקיד · גן · ותק --- */
  var head = el("div", "qhead");
  head.appendChild(el("span", "ini", d.ini));
  var ht = el("div", "lab-stqt");
  ht.appendChild(el("div", "qname", d.name));
  var bits = [];
  if(d.role) bits.push(d.role);
  if(d.placements.length) bits.push(d.placements.map(function(p){ return p.gan; }).join(" · "));
  else bits.push("לא משובצת");
  if(d.years) bits.push(d.years + " שנות ותק");
  ht.appendChild(el("div", "qtz", bits.join(" · ")));
  head.appendChild(ht);
  var x = el("button", "qclose", "✕");
  x.title = "סגירה";
  x.setAttribute("aria-label", "סגירת התיק המקוצר");
  x.onclick = function(){ staffOpen = ""; staffPaintList(); staffQuick(); staffBottom(); };
  head.appendChild(x);
  card.appendChild(head);

  /* --- פרטי הזהות והקשר --- */
  var g1 = el("div", "qgrid");
  g1.appendChild(qf('ת״ז', d.tz));
  g1.appendChild(qf("חינוך", d.edu));
  g1.appendChild(qf("נייד", d.mobile, "lab-ltr"));
  g1.appendChild(qf("מייל", d.email, "lab-ltr"));
  card.appendChild(g1);
  var g2 = el("div", "qgrid one");
  g2.appendChild(qf("כתובת", d.address));
  if(d.weeklyHours) g2.appendChild(qf("שעות שבועיות", d.weeklyHours));
  card.appendChild(g2);

  /* --- שלוש פעולות הקשר, כמו בלוח --- */
  var acts = el("div", "lab-stqacts");
  var link = function(label, href, cls){
    var a = el("a", "lab-stqact" + (cls ? " " + cls : ""), label);
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    return a;
  };
  var tel = d.mobile || d.phone;
  if(tel){
    acts.appendChild(link("☎ חיוג", "tel:" + tel.replace(/[^\d+]/g, "")));
    var wa = tel.replace(/\D/g, "").replace(/^0/, "972");
    acts.appendChild(link("💬 וואטסאפ", "https://wa.me/" + wa, "wa"));
  }
  if(d.email) acts.appendChild(link("✉ מייל", "mailto:" + d.email));
  if(acts.children.length) card.appendChild(acts);

  /* --- מסמכים --- */
  card.appendChild(el("div", "qsep"));
  card.appendChild(el("div", "qsec", "מסמכים"));
  d.docs.forEach(function(doc){
    var row = el("div", "qdoc " + (doc.on ? "on" : "off"));
    row.appendChild(el("span", "mark", doc.on ? "✓" : "○"));
    row.appendChild(el("span", null, doc.label));
    if(doc.link){
      var a = el("a", "grow", "📎 קובץ");
      a.href = doc.link; a.target = "_blank"; a.rel = "noopener";
      a.title = "פתיחת הקובץ";
      row.appendChild(a);
    }else{
      row.appendChild(el("span", "grow lab-stnofile", doc.on ? "ללא קובץ" : "חסר"));
    }
    card.appendChild(row);
  });

  /* --- נוכחות ---
     ⚠️ הלוח מציג שלוש משבצות ובהן גם "ימי חופש". במודל הצוות אין ימי
     חופש — יש היעדרויות ואיחורים בלבד. שתי משבצות אמיתיות עדיפות על
     שלוש שאחת מהן ריקה תמיד. */
  card.appendChild(el("div", "qsep"));
  card.appendChild(el("div", "qsec", "נוכחות" + (d.year ? " · " + d.year : "")));
  var att = el("div", "lab-statt");
  [["היעדרויות", d.absences], ["איחורים", d.lateness]].forEach(function(a){
    var t = el("div", "lab-stattc");
    t.appendChild(el("div", "k", a[0]));
    t.appendChild(el("div", "v", String(a[1])));
    att.appendChild(t);
  });
  card.appendChild(att);

  var full = el("button", "btn full", "פתיחת תיק העובדת המלא");
  full.onclick = function(){
    if(window.__uiLab && window.__uiLab.openStaffFull) window.__uiLab.openStaffFull(d.id);
  };
  card.appendChild(full);
  box.appendChild(card);

  /* --- תנועות בשנים קודמות --- */
  if(d.history.length){
    var h = el("div", "qcard");
    h.appendChild(el("div", "qsec", "תנועות בשנים קודמות"));
    d.history.slice(0, 8).forEach(function(m){
      var r = el("div", "lab-sthist" + (m.now ? " now" : ""));
      r.appendChild(el("span", "dot"));
      var t = el("div", null);
      t.appendChild(el("div", "lab-sthname", m.gan + " · " + m.role));
      t.appendChild(el("div", "lab-sthsub", m.year + (m.now ? " — נוכחי" : "") +
                                            (m.ctx ? " · " + m.ctx : "")));
      r.appendChild(t);
      h.appendChild(r);
    });
    box.appendChild(h);
  }

  /* --- הערות --- */
  if(d.notes.length){
    var n = el("div", "qcard");
    n.appendChild(el("div", "qsec", "הערות"));
    d.notes.slice(0, 5).forEach(function(t){
      n.appendChild(el("div", "lab-stnote", t));
    });
    box.appendChild(n);
  }
}

/* --- הפס הכהה שבתחתית ---------------------------------------------------- */
/* מופיע רק כשנבחרה עובדת. שלוש הפעולות שבלוח, כולן אמיתיות: מעבר למסך
   השיבוץ, פתיחת התיק המלא (שם נרשמות ההיעדרויות), וייצוא הבחירה. */
function staffBottom(){
  var main = view.querySelector(".lab-stmain");
  if(!main) return;
  var bar = main.querySelector(".lab-stbot");
  var d = (staffOpen && window.__uiLab && window.__uiLab.staffDossier)
            ? window.__uiLab.staffDossier(staffOpen) : null;
  if(!d){
    if(bar) bar.remove();
    return;
  }
  if(!bar){
    bar = el("div", "lab-stbot");
    bar.appendChild(el("b", "lab-stbname", ""));
    var acts = el("div", "lab-stbacts");
    [["שיבוץ לגן…", "", function(){ go("assign"); }],
     ["רישום היעדרות", "", function(){
        if(window.__uiLab && window.__uiLab.openStaffFull) window.__uiLab.openStaffFull(staffOpen); }],
     ["ייצוא הבחירה", "light", function(){
        if(window.__uiLab && window.__uiLab.staffExport) window.__uiLab.staffExport([staffOpen]); }]
    ].forEach(function(a){
      var b = el("button", "btn" + (a[1] ? " " + a[1] : ""), a[0]);
      b.onclick = a[2];
      acts.appendChild(b);
    });
    bar.appendChild(acts);
    main.appendChild(bar);
  }
  var nm = bar.querySelector(".lab-stbname");
  var txt = "נבחרה: " + d.name;
  if(nm && nm.textContent !== txt) nm.textContent = txt;   /* בלי זה — לולאת צופה */
}


/* שורת "N תואמים · מתוך M" מעל הטבלה, כמו בלוחות. הספירה נלקחת מהדום
   של הטבלה עצמה, ולכן היא תמיד תואמת למה שמוצג בפועל אחרי סינון. */
function matchLine(hostSel, word, totalFromStats){
  var host = view.querySelector(hostSel);
  if(!host) return;
  var shown = host.querySelectorAll("tbody tr").length;
  var line = view.querySelector(".lab-mline");
  if(!line){
    line = el("div", "lab-mline");
    var w = el("span", "lab-mtxt");
    w.appendChild(el("b", "lab-mnum", ""));
    w.appendChild(el("span", "lab-mof", ""));
    line.appendChild(w);
    /* מחוץ ל-.stu-stage, שאם לא כן הוא הופך לעמודה בתוך ה-flex.
       studentsCard מכניס אותו אחר כך לכרטיס הלבן יחד עם הטבלה. */
    var stage = host.closest(".stu-stage") || host;
    stage.parentNode.insertBefore(line, stage);
  }
  var head = shown + " " + word;
  var tail = " · מתוך " + totalFromStats;
  var bn = line.querySelector(".lab-mnum"), bo = line.querySelector(".lab-mof");
  if(bn && bn.textContent !== head) bn.textContent = head;   /* בלי זה — לולאת צופה */
  if(bo && bo.textContent !== tail) bo.textContent = tail;
}

function maybeStaff(){
  if(homeBusy || !view) return;
  var b = nav.querySelector('[data-tab="staff"]');
  if(!(b && b.classList.contains("active"))){ staffOpen = ""; return; }
  homeBusy = true;
  try{
    staffStage(); staffKpis(); staffTop(); staffFilters();
    var d = staffData();
    if(d){
      /* התיק שהיה פתוח ונשר מהסינון — נסגר, אחרת הפס התחתון היה מציג
         שם שכבר אינו ברשימה. */
      if(staffOpen && !d.rows.some(function(r){ return r.id === staffOpen; })) staffOpen = "";
      staffMatchLine(d);
    }
    staffList(); staffQuick(); staffBottom();
  }catch(e){}
  homeBusy = false;
}

/* ===========================================================================
   בלוק כותרת אחיד לכל המסכים
   ---------------------------------------------------------------------------
   בכל לוח יש אותו מבנה: שורת הקשר קטנה, כותרת גדולה, וכפתורי הפעולה בצד
   שמאל — הכול בשורה אחת. בתוכנה הם מפוזרים: הכותרת בפאנל, והכפתורים בשורה
   נפרדת מתחת (ולפעמים בשתיים). כאן הם נאספים לבלוק אחד.

   הכפתורים *מוזזים* ולא נבנים מחדש, כך שכל המאזינים שהקוד הקיים כבר קשר
   אליהם ממשיכים לעבוד. שום כפתור לא נעלם — גם כאלה שאינם בלוח.
   =========================================================================== */
function screenHeader(){
  var panel = view.querySelector(".panel");
  if(!panel || view.querySelector(".lab-shead")) return;

  /* הכותרת: או .section-title h2 או h2 ישיר בפאנל */
  var st = panel.querySelector(":scope > .section-title");
  var h2 = st ? st.querySelector("h2") : panel.querySelector(":scope > h2");

  var tabId = curTab();

  /* ⚠️ במסכים מרובי־מקטעים (הגדרות, כלים, דוחות) ובמסכים שהמעבדה מזריקה
     בהם פאנלים משלה (הנהלה) אסור לגנוב את ה-h2 של הפאנל הראשון:
     הוא כותרת של מקטע, לא של המסך — והפאנל היה נשאר בלי כותרת. שם המסך
     נלקח אז מהניווט, וכל הפאנלים נשארים שלמים. */
  var OWN = { reports:"דוחות ואחוזים",
              management:"מבט הנהלה",  settings:"הגדרות",
              tools:"כלים ושירותים" };
  /* רק המסכים ברשימה — ספירת פאנלים אינה קריטריון טוב: מסך עם כמה פאנלים
     שכותרתו הראשונה כן שייכת למסך היה מאבד את כפתורי הפעולה שלו. */
  var ownTitle = OWN[tabId] || "";
  if(!h2 && !ownTitle) return;

  var head = el("div", "lab-shead");
  var lft  = el("div", "lab-shead-t");

  var sub = (window.__uiLab && window.__uiLab.subtitle && tabId)
              ? window.__uiLab.subtitle(tabId) : "";

  var anchor = st || h2 || panel;
  anchor.parentNode.insertBefore(head, anchor);
  if(ownTitle){
    lft.appendChild(el("h2", null, ownTitle));   /* ה-h2 של הפאנל נשאר במקומו */
    st = null;
  }else{
    lft.appendChild(h2);                         /* העברה — המאזינים נשמרים */
  }
  /* תת־הכותרת יושבת *מתחת* לכותרת, כמו בלוחות */
  if(sub) lft.appendChild(el("div", "lab-ssub", sub));
  head.appendChild(lft);

  /* איסוף כפתורי הפעולה: השורה/הסרגל הראשון שאחרי הכותרת שמכיל .btn */
  var acts = el("div", "lab-sacts");
  var node = ownTitle ? null
           : (st && st.parentNode === panel) ? st.nextElementSibling
           : head.nextElementSibling;
  var scanned = 0;
  while(node && scanned < 4){
    var next = node.nextElementSibling;
    var btns = node.querySelectorAll(":scope > .btn, :scope > button.btn");
    var onlyBtns = btns.length && node.children.length === btns.length;
    if(onlyBtns){
      while(node.firstChild) acts.appendChild(node.firstChild);
      node.remove();
    }
    node = next; scanned++;
  }
  /* אם ה-.section-title כבר החזיק כפתורים — גם הם עוברים.
     ⚠️ תוקן: קודם *כל* ילדי ה-.section-title נזרקו לשורת הפעולות, כולל
     עטיפת הכותרת שנשאר בה ה-.sub — ותיאור המסך נחת בין הכפתורים. */
  if(st){
    Array.prototype.slice.call(st.children).forEach(function(c){
      if(c.classList && c.classList.contains("btn")){ acts.appendChild(c); return; }
      var inner = c.querySelectorAll ? c.querySelectorAll(".btn") : [];
      Array.prototype.slice.call(inner).forEach(function(b){ acts.appendChild(b); });
      var sub = c.querySelector ? c.querySelector(".sub") : null;
      if(sub) lft.appendChild(sub);
      if(!c.textContent.trim() && !c.children.length) c.remove();
      else if(c.parentNode === st) lft.appendChild(c);
    });
    if(!st.children.length) st.remove();
  }
  /* .sub ישיר בפאנל (רוב המסכים) — שייך לכותרת, לא לגוף */
  if(!ownTitle){
    var pSub = panel.querySelector(":scope > .sub");
    if(pSub && head.nextElementSibling === pSub) lft.appendChild(pSub);
  }

  /* הלוחות מציגים "הדפסה" ו"ייצוא" בכותרת של מסכי הסיכום. שניהם פעולות
     אמיתיות: הדפסת הדפדפן, ומעבר למסך הייצוא הקיים. */
  if(tabId === "reports" || tabId === "management"){
    var pr = el("button", "btn ghost", "🖨️ הדפסה");
    pr.onclick = function(){ window.print(); };
    var xp = el("button", "btn", "↧ ייצוא");
    xp.onclick = function(){ if(window.__uiLab && window.__uiLab.openExport) window.__uiLab.openExport(); };
    acts.appendChild(xp); acts.appendChild(pr);
  }

  if(acts.children.length) head.appendChild(acts);

  /* בלוחות הכותרת יושבת מעל הכרטיסים על רקע העמוד, לא בתוך כרטיס.
     מוציאים אותה מהפאנל הראשון לראש המסך — כך גם הבלוקים שהמעבדה
     מזריקה נכנסים *אחרי* הכותרת ולא לפניה. */
  view.insertBefore(head, view.firstChild);
  if(!panel.textContent.trim() && !panel.children.length) panel.remove();
}

/* ===========================================================================
   המסכים שנותרו — דוחות, הודעות, ייצוא, הגדרות, כלים, הנהלה
   ---------------------------------------------------------------------------
   כל אחד מהם מקבל את המבנה של הלוח בלי לפרק את המסך הקיים: מזריקים את
   הבלוקים שהלוח מציג ואינם בתוכנה, ומזיזים (לא בונים מחדש) את מה שכבר קיים.
   =========================================================================== */
/* ===========================================================================
   הכותרת העליונה — פס כהה שמתחבר לסרגל לקו אחד
   ---------------------------------------------------------------------------
   בכל לוח יש רצועה כהה לרוחב המסך שנמשכת מהסרגל הימני בלי תפר. קודם הכותרת
   רוקנה והפכה שקופה, ואז נוצר "מדרגה" בין הסרגל הכהה לתוכן הבהיר.

   ⚠️ בורר השנה אינו יושב כאן. שלב קודם העלה אותו לרצועה העליונה, ושם הוא
   הפריע: מעבר בין שנות לימוד הוא פעולה נדירה ורבת־משמעות, ובראש כל מסך
   הוא נראה כמו מסנן תצוגה שגרתי. הוא ירד למסך ההגדרות, לכרטיס הראשון
   ("שנים ומעבר שנה"), שם הוא שורת השבבים — ראה yearsCard().
   =========================================================================== */
function topBar(){
  var inner = document.querySelector("header.top .top-inner");
  if(!inner) return;

  var name = inner.querySelector(".lab-topname");
  if(!name){
    name = el("div", "lab-topname");
    inner.insertBefore(name, inner.firstChild);
  }
  var t = labelOfTab(curTab()) || "";
  if(name.textContent !== t) name.textContent = t;
}

/* מסדר את הכפתורים לפי הסדר שבלוח — ורק אם הם אינם כבר בו.
   ⚠️ appendChild על ילד שכבר אחרון הוא עדיין שינוי DOM: הצופה מתעורר,
   קורא לנו שוב, ונוצרת לולאה אינסופית. לכן משווים לפני שנוגעים. */
function orderInto(box, ids, rename){
  var want = [];
  ids.forEach(function(id){
    var b = view.querySelector("#" + id);
    if(!b) return;
    if(rename && rename[id] && b.textContent.trim() !== rename[id]) b.textContent = rename[id];
    want.push(b);
  });
  if(!want.length) return;
  var cur = Array.prototype.filter.call(box.children, function(c){ return want.indexOf(c) >= 0; });
  var same = cur.length === want.length && want.every(function(b, i){ return cur[i] === b; });
  if(same && want.every(function(b){ return b.parentNode === box; })) return;
  want.forEach(function(b){ box.appendChild(b); });
}

function labelOfTab(id){
  var t = nav && nav.querySelector('[data-tab="' + id + '"] .tl');
  return t ? String(t.textContent || "").trim() : "";
}

function curTab(){
  if(window.__uiLab && window.__uiLab.activeTab){
    var t = window.__uiLab.activeTab();
    if(t) return t;
  }
  var b = nav && nav.querySelector("[data-tab].active");
  return b ? b.dataset.tab : "";
}

/* פאנל תוצר של המעבדה — מסומן כדי שלא ייבנה פעמיים */
function labPanel(key, title, sub){
  var p = el("div", "panel lab-made");
  p.dataset.lab = key;
  if(title){
    var h = el("div", "lab-phead");
    h.appendChild(el("h3", null, title));
    if(sub) h.appendChild(el("div", "lab-psub", sub));
    p.appendChild(h);
  }
  return p;
}
function hasLab(key){ return !!view.querySelector('[data-lab="' + key + '"]'); }

/* שורת KPI בסגנון הלוחות */
function kpiRow(cards){
  var row = el("div", "lab-kpis");
  cards.forEach(function(c){ row.appendChild(kpi(c)); });
  return row;
}

/* מד אופקי עם תווית וערך — "קליטה בעירייה לפי עיר" / "לפי רשות" */
function barRow(label, value, pct, tone){
  var r = el("div", "lab-brow");
  var top = el("div", "lab-btop");
  top.appendChild(el("span", "lab-blab", label));
  top.appendChild(el("span", "lab-bval", value));
  r.appendChild(top);
  var bar = el("div", "lab-bar" + (tone ? " " + tone : "")), i = el("i");
  i.style.width = Math.max(0, Math.min(100, pct)) + "%";
  bar.appendChild(i); r.appendChild(bar);
  return r;
}
function toneOf(pct){ return pct >= 85 ? "good" : pct >= 70 ? "warn" : "bad"; }
/* בתפוסה הכיוון הפוך: גן מלא הוא התראה, לא הצלחה */
function occTone(pct){ return pct >= 98 ? "bad" : pct >= 88 ? "warn" : "good"; }

/* ---------------------------------------------------------------- דוחות */
function reportsScreen(){
  if(curTab() !== "reports" || hasLab("rep")) return;
  var d = window.__uiLab && window.__uiLab.reportsBoard && window.__uiLab.reportsBoard();
  if(!d) return;
  var first = view.querySelector(".panel");
  if(!first) return;

  var frag = document.createDocumentFragment();

  /* דלתא מול השנה הקודמת, כפי שהלוח מציג. אם אין שנה קודמת — הערך המוחלט. */
  var pv = d.prev || {};
  function delta(now, was, fallback){
    if(was == null) return { sub:fallback };
    var g = now - was;
    return { sub:(g >= 0 ? "▲ " : "▼ ") + Math.abs(g) + "% מ" + d.prevYear,
             subTone:(g >= 0 ? "good" : "bad") };
  }
  var dDocs = delta(d.docsPct,  pv.docs,   d.docsN + " מתוך " + d.total + " תיקים");
  var dMuni = delta(d.muniPct,  pv.muni,   d.muniN + " נקלטו");
  var dPlc  = delta(d.placedPct, pv.placed, d.placedN + " משובצות");

  frag.appendChild(kpiRow([
    { label:"תפוסת רשת ממוצעת", value:d.occupancy + "%",
      sub:d.capUsed + " מתוך " + d.capTotal + " מקומות", bar:d.occupancy },
    { label:"תיקים עם כל המסמכים", value:d.docsPct + "%",
      sub:dDocs.sub, subTone:dDocs.subTone, bar:d.docsPct },
    { label:"אחוז קליטה בעירייה", value:d.muniPct + "%",
      sub:dMuni.sub, subTone:dMuni.subTone, bar:d.muniPct },
    { label:"אחוז שיבוץ", value:d.placedPct + "%", dark:true,
      sub:dPlc.sub, subTone:"gold", bar:d.placedPct }
  ]));

  var two = el("div", "lab-2col");

  var pc = labPanel("rep", "קליטה בעירייה לפי עיר", "אחוז התיקים שנקלטו");
  if(!d.byCity.length) pc.appendChild(el("div", "lab-empty", "אין נתוני עיר בתיקים."));
  d.byCity.forEach(function(c){
    var pct = c.n ? Math.round(c.ok / c.n * 100) : 0;
    pc.appendChild(barRow(c.city, pct + "% · " + c.n + " תיקים", pct, toneOf(pct)));
  });
  var pa = labPanel("repAge", "רישום לפי גיל", "משובצות מול ממתינות");
  var cols = el("div", "lab-cols");
  var maxA = 1;
  d.byAge.forEach(function(a){ maxA = Math.max(maxA, a.placed + a.waiting); });
  d.byAge.forEach(function(a){
    var c = el("div", "lab-col");
    c.appendChild(el("div", "lab-cn", String(a.placed + a.waiting)));
    var stack = el("div", "lab-stack");
    stack.style.height = Math.round((a.placed + a.waiting) / maxA * 130) + "px";
    var w = el("i", "wait"); w.style.height = ((a.waiting / (a.placed + a.waiting || 1)) * 100) + "%";
    var g = el("i", "plc");  g.style.height = ((a.placed  / (a.placed + a.waiting || 1)) * 100) + "%";
    stack.appendChild(w); stack.appendChild(g);
    c.appendChild(stack);
    c.appendChild(el("div", "lab-cl", /^\d/.test(a.age) ? "גיל " + a.age : a.age));
    cols.appendChild(c);
  });
  pa.appendChild(cols);
  var lg = el("div", "lab-legend");
  ["משובצות", "ממתינות"].forEach(function(t, i){
    var it = el("span", "lab-lg");
    it.appendChild(el("i", i ? "wait" : "plc"));
    it.appendChild(el("span", null, t));
    lg.appendChild(it);
  });
  pa.appendChild(lg);
  two.appendChild(pa);      /* ימין */
  two.appendChild(pc);      /* שמאל — כמו בלוח */
  frag.appendChild(two);

  /* פירוט לפי גן */
  var pt = labPanel("repGan", "פירוט לפי גן", "כל " + d.perGan.length + " הגנים");
  var wrap = el("div", "table-wrap"), t = el("table");
  var thead = el("thead"), tr = el("tr");
  ["גן", "קמפוס", "רשומות", "תפוסה", "קליטה בעירייה", "מסמכים מלאים"].forEach(function(h){
    tr.appendChild(el("th", null, h));
  });
  thead.appendChild(tr); t.appendChild(thead);
  var tb = el("tbody");
  d.perGan.forEach(function(g){
    var r = el("tr");
    var c1 = el("td"); var nm = el("b", null, g.name);
    if(g.ageInk) nm.style.borderInlineStartColor = g.ageInk;
    c1.className = "lab-gcell"; c1.appendChild(nm);
    if(g.ageInk) c1.style.setProperty("--age-ink", g.ageInk);
    r.appendChild(c1);
    r.appendChild(el("td", null, g.campus || "—"));
    r.appendChild(el("td", null, String(g.n)));
    var c4 = el("td", "lab-occ");
    c4.appendChild(el("span", "lab-occn", g.occ + "%"));
    var b = el("div", "lab-bar mini " + occTone(g.occ)), i = el("i");
    i.style.width = Math.min(100, g.occ) + "%"; b.appendChild(i); c4.appendChild(b);
    r.appendChild(c4);
    r.appendChild(el("td", null, g.muni + "%"));
    r.appendChild(el("td", null, g.docs + "%"));
    tb.appendChild(r);
  });
  t.appendChild(tb); wrap.appendChild(t); pt.appendChild(wrap);
  frag.appendChild(pt);

  first.parentNode.insertBefore(frag, first);
}

/* --------------------------------------------------------------- הנהלה */
function mgmtScreen(){
  if(curTab() !== "management" || hasLab("mg")) return;
  var d = window.__uiLab && window.__uiLab.mgmtBoard && window.__uiLab.mgmtBoard();
  if(!d) return;
  var first = view.querySelector(".panel");
  if(!first) return;

  var delta = d.prevTotal
    ? Math.round((d.total - d.prevTotal) / d.prevTotal * 100) : 0;
  var frag = document.createDocumentFragment();
  frag.appendChild(kpiRow([
    { label:"רשומות בשנה", value:String(d.total), dark:true,
      sub:(delta >= 0 ? "▲ " : "▼ ") + Math.abs(delta) + "% מ" + (d.prevYear || "אשתקד") +
          " (" + d.prevTotal + ")",
      bar:d.target ? Math.round(d.total / d.target * 100) : 0 },
    { label:"תפוסת רשת", value:d.occupancy + "%", bar:d.occupancy },
    { label:"איוש צוות", value:d.staffing + "%",
      sub:d.openSlots + " תקנים פתוחים", subTone:d.openSlots ? "bad" : "good",
      bar:d.staffing },
    { label:"קליטה בעירייה", value:d.muniPct + "%", bar:d.muniPct }
  ]));

  var two = el("div", "lab-2col");
  var pc = labPanel("mg", "קמפוסים", "תפוסה, איוש וקליטה");
  d.campuses.forEach(function(c){
    var card = el("div", "lab-camp");
    var h = el("div", "lab-camph");
    h.appendChild(el("b", null, c.name));
    h.appendChild(el("span", "lab-campn", c.gans + " גנים · " + c.n + " תלמידות"));
    card.appendChild(h);
    var m = el("div", "lab-metrics");
    [["תפוסה", c.occ], ["איוש", c.staff], ["קליטה", c.muni]].forEach(function(x){
      var b = el("div", "lab-metric");
      b.appendChild(el("span", "lab-mk", x[0]));
      b.appendChild(el("span", "lab-mv " + toneOf(x[1]), x[1] + "%"));
      m.appendChild(b);
    });
    card.appendChild(m);
    pc.appendChild(card);
  });

  var pp = labPanel("mgP", "קצב הרישום לפי מועד",
    d.prevYear ? d.year + " מול " + d.prevYear : d.year);
  var cols = el("div", "lab-cols pair"), maxP = 1;
  d.byPeriod.forEach(function(x){ maxP = Math.max(maxP, x.now, x.prev); });
  d.byPeriod.slice().reverse().forEach(function(x){
    var c = el("div", "lab-col");
    c.appendChild(el("div", "lab-cn", String(x.now)));
    var pr = el("div", "lab-pair");
    var a = el("i", "now"); a.style.height = Math.round(x.now / maxP * 130) + "px";
    var b = el("i", "prev"); b.style.height = Math.round(x.prev / maxP * 130) + "px";
    pr.appendChild(a); pr.appendChild(b);
    c.appendChild(pr);
    c.appendChild(el("div", "lab-cl", "מועד " + x.p));
    cols.appendChild(c);
  });
  pp.appendChild(cols);
  var lg = el("div", "lab-legend");
  [[d.year, "now"], [d.prevYear || "אשתקד", "prev"]].forEach(function(t){
    var it = el("span", "lab-lg");
    it.appendChild(el("i", t[1]));
    it.appendChild(el("span", null, t[0]));
    lg.appendChild(it);
  });
  pp.appendChild(lg);
  two.appendChild(pp);      /* ימין */
  two.appendChild(pc);      /* שמאל — כמו בלוח */
  frag.appendChild(two);
  first.parentNode.insertBefore(frag, first);
}



/* -------------------------------------------------------------- הודעות */
/* הלוח מציג את שלושת השלבים בטור הימני ולוח שליחה קבוע בשמאלי: מספר
   הנמענות, כפתורי השליחה, תצוגה מקדימה ושליחות אחרונות. בתוכנה כל אלה
   קיימים — רק פזורים בתחתית המסך. כאן הם *מוזזים* לתוך הלוח, כך שכל
   המאזינים והלוגיקה (כולל אישור לפני שליחה) נשארים בדיוק כפי שהם. */
function messagesScreen(){
  if(curTab() !== "messages") return;
  var panel = view.querySelector(".panel");
  if(!panel || panel.querySelector(".lab-work")) return;

  var sets = panel.querySelectorAll(":scope > fieldset");
  if(sets.length < 4) return;

  var work = el("div", "lab-work");
  var main = el("div", "lab-wmain");
  var side = el("aside", "lab-wside");

  panel.classList.add("lab-bare");
  panel.insertBefore(work, panel.firstChild);
  work.appendChild(main); work.appendChild(side);

  /* שלושת השלבים הראשונים לטור הראשי; השלב הרביעי מתפרק אל הלוח */
  var last = sets[sets.length - 1];
  Array.prototype.slice.call(sets).forEach(function(f){
    if(f !== last) main.appendChild(f);
  });

  /* --- לוח השליחה --- */
  var card = el("div", "lab-send");
  var cnt  = panel.querySelector("#msg-count") || main.querySelector("#msg-count");
  var big  = el("div", "lab-bignum", "…");
  card.appendChild(el("div", "lab-sendk", "תישלח ל-"));
  card.appendChild(big);
  if(cnt){
    cnt.classList.add("lab-cntline");
    card.appendChild(cnt);
    /* המספר הגדול נגזר מהטקסט החי של #msg-count ומתעדכן איתו */
    var sync = function(){
      var m = String(cnt.textContent || "").match(/\d+/);
      var n = m ? m[0] : "0";
      if(big.textContent !== n) big.textContent = n;
    };
    sync();
    new MutationObserver(sync).observe(cnt, {childList:true, subtree:true, characterData:true});
  }
  card.appendChild(el("div", "lab-sendrule"));

  var acts = el("div", "lab-sendacts");
  ["#msg-send", "#msg-test", "#msg-preview"].forEach(function(sel, i){
    var b = panel.querySelector(sel) || last.querySelector(sel);
    if(!b) return;
    b.style.background = "";
    if(i) b.classList.add("ghost");         /* ראשי אחד בלבד: השליחה */
    acts.appendChild(b);                    /* העברה — המאזין נשמר */
  });
  card.appendChild(acts);
  side.appendChild(card);

  var out = last.querySelector("#msg-out");
  if(out){
    var pv = labPanel("msgPrev", "תצוגה מקדימה", "נמענת ראשונה");
    pv.appendChild(out);
    side.appendChild(pv);
  }
  /* מה שנשאר בשלב 4 (אם נשאר) חוזר לטור הראשי, שלא ייעלם דבר */
  if(last.querySelector(".btn, input, textarea, select")) main.appendChild(last);
  else last.remove();

  /* מספור השלבים כשבב, כמו בלוח */
  main.querySelectorAll("legend").forEach(function(lg){
    if(lg.querySelector(".lab-step")) return;
    var m = String(lg.textContent || "").match(/^\s*(\d+)\s*·\s*(.*)$/);
    if(!m) return;
    lg.textContent = "";
    lg.appendChild(el("span", "lab-steptxt", m[2]));
    lg.appendChild(el("span", "lab-step", m[1]));
  });

  /* כרטיסי ערוץ עם שורת הסבר, כפי שהלוח מציג */
  var NOTE = { email:"דרך הגשר · ללא עלות", whatsapp:"אוטומטי עם ספק · אחרת ידני",
               sms:"דורש ספק חיצוני", voice:"דורש ספק חיצוני" };
  main.querySelectorAll(".msg-ch").forEach(function(b){
    if(b.querySelector(".lab-chsub")) return;
    var n = NOTE[b.dataset.v];
    if(!n) return;
    var t = el("span", "lab-chttl", b.textContent.trim());
    b.textContent = "";
    b.appendChild(t);
    b.appendChild(el("span", "lab-chsub", n));
    b.classList.add("lab-chcard");
    var row = b.parentNode;
    if(row && !row.classList.contains("lab-chrow")) row.classList.add("lab-chrow");
  });
}

/* ---------------------------------------------------------------- ייצוא */
/* מסך ייצוא הרשימות — שתי עמודות: "מה לייצא" בכרטיס, והלוח הכהה שמונה
   את השורות ונושא את כפתורי הייצוא.
   ⚠️ קודם זה רץ רק על לשונית הייצוא, ולכן החלון שנפתח מכפתור "ייצוא"
   שבלשונית התלמידות נשאר בעיצוב הישן — אותו viewExport בדיוק, בשני מראות
   שונים. עכשיו הפונקציה מקבלת host ומזהה את המסך לפי התוכן שלו (#x-out),
   ולא לפי הלשונית הפעילה, ולכן היא מעצבת גם את הלשונית וגם את החלון. */
function exportScreen(host){
  var root = host || view;
  if(!root) return;
  var panel = root.querySelector(".panel");
  if(!panel || !panel.querySelector("#x-out")) return;   /* לא מסך הייצוא */
  if(panel.querySelector(".lab-work")) return;           /* כבר עוצב */
  var tools = panel.querySelector(":scope > .toolbar");
  var fs    = panel.querySelector(":scope > fieldset");
  if(!tools || !fs) return;

  var work = el("div", "lab-work rev");
  var main = el("div", "lab-wmain");
  var side = el("aside", "lab-wside");
  panel.classList.add("lab-bare");
  panel.insertBefore(work, tools);
  work.appendChild(main); work.appendChild(side);

  var card = labPanel("xWhat", "מה לייצא");
  card.appendChild(tools);
  card.appendChild(fs);
  main.appendChild(card);

  /* שורת כפתורי הייצוא — לתוך הלוח הכהה */
  var row = panel.querySelector(":scope > .row");
  var sc  = el("div", "lab-send");
  var big = el("div", "lab-bignum", "—");
  sc.appendChild(el("div", "lab-sendk", "בקובץ יהיו"));
  sc.appendChild(big);
  var meta = el("div", "lab-cntline", "שורות · בחר/י תצוגה מקדימה");
  sc.appendChild(meta);
  sc.appendChild(el("div", "lab-sendrule"));
  if(row){ row.classList.add("lab-sendacts"); sc.appendChild(row); }
  side.appendChild(sc);

  var pri = panel.querySelector("#x-csv") || panel.querySelector("#x-xls");
  if(pri && row){
    pri.classList.remove("ghost");
    row.insertBefore(pri, row.firstChild);
    Array.prototype.slice.call(row.children).forEach(function(b){
      if(b !== pri && b.classList && b.classList.contains("btn")) b.classList.add("ghost");
    });
  }

  var out = panel.querySelector("#x-out");
  if(out){
    var pv = labPanel("xPrev", "תצוגה מקדימה");
    out.parentNode.insertBefore(pv, out);
    pv.appendChild(out);
    /* המספר הגדול נקרא מטבלת התצוגה המקדימה בכל פעם שהיא מתרעננת */
    var sync = function(){
      var rows = out.querySelectorAll("tbody tr").length;
      var cols = out.querySelectorAll("thead th").length;
      big.textContent = rows ? String(rows) : "—";
      meta.textContent = rows ? "שורות · " + cols + " עמודות" : "שורות · בחר/י תצוגה מקדימה";
    };
    new MutationObserver(sync).observe(out, {childList:true, subtree:true});
    sync();
  }
}

/* -------------------------------------------------------------- הגדרות */
/* מסך ההגדרות נבנה מחדש: כל ההגדרות במקום אחד, מקובצות לחמש קבוצות,
   ופאנלים שמדברים על אותו נושא מאוחדים לכרטיס אחד — "שנים ומעבר שנה",
   "מי מחובר ויומן פעילות", "ניהול משתמשים ומנהלי מערכת", "מיתוג והתקנה
   כאפליקציה". שני פאנלי הנתונים ההיסטוריים יורדים לרשימות שנפתחות, כדי
   שלא יתפסו את המסך בטבלאות שנפתחות פעם בשנה.

   ⚠️ שום פאנל אינו נבנה מחדש. התוכן שלו **מוזז** לתוך הכרטיס החדש, ולכן
   כל מה שהתוכנה חיווטה — כפתורים, שדות, טבלאות ומאזינים — ממשיך לעבוד
   בדיוק כפי שהוא. מה שכן נבנה כאן (שבבי השנים, שבבי הרשימות ושורות
   התפקידים) כותב דרך window.__uiLab, כלומר דרך אותן פונקציות שהמסך
   הקיים כבר קורא להן. */

/* איתור פאנל לפי אלמנט שיושב בתוכו, ולא לפי טקסט הכותרת — "שנים" מוכל
   גם ב"נתונים היסטוריים (שנים קודמות)", והתאמת טקסט הייתה מצליבה. */
var SET_FIND = [
  ["presence","#presenceBox"], ["activity","#activityBox"],
  ["brand","#br-title"],       ["install","#install-box"],
  ["caps","#ac-reg"],          ["years","#years-box"],
  ["promote","#pr-from"],      ["hist","#hist-box"],
  ["histGan","#hist-gans-box"],["tzmin","#saveTzMin"],
  ["ages","#ages-box"],        ["roles","#roles-box"],
  ["campus","#campus-box"],    ["admins","#admins-box"],
  ["feedback","#feedback-box"],["auth","#auth-box"],
  ["users","#users-box"]
];

/* העברת גוף הפאנל — בלי הכותרת ובלי שורת ההסבר, שמוחלפות בכותרת הכרטיס */
function moveBody(src, dst, keepSub){
  if(!src || !dst) return;
  Array.prototype.slice.call(src.childNodes).forEach(function(n){
    if(n.nodeType === 1){
      if(n.tagName === "H2") return;
      if(!keepSub && n.classList && n.classList.contains("sub")) return;
    }
    dst.appendChild(n);
  });
}

/* גרירה לסידור מחדש. הידית היא הנקודה היחידה שמתחילה גרירה, כדי
   שעריכת הטקסט בתוך השבב תמשיך לעבוד כרגיל. */
function dragSort(box, sel, axis, done){
  var dragged = null;
  box.addEventListener("dragstart", function(e){
    var n = e.target && e.target.closest ? e.target.closest(sel) : null;
    if(!n) return;
    dragged = n;
    n.classList.add("lab-dragging");
    try{ e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", ""); }catch(_){}
  });
  box.addEventListener("dragover", function(e){
    if(!dragged) return;
    e.preventDefault();
    var over = e.target && e.target.closest ? e.target.closest(sel) : null;
    if(!over || over === dragged || over.parentNode !== box) return;
    var r = over.getBoundingClientRect();
    /* במאונך: מעל האמצע = לפני. באופקי ב-RTL: הצד השמאלי = אחרי. */
    var after = axis === "y" ? (e.clientY > r.top + r.height/2)
                             : (e.clientX < r.left + r.width/2);
    box.insertBefore(dragged, after ? over.nextSibling : over);
  });
  box.addEventListener("drop", function(e){ e.preventDefault(); });
  box.addEventListener("dragend", function(){
    if(!dragged) return;
    dragged.classList.remove("lab-dragging");
    dragged.draggable = false;
    dragged = null;
    done(Array.prototype.slice.call(box.querySelectorAll(sel)));
  });
}
/* ידית גרירה — מפעילה draggable רק בזמן הלחיצה עליה */
function grip(node){
  var g = el("span", "lab-grip", "⠿");
  g.title = "גרירה לשינוי הסדר";
  g.addEventListener("mousedown", function(){ node.draggable = true; });
  g.addEventListener("touchstart", function(){ node.draggable = true; }, {passive:true});
  node.addEventListener("dragend", function(){ node.draggable = false; });
  return g;
}

/* ---- רשימת שבבים הניתנת לעריכה, מחיקה, הוספה וגרירה (גילים · קמפוסים) */
function chipsCard(key, title, sub, items, commit, admin, addPh){
  var p   = labPanel(key, title, sub);
  var box = el("div", "lab-chips");

  items.forEach(function(v, i){
    var c = el("div", "lab-chip");
    c.dataset.v = v;
    var t = el("span", "lab-chiptxt", v);
    if(admin){
      t.contentEditable = "true";
      t.spellcheck = false;
      t.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ e.preventDefault(); t.blur(); }
        if(e.key === "Escape"){ t.textContent = v; t.blur(); }
      });
      t.addEventListener("blur", function(){
        var nv = String(t.textContent || "").trim();
        if(nv === v) return;
        var next = items.slice();
        if(nv) next[i] = nv; else next.splice(i, 1);
        commit(next);
      });
    }
    c.appendChild(t);
    if(admin){
      var x = el("button", "lab-chipx", "✕");
      x.type = "button"; x.title = "מחיקה";
      x.addEventListener("click", function(){
        var next = items.slice(); next.splice(i, 1); commit(next);
      });
      c.appendChild(x);
      c.appendChild(grip(c));            /* בקצה השמאלי, כמו בלוח */
    }
    box.appendChild(c);
  });

  if(admin){
    var add = el("button", "lab-chip lab-chipadd", "+");
    add.type = "button"; add.title = addPh || "הוספה";
    add.addEventListener("click", function(){
      if(box.querySelector(".lab-chipnew")) return;
      var n = el("div", "lab-chip lab-chipnew");
      var inp = document.createElement("input");
      inp.className = "lab-chipinput";
      inp.placeholder = addPh || "";
      n.appendChild(inp);
      box.insertBefore(n, add);
      inp.focus();
      /* Enter מסיים, ואז יציאת המיקוד משגרת blur — הדגל מונע סגירה כפולה
         (הסגירה הראשונה כבר בנתה את המסך מחדש, והצומת אינו במקומו). */
      var closed = false;
      var close = function(save){
        if(closed) return;
        closed = true;
        var v = String(inp.value || "").trim();
        if(n.parentNode) n.parentNode.removeChild(n);
        if(save && v && items.indexOf(v) < 0) commit(items.concat(v));
      };
      inp.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ e.preventDefault(); close(true); }
        if(e.key === "Escape"){ close(false); }
      });
      inp.addEventListener("blur", function(){ close(true); });
    });
    box.appendChild(add);
    dragSort(box, ".lab-chip[data-v]", "x", function(order){
      commit(order.map(function(n){ return n.dataset.v; }));
    });
  }
  p.appendChild(box);
  return p;
}

/* ---- שורות התפקידים: שם, שיוך חינוך, הכלל שהתפקיד נושא, צבע ומחיקה --- */
function rolesCard(rows, admin){
  var p = labPanel("roles", "תפקידי צוות",
        "לכל תפקיד: שיוך חינוך, וסדר התפקידים קובע את סדר התקנים בלוח שיבוץ הצוות. גרירה משנה סדר.");
  var box = el("div", "lab-rows");
  var EDU = [["both","רגיל + ח\"מ"], ["רגיל","רגיל בלבד"], ['ח"מ','ח"מ בלבד']];

  function read(){
    return Array.prototype.slice.call(box.querySelectorAll(".lab-rolerow")).map(function(n){
      return { name:  String(n.querySelector(".lab-rolename").textContent || "").trim(),
               edu:   n.querySelector(".lab-roleedu").value,
               color: n.querySelector(".lab-rolecolor").value };
    });
  }
  function commit(next){
    if(window.__uiLab && window.__uiLab.saveRoles) window.__uiLab.saveRoles(next);
  }

  rows.forEach(function(r){
    var row = el("div", "lab-rolerow");
    row.dataset.v = r.name;

    var nm = el("span", "lab-rolename", r.name);
    if(admin){
      nm.contentEditable = "true";
      nm.spellcheck = false;
      nm.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ e.preventDefault(); nm.blur(); }
        if(e.key === "Escape"){ nm.textContent = r.name; nm.blur(); }
      });
      nm.addEventListener("blur", function(){
        if(String(nm.textContent || "").trim() === r.name) return;
        commit(read());
      });
    }
    row.appendChild(nm);

    var edu = document.createElement("select");
    edu.className = "lab-roleedu lab-rolebadge " + (r.edu === "both" ? "good" : r.edu === "רגיל" ? "info" : "warn");
    EDU.forEach(function(o){
      var op = document.createElement("option");
      op.value = o[0]; op.textContent = o[1];
      if(o[0] === r.edu) op.selected = true;
      edu.appendChild(op);
    });
    edu.disabled = !admin;
    edu.addEventListener("change", function(){ commit(read()); });
    row.appendChild(edu);

    if(r.note) row.appendChild(el("span", "lab-rolebadge warn", r.note));

    row.appendChild(el("span", "lab-rolegap"));

    var col = document.createElement("input");
    col.type = "color"; col.className = "lab-rolecolor";
    col.value = r.color || "#8a8f98";
    col.title = "צבע התפקיד";
    col.disabled = !admin;
    col.addEventListener("change", function(){ commit(read()); });
    row.appendChild(col);

    if(admin){
      var del = el("button", "lab-rowx", "🗑️");
      del.type = "button"; del.title = "מחיקת התפקיד";
      del.addEventListener("click", function(){
        if(!confirm('למחוק את התפקיד "' + r.name + '"?')) return;
        commit(read().filter(function(x){ return x.name !== r.name; }));
      });
      row.appendChild(del);
      row.appendChild(grip(row));
    }
    box.appendChild(row);
  });

  if(admin) dragSort(box, ".lab-rolerow", "y", function(){ commit(read()); });
  p.appendChild(box);
  return p;
}

/* ---- שורת התחתית של כרטיס רשימה: מה שנשאר משורת ההוספה של התוכנה ----
   שדה ההוספה וכפתור "הוסף" מיותרים — השבב "+" מחליף אותם. מה שכן נשאר
   שימושי (איפוס לברירת מחדל · עדכון הקמפוס אצל התלמידות) יורד לשורה
   דקה בתחתית הכרטיס. */
function listFoot(src, dropIds){
  if(!src) return null;
  var row = src.querySelector(":scope > .row");
  if(!row) return null;
  dropIds.forEach(function(id){
    var n = row.querySelector("#" + id);
    if(!n) return;
    var f = n.closest(".field");
    (f && f.parentNode === row ? f : n).classList.add("lab-hidden");
  });
  var left = Array.prototype.slice.call(row.children)
    .filter(function(n){ return !n.classList.contains("lab-hidden"); });
  if(!left.length) return null;
  row.classList.add("lab-listfoot");
  return row;
}

/* כרטיס שכל תוכנו מוזז מפאנל קיים — הכותרת וההסבר מוחלפים בלבד */
function plainCard(key, title, sub, src){
  if(!src) return null;
  var p = labPanel(key, title, sub);
  moveBody(src, p);
  src.remove();
  return p;
}

/* מכרטיס המעבדה בחזרה למקטעי ההגדרות של התוכנה (data-set), כדי שרשימת
   המקטעים שבסרגל הניווט תדע לגלול גם לכרטיסים המאוחדים של המעבדה. */
var LAB_SET = {
  year:"years promote", hist:"hist histgans", ages:"ages", roles:"roles",
  campus:"campus", caps:"caps", tzmin:"tzmin", presence:"presence activity",
  users:"users admins", auth:"auth", brand:"branding install", feedback:"feedback"
};

function settingsScreen(){
  if(curTab() !== "settings" || view.querySelector(".lab-setwrap")) return;
  var panels = Array.prototype.slice.call(view.querySelectorAll(":scope > .panel"));
  if(!panels.length) return;

  /* מפת הפאנלים שהתוכנה בנתה */
  var P = {};
  SET_FIND.forEach(function(f){
    for(var i = 0; i < panels.length; i++){
      if(panels[i].querySelector(f[1])){ P[f[0]] = panels[i]; return; }
    }
  });
  if(!P.years && !P.ages && !P.auth) return;      /* לא מסך ההגדרות */

  var D = (window.__uiLab && window.__uiLab.settingsLists) ? window.__uiLab.settingsLists() : null;
  var admin = !!(D && D.admin);

  /* אין כאן עוד רשימת ניווט צדדית — מקטעי ההגדרות יושבים בסרגל הניווט
     הראשי, מתחת ללשונית "הגדרות". */
  var wrap = el("div", "lab-setwrap");
  var col  = el("div", "lab-setcol");
  view.insertBefore(wrap, panels[0]);
  wrap.appendChild(col);

  var n = 0;
  function mark(k){ if(P[k]) P[k].dataset.labUsed = "1"; }
  function addCard(p){
    if(!p) return;
    p.id = "labset" + (++n);
    /* כרטיס שהמעבדה בנתה מאחד כמה מקטעים — יעד הגלילה של כולם */
    var set = p.dataset.lab && LAB_SET[p.dataset.lab];
    if(set) p.dataset.set = set;
    col.appendChild(p);
  }


  /* ═══ 1. שנה ונתונים ═══════════════════════════════════════════════ */
  addCard(yearsCard(P, admin));
  addCard(histCard(P));

  /* ═══ 2. רשימות המערכת ════════════════════════════════════════════ */
  /* שלוש הרשימות נבנות כשבבים/שורות מתוך D. בלי הוו (למשל app-artifact.html,
     שאין בו __uiLab) אין נתיב כתיבה, ואז הכרטיס נבנה מהעורך הקיים כמו שהוא —
     המסך נשאר מקובץ, רק בלי הגרירה. */
  if(P.ages){
    mark("ages");
    var agesC = D
      ? chipsCard("ages", "גילי הילדים",
          "הגילים שמופיעים לבחירה בתיק תלמידה ובסינון הרשימה.",
          D.ages, function(next){ window.__uiLab.saveAges(next); }, admin, "למשל 7")
      : plainCard("ages", "גילי הילדים",
          "הגילים שמופיעים לבחירה בתיק תלמידה ובסינון הרשימה.", P.ages);
    if(D){ var af = listFoot(P.ages, ["new-age", "addAge"]); if(af) agesC.appendChild(af); }
    addCard(agesC);
    if(D) P.ages.remove();
  }
  if(P.roles){
    mark("roles");
    var rolesC = D ? rolesCard(D.roles, admin)
      : plainCard("roles", "תפקידי צוות",
          "לכל תפקיד: שיוך חינוך, וסדר התפקידים קובע את סדר התקנים בלוח שיבוץ הצוות.", P.roles);
    if(D){ var rf = listFoot(P.roles, ["new-role", "addRole"]); if(rf) rolesC.appendChild(rf); }
    addCard(rolesC);
    if(D) P.roles.remove();
  }
  if(P.campus){
    mark("campus");
    var campC = D
      ? chipsCard("campus", "קמפוסים",
          "הקמפוס של כל תלמידה נקבע אוטומטית לפי הגן שלה.",
          D.campuses, function(next){ window.__uiLab.saveCampuses(next); }, admin, "למשל קמפוס מרכז")
      : plainCard("campus", "קמפוסים",
          "הקמפוס של כל תלמידה נקבע אוטומטית לפי הגן שלה.", P.campus);
    if(D){ var cf = listFoot(P.campus, ["new-campus", "addCampus"]); if(cf) campC.appendChild(cf); }
    addCard(campC);
    if(D) P.campus.remove();
  }
  addCard(capsCard(P));
  addCard(tzminCard(P));

  /* ═══ 3. מערכת ומשתמשים ═══════════════════════════════════════════ */
  addCard(presenceCard(P));
  addCard(usersCard(P));
  addCard(authCard(P));
  if(P.feedback){
    mark("feedback");
    var fb = labPanel("feedback", "💡 פניות והצעות שיפור",
      "הודעות שנשלחו דרך \"יצירת קשר / הצעה\" שבתפריט, והכתובת שאליה הן נפתחות.");
    moveBody(P.feedback, fb);
    P.feedback.remove();
    addCard(fb);
  }

  /* ═══ 4. מראה והתקנה ══════════════════════════════════════════════ */
  addCard(brandCard(P));

  /* פאנל שהתוכנה מציגה ולא נכלל בתוכנית (למשל הודעת "רק למנהל") — נשאר
     במקומו, בראש העמודה, כדי ששום דבר לא ייעלם בשקט. */
  var rest = panels.filter(function(p){ return p.parentNode !== col && !p.dataset.labUsed && document.contains(p); });
  rest.forEach(function(p){ col.insertBefore(p, col.firstChild); });

}

/* ---- שנים ומעבר שנה ------------------------------------------------
   שלושה פאנלים היו כאן: "שנת עבודה" (הבורר), "שנים" (הוספה/מחיקה)
   ו"מעבר שנה". שלושתם מדברים על אותה החלטה, ולכן הם כרטיס אחד: שורת
   שבבים שהיא גם הבורר וגם הרשימה, ותהליך המעבר מתחתיה.

   ⚠️ ה-<select> המקורי (#yearSelect) נשאר במגירה, מוסתר. הוא יושב מחוץ
   ל-#view, ולכן שורד את בנייתו מחדש של המסך ומחזיק את מאזין ה-change
   שכותב את ההעדפה ומרענן את המסלול. השבבים קוראים ממנו וכותבים אליו. */
function yearsCard(P, admin){
  if(!P.years && !P.promote) return null;
  var p = labPanel("year", "שנים ומעבר שנה",
        "כל שנה מנוהלת בנפרד. הבחירה כאן קובעת על איזו שנה כל המסכים עובדים.");

  var real  = document.getElementById("yearSelect");
  var chips = el("div", "lab-chips lab-yearchips");

  /* כפתורי המחיקה של התוכנה, לפי השנה שהם מוחקים */
  var dels = {};
  if(P.years){
    Array.prototype.slice.call(P.years.querySelectorAll("[data-dely]")).forEach(function(b){
      dels[b.dataset.dely] = b;
    });
  }

  var cur = real ? real.value : "";
  if(real) Array.prototype.forEach.call(real.options, function(o){
    var on = o.value === cur;
    var c  = el("div", "lab-chip lab-yearchip" + (on ? " on" : ""));
    c.dataset.v = o.value;
    var t = el("button", "lab-chiptxt", o.textContent);
    t.type = "button";
    t.addEventListener("click", function(){
      if(!real || real.value === o.value) return;
      real.value = o.value;
      real.dispatchEvent(new Event("change", {bubbles:true}));
    });
    c.appendChild(t);
    if(on) c.appendChild(el("span", "lab-chipnote", "פעילה"));
    var d = dels[o.value];
    if(d){ d.className = "lab-chipx"; d.textContent = "✕"; d.title = "מחיקת השנה"; c.appendChild(d); }
    chips.appendChild(c);
  });

  /* "+ הוספת שנה" — פותח את שדה ההוספה של התוכנה, עם המאזין שלו */
  var addRow = P.years ? P.years.querySelector(":scope > .row") : null;
  if(addRow) addRow.classList.add("lab-hidden", "lab-yearadd");
  if(admin && addRow){
    var add = el("button", "lab-chip lab-chipadd lab-chipadd-w", "+ הוספת שנה");
    add.type = "button";
    add.addEventListener("click", function(){
      addRow.classList.toggle("lab-hidden");
      var f = addRow.querySelector("#new-year");
      if(f && !addRow.classList.contains("lab-hidden")) f.focus();
    });
    chips.appendChild(add);
  }
  p.appendChild(chips);
  if(addRow) p.appendChild(addRow);
  if(P.years){ P.years.dataset.labUsed = "1"; P.years.remove(); }

  /* --- מעבר שנה, ככרטיס פנימי --- */
  if(P.promote){
    P.promote.dataset.labUsed = "1";
    var sc = el("div", "lab-setsub");
    var hd = el("div", "lab-setsubh");
    var tx = el("div", "lab-setsubt");
    tx.appendChild(el("div", "lab-setsubttl", "מעבר שנה — קידום לגן המתקדם"));
    tx.appendChild(el("div", "lab-setsubx",
      "מעתיק את התלמידות משנה קודמת. עוברים רק הפרטים האישיים והכתובת; כל ילדה מקודמת לגן המתקדם באותו קמפוס, והמסמכים והסימונים מתאפסים."));
    hd.appendChild(tx);
    var start = el("button", "btn lab-startbtn", "התחלת תהליך");
    start.type = "button";
    hd.appendChild(start);
    sc.appendChild(hd);

    var body = el("div", "lab-setsubbody lab-hidden");
    var row  = P.promote.querySelector(":scope > .row");
    var stat = P.promote.querySelector("#pr-status");
    var note = P.promote.querySelector(":scope > .note");
    if(row)  body.appendChild(row);
    if(stat) body.appendChild(stat);
    if(note) body.appendChild(note);
    sc.appendChild(body);

    var chk = P.promote.querySelector("#pr-skipgrad-wrap");
    if(chk) sc.appendChild(chk);

    start.addEventListener("click", function(){
      var closed = body.classList.toggle("lab-hidden");
      start.textContent = closed ? "התחלת תהליך" : "סגירה";
    });
    p.appendChild(sc);
    P.promote.remove();
  }
  return p;
}

/* ---- נתונים היסטוריים — שתי רשימות שנפתחות -------------------------- */
function histCard(P){
  if(!P.hist && !P.histGan) return null;
  var p = labPanel("hist", "נתונים היסטוריים",
        "סיכומי שנים קודמות למחשבון האחוזים. נפתחים בלחיצה — משנת ההפעלה ואילך הכול מסונכרן אוטומטית.");
  [[P.hist, "נתונים היסטוריים (שנים קודמות)"],
   [P.histGan, "נתונים היסטוריים לפי גן (שנים קודמות)"]].forEach(function(x){
    if(!x[0]) return;
    x[0].dataset.labUsed = "1";
    var d = el("details", "lab-fold");
    d.appendChild(el("summary", "lab-foldh", x[1]));
    var b = el("div", "lab-foldb");
    moveBody(x[0], b, true);
    d.appendChild(b);
    p.appendChild(d);
    x[0].remove();
  });
  return p;
}

/* ---- רף שיבוץ ------------------------------------------------------- */
function capsCard(P){
  if(!P.caps) return null;
  P.caps.dataset.labUsed = "1";
  var p = labPanel("caps", "רף שיבוץ — מקסימום משובצות בגן");
  var sub = el("div", "lab-psub");
  sub.appendChild(document.createTextNode("מגבלה קשיחה על השיבוץ הסופי בלבד. "));
  sub.appendChild(el("b", null, "הרישום אינו מוגבל."));
  sub.appendChild(document.createTextNode(" רף בכרטיס גן גובר על ברירת המחדל. עד שמזינים מספר — אין הגבלה כלל."));
  var head = p.querySelector(".lab-phead");
  if(head) head.appendChild(sub);
  moveBody(P.caps, p);
  P.caps.remove();

  /* הלוח מציג שורה אחת: שני השדות, הסימון והשמירה. בתוכנה זה grid בן שלוש
     משבצות, והסימון נדחס לעמודה צרה ונשבר לשתי שורות. */
  var g = p.querySelector(".grid.g3");
  if(g){
    g.classList.remove("g3");
    g.classList.add("lab-capsrow");
    var hint = g.querySelector(".hint");
    if(hint) hint.classList.add("lab-hidden");   /* ההסבר כבר בכותרת הכרטיס */
    var save = p.querySelector("#saveAC");
    if(save){
      var srow = save.closest(".row");
      g.appendChild(save);
      save.classList.add("lab-atend");
      save.textContent = "שמירה";
      if(srow && !srow.children.length) srow.remove();
    }
  }
  return p;
}

/* ---- צהרון: מינימום ומקסימום ----------------------------------------
   ההגדרה נפרדת לכל סוג חינוך, כי המספרים שונים ברגיל ובחינוך מיוחד.
   בתוכנה זו טבלה בת שתי שורות; כאן היא הופכת לשורת שדות אחת לכל סוג
   חינוך, בלי כותרות עמודה — התווית יושבת על השדה עצמו. */
function tzminCard(P){
  if(!P.tzmin) return null;
  P.tzmin.dataset.labUsed = "1";
  var p = labPanel("tzmin", "צהרון — מינימום ומקסימום",
        "גודל קבוצת הצהרון, בנפרד לכל סוג חינוך. מתחת למינימום הגן מסומן באדום; מקסימום ריק = בלי תקרה.");
  moveBody(P.tzmin, p);
  P.tzmin.remove();

  var wrap = p.querySelector(".table-wrap");
  if(wrap){
    var rows = wrap.querySelectorAll("tbody tr");
    var box  = el("div", "lab-tzlims");
    Array.prototype.forEach.call(rows, function(tr){
      var cells = tr.querySelectorAll("td");
      if(cells.length < 3) return;
      var line = el("div", "lab-tzrow");
      line.appendChild(el("div", "lab-tzedu", (cells[0].textContent || "").trim()));
      [["מינימום", cells[1]], ["מקסימום", cells[2]]].forEach(function(x){
        var f = el("div", "lab-tzfield");
        f.appendChild(el("label", null, x[0]));
        var inp = x[1].querySelector("input");
        if(inp) f.appendChild(inp);            /* מוזז, לא משוכפל — המאזינים נשמרים */
        line.appendChild(f);
      });
      box.appendChild(line);
    });
    if(box.children.length){ wrap.parentNode.insertBefore(box, wrap); wrap.remove(); }
  }

  /* כפתור השמירה מצטרף לשורה התחתונה, כמו בשאר כרטיסי ההגדרות */
  var save = p.querySelector("#saveTzMin");
  if(save) save.textContent = "שמירה";
  return p;
}

/* ---- מי מחובר ויומן פעילות ------------------------------------------
   שני פאנלים על אותו נושא — מי נמצא במערכת ומה נעשה בה. מאוחדים לכרטיס
   אחד בשני טורים, כדי שהתמונה תהיה במבט אחד. */
function presenceCard(P){
  if(!P.presence && !P.activity) return null;
  var p = labPanel("presence", "מי מחובר ויומן פעילות",
        "מי פעיל במערכת ברגע זה, ומה נערך לאחרונה — שימושי לדעת מתי בטוח לבצע שינויים.");
  var two = el("div", "lab-two");
  [[P.presence, "מחוברים עכשיו"], [P.activity, "העריכה האחרונה של כל משתמש"]].forEach(function(x){
    if(!x[0]) return;
    x[0].dataset.labUsed = "1";
    var half = el("div", "lab-half");
    var h2   = x[0].querySelector(":scope > h2");
    var cnt  = h2 ? h2.querySelector(".pill") : null;
    var hd   = el("div", "lab-halfh", x[1]);
    if(cnt) hd.appendChild(cnt);            /* מונה "3 מחוברים" — מועבר */
    half.appendChild(hd);
    moveBody(x[0], half);
    two.appendChild(half);
    x[0].remove();
  });
  p.appendChild(two);
  return p;
}

/* ---- ניהול משתמשים ומנהלי מערכת --------------------------------------
   טבלת המשתמשים נבנית מחדש על ידי renderUsers() בכל שינוי, ולכן ההתאמה
   שלה חוזרת דרך MutationObserver ולא פעם אחת. האלמנטים מוזזים ולא
   משוכפלים — הכפתורים והבוררים שומרים את המאזינים שלהם. */
function usersCard(P){
  if(!P.users && !P.admins) return null;
  var p = labPanel("users", P.users ? "ניהול משתמשים ומנהלי מערכת" : "מנהלי מערכת",
        "הכניסה למערכת היא עם חשבון Google מורשה בלבד. רק כתובות שברשימת המנהלים יכולות לשנות את הגדרות המערכת.");
  if(P.users){
    P.users.dataset.labUsed = "1";
    moveBody(P.users, p);
    P.users.remove();
    var box = p.querySelector("#users-box");
    if(box){
      usersTable(box);
      new MutationObserver(function(){ usersTable(box); })
        .observe(box, {childList:true});
    }
  }
  if(P.admins){
    P.admins.dataset.labUsed = "1";
    var strip = el("div", "lab-adminstrip");
    strip.appendChild(el("div", "lab-halfh", "מנהלי מערכת"));
    moveBody(P.admins, strip);
    p.appendChild(strip);
    P.admins.remove();
  }
  return p;
}
/* התאמת טבלת המשתמשים ללוח: עמודת "משתמש" אחת — עיגול ראשי תיבות, שם
   ומייל — במקום שני טורים נפרדים. */
function usersTable(box){
  var tbl = box.querySelector("table");
  if(!tbl || tbl.dataset.lab) return;
  tbl.dataset.lab = "1";
  tbl.classList.add("lab-users");

  var HEAD = ["משתמש", "", "הרשאה", "היקף", "כניסה אחרונה", ""];
  var ths = tbl.querySelectorAll("thead th");
  ths.forEach(function(th, i){
    if(HEAD[i] == null) return;
    th.textContent = HEAD[i];
    if(HEAD[i] === "") th.classList.add("lab-hidden");
  });
  tbl.querySelectorAll("tbody tr").forEach(function(tr){
    var td = tr.children;
    if(td.length < 2) return;
    var mail = String(td[0].textContent || "").replace(/זה אני/, "").trim();
    var me   = td[0].querySelector(".pill");
    var inp  = td[1].querySelector("input");
    var cell = el("div", "lab-ucell");
    cell.appendChild(el("span", "lab-uini", mail.slice(0, 2).toUpperCase()));
    var txt = el("div", "lab-utxt");
    if(inp) txt.appendChild(inp);                 /* שדה השם — מועבר */
    var m = el("div", "lab-umail", mail);
    m.dir = "ltr";
    txt.appendChild(m);
    if(me) txt.appendChild(me);
    cell.appendChild(txt);
    td[0].textContent = "";
    td[0].appendChild(cell);
    td[1].classList.add("lab-hidden");
  });
}

/* ---- חשבון והתחברות ------------------------------------------------- */
function authCard(P){
  if(!P.auth) return null;
  P.auth.dataset.labUsed = "1";
  var p = labPanel("auth", "חשבון והתחברות",
        "הכניסה מאובטחת בחשבון Google מורשה בלבד. הנתונים בענן ומסונכרנים בין כל המכשירים.");
  moveBody(P.auth, p);
  P.auth.remove();
  return p;
}

/* ---- מיתוג והתקנה כאפליקציה ------------------------------------------
   הכותרת, כותרת המשנה, הלוגו וההתקנה הם החלטה אחת — איך המערכת נראית
   ואיפה היא יושבת — ולכן כרטיס אחד. הוראות ההתקנה הארוכות יורדות
   לרשימה שנפתחת; הכפתור עצמו נשאר בשורה. */
function brandCard(P){
  if(!P.brand && !P.install) return null;
  var p = labPanel("brand", "מיתוג והתקנה כאפליקציה",
        "הכותרת והלוגו מופיעים בראש כל מסך, בכותרת הדפדפן, ובאייקון האפליקציה.");
  if(P.brand){
    P.brand.dataset.labUsed = "1";
    moveBody(P.brand, p);
    P.brand.remove();
  }
  if(P.install){
    P.install.dataset.labUsed = "1";
    var box = P.install.querySelector("#install-box");
    var btn = el("button", "btn lab-installbtn", "🧩 התקנה כאפליקציה");
    btn.type = "button";
    var fold = el("details", "lab-fold lab-installfold");
    fold.appendChild(el("summary", "lab-foldh", "הוראות התקנה ידנית"));
    var fb = el("div", "lab-foldb");
    if(box) fb.appendChild(box);
    fold.appendChild(fb);
    btn.addEventListener("click", function(){
      var real = box ? box.querySelector("#do-install") : null;
      if(real){ real.click(); return; }
      fold.open = !fold.open;
    });
    /* הכפתור נכנס לשורת הלוגו שכבר קיימת, בקצה השני */
    var row = p.querySelector(".row");
    if(row){ btn.classList.add("lab-atend"); row.appendChild(btn); }
    else p.appendChild(btn);
    p.appendChild(fold);
    P.install.remove();
  }
  return p;
}

/* --------------------------------------------------------- כלים ושירותים */
/* הלוח מציג את הכלים כרשת כרטיסים, עם עיגול אייקון בצד ימין ותג מצב בצד
   שמאל. בתוכנה זה טור אחד והאייקון תקוע בתוך הכותרת. */
function toolsScreen(){
  if(curTab() !== "tools" || view.querySelector(".lab-grid")) return;
  var panels = Array.prototype.slice.call(view.querySelectorAll(":scope > .panel"));
  if(panels.length < 2) return;
  var grid = el("div", "lab-grid");
  view.insertBefore(grid, panels[0]);
  panels.forEach(function(p){ grid.appendChild(p); toolCard(p); });
}
function toolCard(p){
  var h = p.querySelector(":scope > h2");
  if(!h || h.querySelector(".lab-ic")) return;
  /* חילוץ האמוג׳י הפותח לעיגול נפרד */
  var txt = String(h.textContent || "");
  var m = txt.match(/^\s*([\u203C-\u3299\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\uFE0F]+)\s*(.*)$/);
  var pill = h.querySelector(".pill");
  var icon = m ? m[1] : "";
  var name = m ? m[2] : txt.trim();
  h.textContent = "";
  var ic = el("span", "lab-ic", icon || "▣");
  var tt = el("span", "lab-ictt", name);
  h.appendChild(ic); h.appendChild(tt);
  if(pill) h.appendChild(pill);
  p.classList.add("lab-tool");
}

/* ------------------------------------------------- מסמכים ותבניות (11) */
/* בלוח כל סוג מסמך הוא כרטיס עם רצועת כותרת: עיגול אייקון, שם ושורת הסבר,
   והפקדים בגוף. בתוכנה זה fieldset עם legend ו-hint — אותם חלקים בדיוק. */
function templatesScreen(){
  if(curTab() !== "templates") return;
  var panel = view.querySelector(".panel");
  if(!panel) return;
  panel.classList.add("lab-bare");
  panel.querySelectorAll(":scope > fieldset").forEach(function(f){
    if(f.classList.contains("lab-doc")) return;
    var lg = f.querySelector(":scope > legend");
    if(!lg) return;
    f.classList.add("lab-doc");

    var head = el("div", "lab-dochead");
    var txt  = String(lg.textContent || "");
    var m    = txt.match(/^\s*([\u203C-\u3299\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\uFE0F]+)\s*(.*)$/);
    head.appendChild(el("span", "lab-ic", m ? m[1] : "▢"));
    var tt = el("div", "lab-doctt");
    tt.appendChild(el("div", "lab-docname", m ? m[2] : txt.trim()));
    var hint = f.querySelector(":scope > .hint");
    if(hint){ hint.classList.add("lab-docsub"); tt.appendChild(hint); }
    head.appendChild(tt);
    lg.remove();
    f.insertBefore(head, f.firstChild);

    /* התיבות הפנימיות (משרד ראשי / משרד החינוך) — תת-כרטיסים בשתי עמודות */
    var subs = [];
    Array.prototype.slice.call(f.children).forEach(function(c){
      if(c === head || c === hint) return;
      if(c.tagName === "DIV" && c.querySelector(".btn") && c.querySelector("b")) subs.push(c);
    });
    if(subs.length > 1){
      var grid = el("div", "lab-docgrid");
      f.insertBefore(grid, subs[0]);
      subs.forEach(function(c){ c.classList.add("lab-subdoc"); grid.appendChild(c); });
    }
  });
}

/* --------------------------------------------------------- העוזר החכם */
/* הלוח מציג את מי־מחובר ואת יומן הפעילות עם עיגול ראשי־תיבות לכל משתמש. */
function initials(name){
  var w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if(!w.length) return "־";
  return (w[0][0] || "") + (w.length > 1 ? (w[1][0] || "") : "");
}
function presenceSkin(){
  view.querySelectorAll(".pill:not(.lab-pres)").forEach(function(p){
    if(!p.closest(".panel")) return;
    var h2 = p.closest(".panel").querySelector("h2");
    if(!h2 || String(h2.textContent).indexOf("מי מחובר") < 0) return;
    p.classList.add("lab-pres");
  });
  /* שורות יומן הפעילות — עיגול ראשי תיבות בעמודה הראשונה */
  view.querySelectorAll("table tbody tr").forEach(function(tr){
    var tb = tr.closest("table");
    if(tb && tb.classList.contains("lab-users")) return;   /* לזו כבר יש עיגול משלה */
    var head = tb && tb.querySelector("thead th");
    if(!head || String(head.textContent).trim() !== "משתמש") return;
    var td = tr.firstElementChild;
    if(!td || td.querySelector(".lab-av")) return;
    var nm = String(td.textContent || "").trim();
    var av = el("span", "lab-av", initials(nm));
    td.insertBefore(av, td.firstChild);
    td.classList.add("lab-avcell");
  });
}

/* ===========================================================================
   תלמידות — תצוגת כרטיסים (לוח 17, המסך האמצעי)
   ---------------------------------------------------------------------------
   הבורר "טבלה | כרטיסים" שבלוח. הטבלה נשארת במקומה ורק מוסתרת, כך שכל
   המאזינים, המיון והבחירה הקבוצתית שקשורים אליה ממשיכים לחיות. הכרטיסים
   מוצגים לצידה ומוזנים מ-filteredStudents() — אותה רשימה בדיוק.
   =========================================================================== */
var stuMode = "table";           /* בלוח 01 "טבלה" הוא הפעיל */

function stuCard(r){
  var c = el("button", "ls-card" + (r.tone ? " " + r.tone : ""));
  c.type = "button";
  if(r.ageInk) c.style.setProperty("--age-ink", r.ageInk);

  c.appendChild(el("span", "ls-badge " + r.tone, r.status));

  var body = el("span", "ls-body");
  var t = el("span", "ls-t");
  t.appendChild(el("span", "ls-name", r.name));
  var bits = [];
  if(r.gan) bits.push(r.gan);
  if(r.age) bits.push("בת " + r.age);
  if(r.period) bits.push("מועד " + r.period);
  if(!bits.length) bits.push("ללא גן");
  t.appendChild(el("span", "ls-sub", bits.join(" · ")));
  body.appendChild(t);
  body.appendChild(el("span", "ls-ini", r.ini));
  c.appendChild(body);

  var foot = el("span", "ls-foot");
  var docs = el("span", "ls-docs");
  docs.appendChild(el("span", "ls-dic", "▤"));
  var segs = el("span", "ls-segs");
  for(var i = 0; i < r.docsTotal; i++){
    segs.appendChild(el("i", i < r.docsDone ? "on" : ""));
  }
  docs.appendChild(segs);
  docs.appendChild(el("span", "ls-dn", r.docsDone + "/" + r.docsTotal));
  foot.appendChild(docs);
  if(!r.muni) foot.appendChild(el("span", "ls-muni", "לא קלוט"));
  c.appendChild(foot);

  c.onclick = function(){
    if(window.__uiLab && window.__uiLab.openStudent) window.__uiLab.openStudent(r.id);
  };
  return c;
}

function renderStuCards(host){
  var d = (window.__uiLab && window.__uiLab.studentCards)
            ? window.__uiLab.studentCards() : null;
  if(!d) return false;
  var box = view.querySelector(".ls-cards");
  if(!box){
    box = el("div", "ls-cards");
    host.parentNode.insertBefore(box, host.nextSibling);
  }
  if(box.dataset.n === String(d.total) + ":" + d.openId) return true;
  box.dataset.n = String(d.total) + ":" + d.openId;
  box.innerHTML = "";
  if(!d.rows.length){
    box.appendChild(el("div", "lab-empty", "אין תלמידות התואמות לסינון."));
    return true;
  }
  d.rows.forEach(function(r){
    var c = stuCard(r);
    if(r.id === d.openId) c.classList.add("on");
    box.appendChild(c);
  });
  if(d.total > d.rows.length){
    box.appendChild(el("div", "lab-empty",
      "מוצגות " + d.rows.length + " מתוך " + d.total + " — צמצמ/י את הסינון או עברו לטבלה."));
  }
  return true;
}

/* הבורר עצמו — אותו רכיב של מסך הגנים */
function stuToggle(host){
  var bar = view.querySelector(".lab-stoggle");
  if(bar) return bar;
  bar = el("div", "lab-gtoggle lab-stoggle");
  /* ⚠️ .stu-stage הוא flex — הזרקה לתוכו הופכת את הבורר לעמודה שגוזלת
     רוחב מהטבלה. הוא נכנס מעל הבמה, לא לתוכה. */
  var stage = host.closest(".stu-stage");
  [["table", "טבלה"], ["cards", "כרטיסים"]].forEach(function(m){
    var b = el("button", "lg-tab" + (stuMode === m[0] ? " on" : ""), m[1]);
    b.onclick = function(){
      if(stuMode === m[0]) return;
      stuMode = m[0];
      bar.querySelectorAll(".lg-tab").forEach(function(x){ x.classList.toggle("on", x === b); });
      applyStuMode();
    };
    bar.appendChild(b);
  });
  var line = view.querySelector(".lab-mline");
  if(line){ bar.classList.add("in-line"); line.appendChild(bar); }
  else{
    var anchor = stage || host;
    anchor.parentNode.insertBefore(bar, anchor);
  }
  return bar;
}

function applyStuMode(){
  var host = view.querySelector("#stuTable");
  if(!host) return;
  var cards = view.querySelector(".ls-cards");
  if(stuMode === "cards"){
    host.classList.add("lab-hidden");
    if(!renderStuCards(host)) host.classList.remove("lab-hidden");
  }else{
    host.classList.remove("lab-hidden");
    if(cards) cards.remove();
  }
}

/* ===========================================================================
   מסך התלמידות — הסרגל העליון, שורת התאריך והסינון (לוח 01)
   ---------------------------------------------------------------------------
   בלוח: "+ הוספת ילדה · ייצוא · ייבוא" בצד שמאל של הכותרת, ומעל הכותרת שורת
   תאריך עברי ושעת עדכון. "עדכון קבוצתי" יורד לפס הבחירה התחתון, ו"שליחת
   הודעות" יורדת לגמרי — יש לה מסך משלה.
   =========================================================================== */
/* "הוספת תלמידה" ו"עדכון לפי מ.ז." עברו לכפתור המרחף */
var STU_TOP  = ["exportStu", "importStu"];   /* הסדר בלוח */
var STU_DROP = ["stuMsg"];                             /* למסך ההודעות יש לשונית */

function studentsTop(){
  /* ⚠️ screenHeader מוציא את בלוק הכותרת מהפאנל אל ראש #view, ולכן חיפוש
     בתוך .panel מחזיר null והפונקציה הייתה יוצאת בשקט. */
  var head = view.querySelector(".lab-shead");
  if(!head) return;

  /* שורת התאריך מעל הכותרת, במקום כותרת־המשנה הגנרית */
  var d = (window.__uiLab && window.__uiLab.stuKpis) ? window.__uiLab.stuKpis() : null;
  if(d && d.date){
    var line = head.querySelector(".lab-ssub");
    if(!line){
      line = el("div", "lab-ssub");
      var t = head.querySelector(".lab-shead-t");
      if(t) t.insertBefore(line, t.firstChild);
    }
    var txt = d.date + " · עודכן " + d.time;
    if(line.textContent !== txt) line.textContent = txt;
  }

  var acts = head.querySelector(".lab-sacts");
  if(!acts){ acts = el("div", "lab-sacts"); head.appendChild(acts); }

  /* מה שאינו שייך למסך הזה יורד */
  STU_DROP.forEach(function(id){
    var b = view.querySelector("#" + id);
    if(b) b.classList.add("lab-hidden");
  });

  /* שלושת כפתורי הלוח, בסדר שלו ובשמות שלו. הסדר נאכף בכל מעבר, כי
     screenHeader מסדר אותם לפי סדר ה-DOM המקורי. */
  orderInto(acts, STU_TOP, { exportStu:"ייצוא", importStu:"ייבוא" });
  /* התווית "ייבוא / יצוא:" והמפריד נשארו יתומים אחרי שהכפתורים עלו */
  var row = view.querySelector(".panel > .row");
  if(row) Array.prototype.slice.call(row.children).forEach(function(c){
    if(!c.classList.contains("btn")) c.classList.add("lab-hidden");
  });
}

/* שורת הסינון (לוח 01): שדה חיפוש · שלושה שבבי סינון קבועים — גן, גיל,
   מאפיין · השבבים הפעילים · "נקה" · "עוד ▾" שפותח את הפאנל המלא.
   כל שבב עוטף את הפקד האמיתי שבפאנל, ולכן אין כאן מנגנון סינון שני. */
function studentsFilters(){
  var sb = view.querySelector(".searchbar");
  var chips = view.querySelector("#stuChips");
  if(!sb) return;
  if(!sb.classList.contains("lab-fbar")) sb.classList.add("lab-fbar");

  if(!sb.dataset.labFixed){
    sb.dataset.labFixed = "1";

    /* גן — <details class="msel"> בקוד. ה-summary שלו הופך לפני השבב. */
    var gan = view.querySelector("#f-gan");
    if(gan){ gan.classList.add("lab-mchip"); hideField(gan); sb.appendChild(gan); }

    /* גיל — שורת כפתורים. עוטפים אותה ב-details כדי שתיפתח כשבב. */
    var age = view.querySelector("#f-age");
    if(age){
      var d = el("details", "lab-mchip lab-agechip");
      var sum = el("summary", null, "גיל");
      d.appendChild(sum);
      var menu = el("div", "msel-menu");
      hideField(age);
      menu.appendChild(age);                  /* העברה — המאזינים נשמרים */
      d.appendChild(menu);
      sb.appendChild(d);
    }

    /* מאפיין — <select> רגיל */
    var flag = view.querySelector("#f-flag");
    if(flag){
      var chip = el("label", "lab-selchip");
      chip.appendChild(el("span", "lab-sclbl", "מאפיין"));
      hideField(flag);
      chip.appendChild(flag);                 /* העברה — המאזין נשמר */
      chip.classList.toggle("on", !!flag.value);
      flag.addEventListener("change", function(){ chip.classList.toggle("on", !!flag.value); });
      sb.appendChild(chip);
    }
  }

  /* השבבים הפעילים (עם ✕) יושבים מיד אחרי שדה החיפוש — לפני שבבי
     הסינון הקבועים, כפי שהלוח מציג. "נקה" נשאר בסוף. */
  if(chips && !chips.classList.contains("lab-hidden")){
    var after = sb.querySelector(".search-field");
    Array.prototype.slice.call(chips.childNodes).forEach(function(n){
      if(n.nodeType === 1 && n.classList.contains("fchip")){
        sb.insertBefore(n, after ? after.nextSibling : sb.firstChild);
        after = n;
      }else{
        sb.appendChild(n);                  /* "נקה" והתווית — לסוף */
      }
    });
    chips.classList.add("lab-hidden");
  }
  var clr = sb.querySelector(".clr");
  if(clr && clr.textContent !== "נקה") clr.textContent = "נקה";

  var tg = sb.querySelector(".filter-toggle");
  if(tg){
    if(tg.textContent.indexOf("עוד") < 0){
      var cnt = tg.querySelector(".fcount");
      tg.textContent = "עוד ▾";
      if(cnt) tg.appendChild(cnt);
    }
    if(tg !== sb.lastElementChild) sb.appendChild(tg);
  }

  /* סימון פעיל על שבב הגן ושבב הגיל */
  var g = sb.querySelector("#f-gan");
  if(g){
    var sm = g.querySelector("summary");
    var on = !!(sm && sm.textContent.indexOf("כל הגנים") < 0 && sm.textContent.trim());
    g.classList.toggle("on", on);
  }
  var ac = sb.querySelector(".lab-agechip");
  if(ac) ac.classList.toggle("on", !!view.querySelector("#f-age .btn:not(.ghost)"));

  /* "עיר" מיותר — הרחוב והקמפוס כבר מצמצמים מספיק, והוא זה שדחף את
     "ניקוי" לשורה נפרדת. */
  var city = view.querySelector("#f-city");
  if(city) hideField(city);

  /* "התאם לעמוד אחד" בשורת רשימת הגן — מיותר */
  var op = view.querySelector("#stuGanOnepage");
  if(op){
    var lab = op.closest("label");
    if(lab) lab.classList.add("lab-hidden");
  }

  markSetFields();
}

/* שדה בפאנל שנבחר בו ערך נצבע כהה, כמו שבב פעיל בשורה שבחוץ */
function markSetFields(){
  view.querySelectorAll(".filter-panel .field").forEach(function(f){
    var c = f.querySelector("select, input[type=text], input:not([type])");
    if(!c) return;
    var on = !!String(c.value || "").trim();
    if(f.classList.contains("lab-set") !== on) f.classList.toggle("lab-set", on);
  });
}

/* מסתיר את עטיפת ה-.field שנשארה ריקה בפאנל אחרי שהפקד עלה לשבב */
function hideField(node){
  var f = node.closest(".field");
  if(f && f !== node) f.classList.add("lab-hidden");
}

/* שורת ההתאמות והטבלה הן כרטיס לבן אחד, כמו בלוח — ולא שורה חשופה
   מעל כרטיס. הפאנל החיצוני נשאר, אבל בלי רקע ומסגרת משלו. */
function studentsCard(){
  var stage = view.querySelector(".stu-stage");
  var table = view.querySelector("#stuTable");
  var line  = view.querySelector(".lab-mline");
  if(!stage || !table) return;

  var panel = stage.closest(".panel");
  if(panel) panel.classList.add("lab-bare");

  var card = stage.querySelector(".lab-tablecard");
  if(!card){
    card = el("div", "lab-tablecard");
    stage.insertBefore(card, table);
    if(line) card.appendChild(line);
    card.appendChild(table);
  }else if(line && line.parentNode !== card){
    card.insertBefore(line, card.firstChild);
  }
}

/* הפס התחתון (הצילום שצורף): פעולות הבחירה יושבות בפס הכהה שבתחתית
   המסך, והפס נשאר גלוי בגלילה. הכניסה למצב "עדכון קבוצתי" והיציאה ממנו
   הן בכפתור המרחף של התוכנה.

   ⚠️ renderSelBar עושה innerHTML="" ל-#stuSelBar בכל רינדור, ולכן #bulkBar
   מועבר לעטיפה כאח שלו ולא לתוכו — מחוץ להישג ידו של ה-innerHTML. */
function studentsBottom(){
  var host = view.querySelector("#stuSelBar");
  var bulkBar = view.querySelector("#bulkBar");
  if(!host) return;

  var wrap = view.querySelector(".lab-botwrap");
  if(!wrap){
    wrap = el("div", "lab-botwrap");
    host.parentNode.insertBefore(wrap, host);
    /* #bulkBar נולד בראש המסך — שם הוא קפץ למעלה בכל פתיחה.
       מזיזים את האלמנט עצמו; renderBulkBar כותב לתוכו לפי id ולכן
       ממשיך לעבוד בדיוק כמו קודם, רק במקום אחר. */
    var line = el("div", "lab-botline");
    if(bulkBar) line.appendChild(bulkBar);
    wrap.appendChild(line);
    wrap.appendChild(host);
  }

  /* כשהתיק פתוח הכרטיס צר, והשורה נשברה לשתיים. תוויות קצרות יותר
     מחזירות אותה לשורה אחת בלי לוותר על אף פקד. */
  var SHORT = { "bulk-selall":"הכל", "bulk-clear":"נקה" };
  Object.keys(SHORT).forEach(function(id){
    var b = view.querySelector("#" + id);
    if(!b) return;
    var n = (String(b.textContent).match(/\((\d+)\)/) || [])[0] || "";
    var t = SHORT[id] + (n ? " " + n : "");
    if(b.textContent !== t) b.textContent = t;      /* בלי זה — לולאת צופה */
  });
  /* "שדה לעדכון" — הבורר מדבר בעד עצמו, והתווית גזלה שליש מהשורה */
  var fl = view.querySelector("#bulkBar label");
  if(fl) fl.classList.add("lab-hidden");

  /* הפס נצבע כהה כשיש בו תוכן — פאנל שדות או בחירה פעילה */
  var live = !!(host.querySelector(".selbar") || (bulkBar && bulkBar.firstChild));
  if(wrap.classList.contains("on") !== live) wrap.classList.toggle("on", live);

  /* כשתיק הילדה פתוח הפס נעצר בקצה הטבלה ואינו נכנס מתחת לתיק */
  var q = view.querySelector("#stuQuick");
  var narrow = !!(q && !q.classList.contains("empty-state"));
  if(wrap.classList.contains("lab-narrow") !== narrow) wrap.classList.toggle("lab-narrow", narrow);
}

/* ===========================================================================
   העמודות הנוספות — בחירה לכל עמודה בנפרד
   ---------------------------------------------------------------------------
   בתוכנה יש דגל אחד, stuMoreCols, ששבע העמודות הנוספות תלויות בו יחד: הכל
   או כלום. בעיצוב החדש ה-"+" שבכותרת הטבלה פותח רשימת סימון, ובוחרים בה
   עמודה עמודה — וגם מורידים משם.

   ⚠️ הבחירה נשמרת כמחלקות על <html>, לא על הטבלה. renderStuTable() בונה את
   הטבלה מחדש בכל סינון, מיון ולחיצה על שורה; מחלקה שהייתה עליה נמחקת, וכל
   העמודות היו מהבהבות עד הצביעה הבאה. על <html> היא שורדת, ולכן העמודות
   שירדו אינן נראות לרגע.
   =========================================================================== */
var XCOLS = [
  ["age",    "גיל"],
  ["period", "מועד"],
  ["edu",    "חינוך"],
  ["docs",   "מסמכים"],
  ["muni",   "עירייה"],
  ["tags",   "סימונים"],
  ["status", "סטטוס"]
];
var XKEY = "rg-lab-stucols";
var xcolsOn = null;                    /* נקרא פעם אחת, ואז חי בזיכרון */

function xcolsRead(){
  var raw = null;
  try{ raw = localStorage.getItem(XKEY); }catch(e){}
  if(raw === null){
    /* פעם ראשונה — ממשיכים מהעדפת התוכנה, שהיא הכל או כלום */
    var all = false;
    try{ all = localStorage.getItem("rg-stu-cols") === "1"; }catch(e){}
    return all ? XCOLS.map(function(c){ return c[0]; }) : [];
  }
  return raw ? raw.split(",").filter(Boolean) : [];
}
function xcolsApply(){
  if(!xcolsOn) xcolsOn = xcolsRead();
  var root = document.documentElement;
  XCOLS.forEach(function(c){
    root.classList.toggle("lab-xoff-" + c[0], xcolsOn.indexOf(c[0]) < 0);
  });
}
function xcolsCommit(){
  try{ localStorage.setItem(XKEY, xcolsOn.join(",")); }catch(e){}
  xcolsApply();
  var head = view && view.querySelector(".stu-table thead tr");
  var menu = head && head.querySelector(".lab-colmenu");
  if(head && menu){ placeColPlus(head, menu); syncColMenu(menu); posColMenu(menu); }
}
function xcolsSet(key, on){
  if(!xcolsOn) xcolsOn = xcolsRead();
  var i = xcolsOn.indexOf(key);
  if(on && i < 0) xcolsOn.push(key);
  else if(!on && i >= 0) xcolsOn.splice(i, 1);
  xcolsCommit();
}
function xcolsAll(on){
  xcolsOn = on ? XCOLS.map(function(c){ return c[0]; }) : [];
  xcolsCommit();
}

/* האם התא הזה שייך לעמודה נוספת שירדה */
function xcolOff(th){
  if(!th.classList || !th.classList.contains("xcol")) return false;
  for(var i = 0; i < XCOLS.length; i++){
    if(th.classList.contains("xcol-" + XCOLS[i][0]))
      return xcolsOn.indexOf(XCOLS[i][0]) < 0;
  }
  return false;
}

/* ה-"+" יושב בכותרת האחרונה שגלויה *בפועל*. בלי זה הוא היה נעלם יחד עם
   התא שמארח אותו ברגע שמורידים את העמודה האחרונה — ואז אי אפשר להחזיר
   אותה, כי הכפתור שפותח את הרשימה נעלם בעצמו. */
function placeColPlus(head, menu){
  var cells = head.children, target = null;
  for(var i = cells.length - 1; i >= 0; i--){
    if(!xcolOff(cells[i])){ target = cells[i]; break; }
  }
  if(!target) return;
  Array.prototype.forEach.call(head.querySelectorAll("th.lab-colplus-cell"), function(t){
    if(t !== target) t.classList.remove("lab-colplus-cell");
  });
  target.classList.add("lab-colplus-cell");
  if(menu.parentNode !== target) target.appendChild(menu);
}

function buildColMenu(){
  var d   = el("details", "msel lab-colmenu");
  var sum = el("summary", null, "+");
  d.appendChild(sum);

  var menu = el("div", "msel-menu");
  menu.appendChild(el("div", "lab-colttl", "עמודות נוספות"));
  XCOLS.forEach(function(c){
    var lab = el("label", "msel-opt");
    lab.dataset.col = c[0];
    var cb = el("input");
    cb.type = "checkbox"; cb.value = c[0];
    cb.onchange = function(){ xcolsSet(c[0], cb.checked); };
    lab.appendChild(cb);
    lab.appendChild(el("span", null, c[1]));
    menu.appendChild(lab);
  });
  var tools = el("div", "lab-coltools");
  [["הצג הכל", true], ["נקה", false]].forEach(function(t){
    var b = el("button", "btn ghost sm", t[0]);
    b.type = "button";
    b.onclick = function(){ xcolsAll(t[1]); };
    tools.appendChild(b);
  });
  menu.appendChild(tools);
  d.appendChild(menu);

  /* הכותרת ממיינת בלחיצה (onclick על ה-th). הבורר שיושב בתוכה לא אמור
     למיין, ולכן הלחיצה נעצרת כאן ואינה עולה אל התא. */
  d.addEventListener("click", function(e){ e.stopPropagation(); });

  /* ⚠️ .table-wrap הוא overflow-x:auto, ולכן overflow-y שלו מחושב ל-auto
     והוא חותך כל תפריט מוחלט שנפתח בתוכו. position:fixed בורח מהחיתוך,
     והמיקום נמדד בכל פתיחה. */
  d.addEventListener("toggle", function(){ posColMenu(d); });
  return d;
}

/* המיקום נמדד מחדש גם כשהתפריט פתוח וה-"+" זז לכותרת אחרת — כלומר בכל
   סימון והסרה, כי הן משנות מי העמודה האחרונה שגלויה. */
function posColMenu(d){
  if(!d || !d.open) return;
  var sum  = d.querySelector("summary");
  var menu = d.querySelector(".msel-menu");
  if(!sum || !menu) return;
  var r = sum.getBoundingClientRect();
  menu.style.top  = Math.round(r.bottom + 4) + "px";
  menu.style.left = Math.round(r.left) + "px";   /* נפתח פנימה, אל תוך הטבלה */
}

function syncColMenu(menu){
  var head = menu.closest("tr");
  var n = 0;
  Array.prototype.forEach.call(menu.querySelectorAll(".msel-opt"), function(lab){
    var key = lab.dataset.col;
    var cb  = lab.querySelector("input");
    var on  = xcolsOn.indexOf(key) >= 0;
    if(cb.checked !== on) cb.checked = on;
    if(on) n++;
    /* עמודת החינוך יורדת מהטבלה כשכבר נבחר חינוך אחד — אין טעם להציע אותה */
    var exists = !head || !!head.querySelector(".xcol-" + key);
    lab.classList.toggle("lab-hidden", !exists);
  });
  var sum = menu.querySelector("summary");
  var lbl = n ? (XCOLS.filter(function(c){ return xcolsOn.indexOf(c[0]) >= 0; })
                      .map(function(c){ return c[1]; }).join(" · "))
              : "";
  var ttl = n ? ("עמודות נוספות · מוצגות: " + lbl) : "הוספת עמודות · " +
                XCOLS.map(function(c){ return c[1]; }).join(" · ");
  if(sum.title !== ttl){ sum.title = ttl; sum.setAttribute("aria-label", ttl); }
  menu.classList.toggle("on", n > 0);
}

/* "+" בכותרת הטבלה לעמודות הנוספות — במקום הכפתור עם הטקסט */
function colPlus(){
  var b = view.querySelector("#stuColsBtn");
  if(!b) return;                          /* לא מסך התלמידות */
  xcolsApply();

  /* הכפתור של התוכנה (הכל או כלום) והשורה שהוא יושב בה יורדים — כאן
     הבחירה היא לכל עמודה בנפרד, מתוך הכותרת עצמה. */
  b.classList.add("lab-hidden");
  var bar = b.parentNode;
  if(bar && bar.classList && bar.classList.contains("row")) bar.classList.add("lab-hidden");

  var head = view.querySelector(".stu-table thead tr");
  if(!head) return;
  var menu = head.querySelector(".lab-colmenu") || buildColMenu();
  placeColPlus(head, menu);
  syncColMenu(menu);
}

function maybeStudents(){
  if(homeBusy || !view) return;
  var b = nav.querySelector('[data-tab="students"]');
  if(!(b && b.classList.contains("active"))) return;
  homeBusy = true;                                /* אותו דגל — חוסם כניסה חוזרת */
  try{
    styleStuSummary(); studentsRows();
    var sm = view.querySelector("#stuSummary .stat .v");
    if(sm) matchLine("#stuTable", "תלמידות תואמות",
      (parseInt(String(sm.textContent).replace(/[^\d]/g,""),10) || 0));
    /* הדפסה ושיתוף כבר קיימים בייצוא שלמעלה — כאן הם כפילות */
    ["#stuGanPrint", "#stuGanShare"].forEach(function(sel){
      var b = view.querySelector(sel);
      if(b) b.classList.add("lab-hidden");
    });
    var host = view.querySelector("#stuTable");   /* אחרי matchLine — הבורר נכנס לתוכו */
    if(host){ stuToggle(host); applyStuMode(); }
    studentsTop(); studentsFilters(); studentsCard(); colPlus(); studentsBottom();
    /* כשתיק הילדה פתוח, שורת ההתאמות והבורר נעצרים בקצה הטבלה ואינם
       נמתחים מעל הפאנל — כפי שהלוח מציג. */

  }catch(e){}
  homeBusy = false;
}

function isHome(){
  var b = nav.querySelector('[data-tab="home"]');
  return !!(b && b.classList.contains("active"));
}

/* ---------------------------------------------------------------- צהרון
   מסך הצהרון (לשונית משנה תחת התלמידות). הזיהוי הוא לפי התוכן ולא לפי
   curTab, כי הלשונית שמסומנת בסרגל היא "תיקי התלמידות" שמעליה.

   כאן *לא* מחליפים את המסך — הכרטיסים לחיצים, הטבלאות מתרעננות בכל
   שינוי סינון, והחלפת ה-DOM הייתה שוברת את החיווט. רק שתי תוספות:
   הכרטיס הראשון הופך לכהה עם טבעת התקדמות, ושורת המצב מקבלת מד.
   ============================================================== */
function tzScreen(){
  var cards = view && view.querySelector("#tzCards");
  if(!cards) return;

  /* --- הכרטיס הראשון כהה, עם טבעת "כמה מהאפשריות כבר נפתחו" --- */
  var tiles = cards.querySelectorAll(".stat");
  if(tiles.length >= 4 && !tiles[0].classList.contains("lab-tzhero")){
    tiles[0].classList.add("lab-tzhero");
    var opened = numOf(tiles[1]), openable = numOf(tiles[2]);
    var total  = opened + openable;
    var pct    = total ? Math.round(opened / total * 100) : 0;
    var ring = el("div", "lab-tzring");
    ring.style.background = "conic-gradient(var(--lab-gold) 0 " + pct +
                            "%, rgba(255,255,255,.16) " + pct + "% 100%)";
    ring.appendChild(el("div", "lab-tzring-in", pct + "%"));
    ring.title = opened + " מתוך " + total + " הקבוצות האפשריות כבר נפתחו";
    tiles[0].appendChild(ring);
  }
  /* צבע סמנטי לכרטיסים — ירוק למה שנפתח, ענבר למה שאפשר, אדום לחוסר */
  if(tiles.length >= 4){
    tiles[1].classList.add("lab-tzok");
    tiles[2].classList.add("lab-tzcan");
    if(numOf(tiles[3]) > 0) tiles[3].classList.add("lab-tzlow");
  }

  /* --- שורת המצב: מד שממלא את החלק שנפתח --- */
  var st = view.querySelector("#tzStatus");
  if(st && !st.querySelector(".lab-tzbar")){
    var o = numOf(tiles[1]), c = numOf(tiles[2]), t = o + c;
    var bar = el("div", "lab-tzbar"), fill = el("i");
    fill.style.width = (t ? Math.round(o / t * 100) : 0) + "%";
    bar.appendChild(fill);
    st.appendChild(bar);
    st.classList.add("lab-tzstatus");
  }

  /* --- כותרות המקטעים מקבלות את סגנון הרצועה של המעבדה --- */
  ["#tzGroupsBox", "#tzMergeBox", "#tzGansBox"].forEach(function(sel){
    var box = view.querySelector(sel);
    if(!box) return;
    var h = box.querySelector("h3");
    if(h) h.classList.add("lab-tzh");
  });
}
function numOf(tile){
  var v = tile && tile.querySelector(".v");
  return v ? (parseInt(String(v.textContent).replace(/[^\d]/g, ""), 10) || 0) : 0;
}

function maybeHome(){
  if(homeBusy || !view) return;
  /* חלון בחירת הגנים שייך למסך המפה בלבד — יציאה ממנו סוגרת אותו */
  if(mapPickBox && curTab() !== "map"){ try{ mapPickClose(true); }catch(e){} }
  try{ tintBars(); }catch(e){}
  try{ topBar(); }catch(e){}
  try{ screenHeader(); }catch(e){}
  if(!isHome()){
    maybeStudents(); maybeAssign(); maybeGans(); maybeMap(); maybeStaff();
    homeBusy = true;
    try{ reportsScreen(); }catch(e){}
    try{ mgmtScreen(); }catch(e){}
    try{ messagesScreen(); }catch(e){}
    try{ exportScreen(); }catch(e){}
    try{ settingsScreen(); }catch(e){}
    try{ toolsScreen(); }catch(e){}
    try{ templatesScreen(); }catch(e){}
    try{ presenceSkin(); }catch(e){}
    try{ tzScreen(); }catch(e){}
    homeBusy = false;
    return;
  }
  if(view.querySelector(".lab-home")) return;   /* כבר שלנו */
  renderHome();
}

function paint(){
  if(busy) return;
  busy = true;
  try{
    dropTabs();
    bottomBar();
    topBar();
    groupNav();
    relabel();
    var s = (window.__uiLab && window.__uiLab.stats) ? window.__uiLab.stats() : null;
    navCounts(s);
    brandSub(s);
    maybeHome();
    if(foot) userRow(s);
  }catch(e){ /* המעבדה לעולם לא תפיל את התוכנה */ }
  busy = false;
}

function init(){
  nav  = document.getElementById("tabs");
  var modalBox = document.getElementById("modal");
  if(modalBox) new MutationObserver(function(){
    try{ dossierTabs(); }catch(e){}
    /* חלון הייצוא מקבל את אותו עיצוב שקיבלה הלשונית שבוטלה. הזיהוי הוא
       לפי התוכן (#x-out), ולכן כל חלון אחר עובר כאן בלי להיגע. */
    try{ exportScreen(modalBox); }catch(e){}
  }).observe(modalBox, {childList:true});
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
