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

/* החלטה 3, מעודכנת: הקנבס הציג "ייצוא" כפריט ניווט, והמעבדה הזריקה אותו
   לסרגל. זה בוטל — בתוכנה הייצוא יושב *בתוך* המסכים, וכך הוא נשאר: כפתור
   "ייצוא" שבלשונית התלמידות פותח את אותו viewExport כחלון, ו-exportScreen()
   מעצב את החלון הזה בדיוק כפי שעיצב את הלשונית. אותו מסך, בלי פריט מיותר.
   הפונקציה נשארת כדי לנקות סרגל שכבר קיבל את הלשונית ברינדור קודם. */
function dropExportTab(){
  var b = nav.querySelector('[data-tab="export"]');
  if(b) b.remove();
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

/* ===========================================================================
   נייד — סרגל לשוניות תחתון (לוח 16)
   ---------------------------------------------------------------------------
   מוצג רק מתחת ל-900px. המגירה נשארת קיימת ונפתחת מ"עוד", כך ששאר עשר
   הלשוניות נגישות ושום דבר לא נחסם.

   האייקונים הם הגליפים של שאר התוכנה ולא אימוג׳י — בלוח הם צבעוניים, ואצלנו
   כל הניווט מונוכרומי. "עוד" קיבל ⋯ ולא ☰, כי ☰ כבר שייך לתלמידות.
   =========================================================================== */
var BOTTOM = [
  { tab:"home",     icon:"◫", label:"בית" },
  { tab:"students", icon:"☰", label:"תלמידות" },
  { fab:true },
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
      if(it.fab){
        var f = el("button", "lb-fab", "+");
        f.title = "הוספת ילדה";
        f.setAttribute("aria-label", "הוספת ילדה");
        f.onclick = function(){ if(window.__uiLab && window.__uiLab.addStudent) window.__uiLab.addStudent(); };
        bar.appendChild(f);
        return;
      }
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

    /* ⚠️ בלי ההגנה הזו, שדה freeDays חסר זורק — וכל הלוח נעלם בשקט
       (הקריאה עטופה ב-try/catch). */
    var fd = g.freeDays || [];
    if(fd.length){
      row.appendChild(el("div", "la-free", "🏖️ יום חופשי: " +
        fd.map(function(x){ return x.role + " (" + (x.days || []).join(", ") + ")"; }).join(" · ")));
    }
    board.appendChild(row);
  });

  board.appendChild(el("div", "lh-empty",
    d.gans.length + " גנים · הקשר: " + d.contextLabel));

  host.innerHTML = "";
  host.appendChild(board);
  return true;
}

/* בורר ההקשר הוא <select> בקוד. הוא נשאר — ולצידו מוזרקות לשוניות
   שמניעות אותו, כמו בלוח. כך אין אובדן מנגנון. */
function assignTabs(){
  var sel = view.querySelector("#asgCtxSel");
  if(!sel || view.querySelector(".lab-ctx")) return;
  var strip = el("div", "lab-ctx");
  Array.prototype.slice.call(sel.options).forEach(function(o){
    var b = el("button", "lab-ctxb" + (o.selected ? " on" : ""), o.textContent);
    b.onclick = function(){
      sel.value = o.value;
      sel.dispatchEvent(new Event("change", {bubbles:true}));
    };
    strip.appendChild(b);
  });
  var field = sel.closest(".field") || sel.parentNode;
  field.parentNode.insertBefore(strip, field);
  field.style.display = "none";          /* ה-select נשאר בדום ומחווט */
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
  if(st) row.appendChild(kpi({
    label:"זמינים לשיבוץ", value:st.unassigned, tone:"good",
    sub:st.ganenet + " גננות · " + st.sayaat + " סייעות"
  }));
  host.parentNode.insertBefore(row, host);
}

function maybeAssign(){
  if(homeBusy || !view) return;
  var b = nav.querySelector('[data-tab="assign"]');
  if(!(b && b.classList.contains("active"))) return;
  homeBusy = true;
  try{ assignTabs(); assignKpis(); }catch(e){}
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
  c.onclick = function(){
    var b = view.querySelector("#addGan");
    if(b) b.click();
  };
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
var GAN_TOP = ["addGan", "impGan", "exportGans"];
var GAN_REN = { addGan:"+ גן חדש", impGan:"ייבוא", exportGans:"ייצוא" };

function gansTop(){
  var head = view.querySelector(".lab-shead");
  if(!head) return;
  var h2 = head.querySelector("h2");
  if(h2 && h2.textContent.trim() === "רשימת הגנים") h2.textContent = "גנים";

  var acts = head.querySelector(".lab-sacts");
  if(!acts){ acts = el("div", "lab-sacts"); head.appendChild(acts); }
  orderInto(acts, GAN_TOP, GAN_REN);
  var add = acts.querySelector("#addGan");
  if(add) add.classList.remove("ghost");

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
   מפת שיבוץ (לוח 05)
   ---------------------------------------------------------------------------
   בורר הגנים נשאר תיבות סימון בקוד — רק נראה כשבבים. הצבע של כל שבב הוא
   הצבע של אותו גן במפה (ganColor), כך שהשבב, הדגל והנקודה מדברים באותה
   שפה. אין נגיעה בהתנהגות, בסינון או ב-Leaflet.
   =========================================================================== */
function mapChips(){
  var box = view.querySelector("#map-gan-list");
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
  view.querySelectorAll("#map-gan-list input[data-gid]").forEach(function(inp){
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
  try{ mapChips(); mapLegend(); }catch(e){}
  homeBusy = false;
}

/* ===========================================================================
   צוות הגנים (לוח 04)
   ---------------------------------------------------------------------------
   שורת KPI מעל הטבלה, ראשי תיבות בשורות, והתפקיד כתגית. הטבלה, החיפוש
   והסינון נשארים של התוכנה.
   =========================================================================== */
function staffKpis(){
  var host = view.querySelector("#staffTable");
  if(!host || view.querySelector(".lab-stkpis")) return;
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
  row.appendChild(kpi({ label:"ללא תעודה", value:d.noCert, tone:d.noCert ? "bad" : "good",
    sub:d.total ? Math.round(d.noCert / d.total * 100) + "% מהמאגר" : "" }));
  host.parentNode.insertBefore(row, host);
}

function staffRows(){
  /* ראשי תיבות בתא שם המשפחה, ותגית לתפקיד — כמו בלוח */
  view.querySelectorAll("#staffTable tbody tr").forEach(function(tr){
    var tds = tr.children;
    if(tds.length < 3) return;
    var nameCell = tds[0], roleCell = tds[2];
    if(!nameCell.querySelector(".lab-ini")){
      var last = (nameCell.textContent || "").trim();
      var first = (tds[1].textContent || "").trim();
      var ini = initialsFrom((last + " " + first).trim());
      if(ini){
        var sp = el("span", "lab-ini", ini);
        nameCell.insertBefore(sp, nameCell.firstChild);
        nameCell.classList.add("lab-namecell");
      }
    }
    if(roleCell && !roleCell.querySelector(".lab-role")){
      var t = (roleCell.textContent || "").trim();
      if(t && t !== "—"){
        roleCell.textContent = "";
        roleCell.appendChild(el("span", "lab-role", t));
      }
    }
  });
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
  if(!(b && b.classList.contains("active"))) return;
  homeBusy = true;
  try{
    staffKpis(); staffRows();
    var sb = (window.__uiLab && window.__uiLab.staffBoard) ? window.__uiLab.staffBoard() : null;
    if(sb) matchLine("#staffTable", "אנשי צוות", sb.total);
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
     בהם פאנלים משלה (עירייה, הנהלה) אסור לגנוב את ה-h2 של הפאנל הראשון:
     הוא כותרת של מקטע, לא של המסך — והפאנל היה נשאר בלי כותרת. שם המסך
     נלקח אז מהניווט, וכל הפאנלים נשארים שלמים. */
  var OWN = { reports:"דוחות ואחוזים", municipality:"קליטה בעירייה",
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
  if(sub) lft.appendChild(el("div", "lab-ssub", sub));

  var anchor = st || h2 || panel;
  anchor.parentNode.insertBefore(head, anchor);
  if(ownTitle){
    lft.appendChild(el("h2", null, ownTitle));   /* ה-h2 של הפאנל נשאר במקומו */
    st = null;
  }else{
    lft.appendChild(h2);                         /* העברה — המאזינים נשמרים */
  }
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
   המסכים שנותרו — דוחות, עירייה, הודעות, ייצוא, הגדרות, כלים, הנהלה
   ---------------------------------------------------------------------------
   כל אחד מהם מקבל את המבנה של הלוח בלי לפרק את המסך הקיים: מזריקים את
   הבלוקים שהלוח מציג ואינם בתוכנה, ומזיזים (לא בונים מחדש) את מה שכבר קיים.
   =========================================================================== */
/* ===========================================================================
   הכותרת העליונה — פס כהה שמתחבר לסרגל לקו אחד
   ---------------------------------------------------------------------------
   בכל לוח יש רצועה כהה לרוחב המסך שנמשכת מהסרגל הימני בלי תפר. קודם הכותרת
   רוקנה והפכה שקופה, ואז נוצר "מדרגה" בין הסרגל הכהה לתוכן הבהיר.

   ⚠️ בורר השנה: המעבדה הסתירה את מקטע השנה במגירה, ובכך הפכה את בחירת
   השנה לבלתי אפשרית. ה-<select> המקורי *מועבר* לכאן — אותו אלמנט, אותו
   מאזין change — כך שהמנגנון נשמר והשנה שוב ניתנת לבחירה.
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

  var chips = inner.querySelector(".top-chips");
  if(chips && !chips.querySelector("#yearSelect")){
    var sel = document.getElementById("yearSelect");
    if(sel){
      var chip = el("label", "lab-yearpick");
      chip.appendChild(el("span", "lab-ycal", "▤"));
      chip.appendChild(sel);            /* העברה — המאזין נשמר */
      chips.insertBefore(chip, chips.firstChild);
    }
  }
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

/* --------------------------------------------------------------- עירייה */
function muniScreen(){
  if(curTab() !== "municipality" || hasLab("muni")) return;
  var d = window.__uiLab && window.__uiLab.muniBoard && window.__uiLab.muniBoard();
  if(!d) return;
  var first = view.querySelector(".panel");
  if(!first) return;

  var frag = document.createDocumentFragment();
  frag.appendChild(kpiRow([
    { label:"נקלטו", value:String(d.absorbed), dark:true,
      sub:d.pct + "% מהתיקים · " + d.year, ring:d.pct },
    { label:"ממתינות לקליטה", value:String(d.pending), tone:"warn",
      sub:"מתוך " + d.total + " תיקים" },
    { label:"מוכנות לשליחה", value:String(d.counts.ready), tone:"good",
      sub:'ת"ז, שיבוץ ומסמכים תקינים' },
    { label:"חסומות", value:String(d.counts.tz + d.counts.gan + d.counts.docs),
      tone:"bad",
      sub:d.counts.tz + ' ללא ת"ז · ' + d.counts.gan + " ללא שיבוץ · " + d.counts.docs + " מסמכים" }
  ]));

  var two = el("div", "lab-2col aside");
  var pc = labPanel("muni", "לפי עיר", "נקלטו מתוך רשומות");
  if(!d.byCity.length) pc.appendChild(el("div", "lab-empty", "אין נתוני עיר בתיקים."));
  d.byCity.forEach(function(c){
    var pct = c.n ? Math.round(c.ok / c.n * 100) : 0;
    pc.appendChild(barRow(c.city, c.ok + "/" + c.n, pct, toneOf(pct)));
  });
  if(d.listed) pc.appendChild(el("div", "lab-note",
    d.listed + ' ת"ז ברשימת העירייה שנטענה לשנת ' + d.year));
  var pp = labPanel("muniList", d.rowsTotal + " תיקים ממתינים",
    d.rowsTotal > d.rows.length ? "מוצגים " + d.rows.length + " הראשונים" : "לפי א״ב");
  if(!d.rows.length) pp.appendChild(el("div", "lab-empty", "כל התיקים נקלטו בעירייה. 🎉"));
  else{
    var wrap = el("div", "table-wrap"), t = el("table"), th = el("thead"), tr = el("tr");
    ["תלמידה", 'ת"ז', "גן", "עיר", "מה חוסם"].forEach(function(h){ tr.appendChild(el("th", null, h)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el("tbody");
    d.rows.forEach(function(r){
      var x = el("tr");
      x.appendChild(el("td", null, r.name || "—"));
      var tz = el("td", "lab-num", r.tz || "—"); x.appendChild(tz);
      x.appendChild(el("td", null, r.gan || "—"));
      x.appendChild(el("td", null, r.city || "—"));
      var c = el("td");
      c.appendChild(el("span", "lab-tag " + r.tone, r.reason));
      x.appendChild(c);
      tb.appendChild(x);
    });
    t.appendChild(tb); wrap.appendChild(t); pp.appendChild(wrap);
  }
  two.appendChild(pp);      /* ימין */
  two.appendChild(pc);      /* שמאל — כמו בלוח */
  frag.appendChild(two);
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
/* הלוח מוסיף רשימת ניווט קבועה בצד ימין עם כותרות קבוצה. הקבוצות נגזרות
   מכותרות הפאנלים הקיימות — שום פאנל לא זז ולא נעלם. */
var SET_GROUPS = [
  ["שנים ותכנים", ["שנים", "מעבר שנה", "נתונים היסטוריים", "רף שיבוץ", "מינימום לפתיחת צהרון"]],
  ["רשימות המערכת", ["גילי הילדים", "תפקידי צוות", "קמפוסים"]],
  ["מערכת והרשאות", ["מי מחובר", "יומן פעילות", "מנהלי מערכת", "ניהול משתמשים", "חשבון והתחברות"]],
  ["מראה והתקנה", ["מיתוג", "התקנה כאפליקציה", "פניות והצעות"]]
];
function settingsScreen(){
  if(curTab() !== "settings" || view.querySelector(".lab-toc")) return;
  var panels = Array.prototype.slice.call(view.querySelectorAll(":scope > .panel"));
  if(panels.length < 4) return;

  var items = [];
  panels.forEach(function(p, i){
    var h = p.querySelector("h2");
    if(!h) return;
    /* רק צמתי הטקסט של ה-h2 — בלי תגיות מונה כמו "3 מחוברים" שבתוכו */
    var t = "";
    Array.prototype.slice.call(h.childNodes).forEach(function(n){
      if(n.nodeType === 3) t += n.nodeValue;
    });
    t = t.replace(/[…\s]+$/, "").trim() || String(h.textContent || "").trim();
    if(!t) return;
    if(!p.id) p.id = "labsec" + i;
    items.push({ id:p.id, title:t, el:p });
  });
  if(!items.length) return;

  var toc = el("nav", "lab-toc");
  var used = {};
  SET_GROUPS.forEach(function(grp){
    var picked = items.filter(function(it){
      if(used[it.id]) return false;
      return grp[1].some(function(k){ return it.title.indexOf(k) >= 0; });
    });
    if(!picked.length) return;
    toc.appendChild(el("div", "lab-tocg", grp[0]));
    picked.forEach(function(it){
      used[it.id] = 1;
      var a = el("a", "lab-toci", it.title);
      a.href = "#" + it.id;
      toc.appendChild(a);
    });
  });
  var rest = items.filter(function(it){ return !used[it.id]; });
  if(rest.length){
    toc.appendChild(el("div", "lab-tocg", "נוספים"));
    rest.forEach(function(it){
      var a = el("a", "lab-toci", it.title);
      a.href = "#" + it.id;
      toc.appendChild(a);
    });
  }

  /* עוטפים: רשימת הניווט מימין, הפאנלים משמאל */
  var wrap = el("div", "lab-setwrap");
  var col  = el("div", "lab-setcol");
  view.insertBefore(wrap, panels[0]);
  wrap.appendChild(col); wrap.appendChild(toc);
  /* סדר הפאנלים עוקב אחרי סדר הרשימה, כך שגלילה ורשימה מספרות אותו סיפור */
  var order = [];
  toc.querySelectorAll(".lab-toci").forEach(function(a){
    var t = view.querySelector(a.getAttribute("href"));
    if(t) order.push(t);
  });
  order.forEach(function(p){ col.appendChild(p); });
  panels.forEach(function(p){ if(p.parentNode !== col) col.appendChild(p); });

  /* סימון הפריט הפעיל בגלילה */
  var links = toc.querySelectorAll(".lab-toci");
  var spy = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return;
      links.forEach(function(a){
        a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id);
      });
    });
  }, {rootMargin:"-10% 0px -80% 0px"});
  items.forEach(function(it){ spy.observe(it.el); });
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
var STU_TOP  = ["addStu", "exportStu", "importStu", "importUpdate"];   /* הסדר בלוח */
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
  orderInto(acts, STU_TOP, { addStu:"+ הוספת ילדה", exportStu:"ייצוא",
                            importStu:"ייבוא", importUpdate:'עדכון לפי ת״ז' });
  /* התווית "ייבוא / יצוא:" והמפריד נשארו יתומים אחרי שהכפתורים עלו */
  var row = view.querySelector(".panel > .row");
  if(row) Array.prototype.slice.call(row.children).forEach(function(c){
    if(!c.classList.contains("btn")) c.classList.add("lab-hidden");
  });
  var add = acts.querySelector("#addStu");
  if(add) add.classList.remove("ghost");
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

/* הפס התחתון (הצילום שצורף): "עדכון קבוצתי" יושב בפס הכהה שבתחתית
   המסך, יחד עם פעולות הבחירה, והפס נשאר גלוי בגלילה.

   ⚠️ renderSelBar עושה innerHTML="" ל-#stuSelBar בכל רינדור. אילו
   #bulkToggle היה יושב בתוכו הוא היה נמחק — ואז אי אפשר בכלל להיכנס
   למצב הבחירה. לכן נבנית עטיפה: פס התוכנה נשאר שלם בתוכה, והכפתור
   יושב לצידו כאח, מחוץ להישג ידו של ה-innerHTML. */
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
    line.appendChild(el("div", "lab-botbar"));   /* מתג המצב — באותה שורה */
    wrap.appendChild(line);
    wrap.appendChild(host);
  }
  var bb = wrap.querySelector(".lab-botbar");
  var bulk = view.querySelector("#bulkToggle");
  if(bulk && bulk.parentNode !== bb){
    bulk.classList.add("lab-bulkbtn");
    bulk.classList.remove("ghost");
    bb.appendChild(bulk);                   /* העברה — המאזין נשמר */
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
  if(bulk){
    var t = bulk.textContent.indexOf("סיום") >= 0 ? "✕ סיום" : "✔ עדכון קבוצתי";
    if(bulk.textContent !== t) bulk.textContent = t;
  }
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

/* "+" בכותרת הטבלה לעמודות הנוספות — במקום הכפתור עם הטקסט */
function colPlus(){
  var b = view.querySelector("#stuColsBtn");
  if(!b) return;
  var open = String(b.textContent || "").indexOf("הסתרת") >= 0;
  b.title = open ? "הסתרת העמודות הנוספות" : "עמודות נוספות · מסמכים, עירייה, סימונים, סטטוס, מועד, חינוך, גיל";
  b.setAttribute("aria-label", b.title);
  var glyph = open ? "−" : "+";
  if(b.textContent !== glyph) b.textContent = glyph;
  b.classList.add("lab-colplus");
  /* הכפתור יושב בכותרת הטבלה, בקצה שמאל — לא בשורה נפרדת מעליה */
  var head = view.querySelector(".stu-table thead tr");
  if(head){
    var th = head.lastElementChild;
    if(th && b.parentNode !== th){ th.appendChild(b); th.classList.add("lab-colplus-cell"); }
  }
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

function maybeHome(){
  if(homeBusy || !view) return;
  try{ tintBars(); }catch(e){}
  try{ topBar(); }catch(e){}
  try{ screenHeader(); }catch(e){}
  if(!isHome()){
    maybeStudents(); maybeAssign(); maybeGans(); maybeMap(); maybeStaff();
    homeBusy = true;
    try{ reportsScreen(); }catch(e){}
    try{ muniScreen(); }catch(e){}
    try{ mgmtScreen(); }catch(e){}
    try{ messagesScreen(); }catch(e){}
    try{ exportScreen(); }catch(e){}
    try{ settingsScreen(); }catch(e){}
    try{ toolsScreen(); }catch(e){}
    try{ templatesScreen(); }catch(e){}
    try{ presenceSkin(); }catch(e){}
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
    dropExportTab();
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
