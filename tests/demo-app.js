/* ============================================================================
   demo-app.js — הנתונים והמסכים של גרסת הדמו
   ----------------------------------------------------------------------------
   הקובץ הזה מוזרק ל-demo.html על ידי tests/build-demo.cjs.
   הכול כאן מומצא: 29 גנים, 412 תלמידות ו-58 אנשי צוות, מיוצרים מזרע קבוע
   כדי שאותם מספרים יחזרו בכל טעינה ויהיו עקביים בין המסכים.
   אין רשת, אין אחסון ואין כתיבה לשום מקום — לחיצה על פעולה מציגה הודעה בלבד.
   ============================================================================ */
(function(){
"use strict";

var AGE_HUE = /*__AGE_HUE__*/null;
var TABS    = /*__TABS__*/null;

/* ---------------------------------------------------------------- אקראי קבוע */
var _s = 20260825;
function rnd(){ _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; }
function pick(a){ return a[Math.floor(rnd() * a.length)]; }
function iRnd(a, b){ return a + Math.floor(rnd() * (b - a + 1)); }

/* ------------------------------------------------------------- שמות לדוגמה */
var LAST = ["אברמוביץ׳","גולדשטיין","וייס","כהן","פרידמן","לוינגר","ברקוביץ׳","רוזנברג",
  "שטרן","הירש","פישר","גרוס","קליין","לנדא","זילברשטיין","נוימן","אדלר","שוורץ",
  "בלוי","טננבוים","הלוי","מרגלית","שפירא","דרייפוס","ולדמן"];
var GIRL = ["חנה'לה","מירי","שרה","רבקה","אסתי","ברכה","מלכי","חיה","דבורה","רחל",
  "לאה","מרים","טובה","פייגי","שיינדל","גיטי","נחמי","בתיה","יוכי","עדינה"];
var WOMAN = ["שרה","מלכה","רויזי","פייגי","נחמה","אסתי","חני","מירי","דבורה","רחל",
  "טובה","ברכה","שיינדל","יוכי","חיה","גיטי","לאה","בתיה","עדינה","פנינה"];
var CITY = [["ירושלים",52],["בית שמש",21],["מודיעין עילית",16],["ביתר עילית",8],["אחר",3]];
var STREET = ["הרב סורוצקין","נחל לכיש","רשב״ם","חזון איש","אבני נזר","ר׳ עקיבא","הרב שך"];
var CAMPUS = ["קמפוס צפון","קמפוס מרכז","קמפוס דרום"];
var GANNAME = ["רימון","תפוח","דובדבן","שקד","זית","גפן","אגוז","אלון","תמר","הדס",
  "ערבה","אתרוג","דקל","ברוש","אורן","לוטם","כלנית","רקפת","נרקיס","סחלב",
  "יסמין","דפנה","מרווה","זעתר","אזוב","לבנדר","ורד","חבצלת","סביון"];
var PERIODS = ["א׳","ב׳","ג׳","סופי"];
var DOCS = [["form","נספח"],["id","צילום ת״ז"],["rules","תקנון"]];
var ROLES = ["גננת","סייעת","סייעת ב׳","סייעת רפואית","סייעת צמודה","גננת משלימה"];

function ini(name){
  var w = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (w[0] ? w[0][0] : "") + (w[1] ? w[1][0] : "");
}
function ageInk(age){
  var a = (String(age).match(/\d+/) || [])[0];
  return (a && AGE_HUE[a]) || "";
}

/* ----------------------------------------------------------------- הגנים */
var GANS = GANNAME.map(function(nm, i){
  var age = ["3","4","5","3/4"][i % 4 === 3 ? 3 : i % 3];
  var special = (i === 6 || i === 19);
  var cap = special ? 14 : (age === "5" ? 32 : age === "3" ? 30 : 32);
  return {
    id: "g" + i,
    name: "גן " + nm,
    symbol: String(4402 + i * 3),
    age: age,
    edu: special ? 'ח״מ' : "רגיל",
    campus: CAMPUS[i % 3],
    cap: cap,
    used: Math.min(cap, Math.max(6, cap - iRnd(0, 6))),
    teacher: (i === 5 || i === 17) ? "" : (pick(WOMAN) + " " + pick(LAST)),
    phone: "05" + iRnd(2, 4) + "-" + iRnd(1000000, 9999999),
    ink: ageInk(age)
  };
});

/* ------------------------------------------------------------- התלמידות */
var STUDENTS = [];
(function(){
  var cityBag = [];
  CITY.forEach(function(c){ for(var i = 0; i < c[1]; i++) cityBag.push(c[0]); });
  for(var i = 0; i < 412; i++){
    var g = GANS[i % GANS.length];
    var placed = rnd() > 0.13;
    var hasGan = rnd() > 0.05;
    var docs = {};
    DOCS.forEach(function(d, k){ docs[d[0]] = rnd() > (k === 2 ? 0.55 : 0.14); });
    STUDENTS.push({
      id: "s" + i,
      last: pick(LAST), first: pick(GIRL),
      tz: String(iRnd(320000000, 339999999)),
      ganId: hasGan ? g.id : "",
      placed: hasGan && placed,
      age: g.age === "3/4" ? "4" : g.age,
      period: pick(PERIODS),
      city: pick(cityBag),
      street: pick(STREET) + " " + iRnd(1, 60),
      muni: rnd() > 0.18,
      mother: pick(WOMAN) + " " + pick(LAST),
      mobile: "05" + iRnd(2, 4) + "-" + iRnd(1000000, 9999999),
      docs: docs
    });
  }
})();
function fullName(s){ return s.last + " " + s.first; }
function ganById(id){ for(var i = 0; i < GANS.length; i++) if(GANS[i].id === id) return GANS[i]; return null; }
function ganName(id){ var g = ganById(id); return g ? g.name : ""; }
function docsDone(s){ var n = 0; DOCS.forEach(function(d){ if(s.docs[d[0]]) n++; }); return n; }

/* --------------------------------------------------------------- הצוות */
var STAFF = [];
(function(){
  for(var i = 0; i < 58; i++){
    var role = i < 31 ? "גננת" : (i < 52 ? pick(["סייעת","סייעת","סייעת","סייעת רפואית","סייעת צמודה"]) : pick(ROLES));
    var g = rnd() > 0.12 ? GANS[i % GANS.length] : null;
    STAFF.push({
      id: "m" + i, last: pick(LAST), first: pick(WOMAN),
      tz: String(iRnd(30000000, 49999999)),
      role: role,
      edu: (g && g.edu) || "רגיל",
      ganId: g ? g.id : "",
      seniority: iRnd(1, 16),
      mobile: "05" + iRnd(2, 4) + "-" + iRnd(1000000, 9999999),
      cert: rnd() > 0.16,
      active: true
    });
  }
})();

/* ------------------------------------------------------------- מצטברים */
function totals(){
  var placed = 0, muni = 0, allDocs = 0, cap = 0, used = 0;
  STUDENTS.forEach(function(s){
    if(s.ganId && s.placed) placed++;
    if(s.muni) muni++;
    if(docsDone(s) === DOCS.length) allDocs++;
  });
  GANS.forEach(function(g){ cap += g.cap; used += g.used; });
  return { total: STUDENTS.length, placed: placed, waiting: STUDENTS.length - placed,
           muni: muni, notMuni: STUDENTS.length - muni, allDocs: allDocs,
           cap: cap, used: used, gans: GANS.length,
           noTeacher: GANS.filter(function(g){ return !g.teacher; }).length };
}
var T = totals();
var YEAR = "תשפ״ח", PREV = "תשפ״ז";

/* =========================================================================
   בניית DOM
   ========================================================================= */
function h(tag, attrs, kids){
  var e = document.createElement(tag);
  if(attrs) for(var k in attrs){
    if(k === "class") e.className = attrs[k];
    else if(k === "text") e.textContent = attrs[k];
    else if(k === "html") e.innerHTML = attrs[k];
    else if(k === "style") e.setAttribute("style", attrs[k]);
    else if(k.indexOf("on") === 0) e[k] = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  (kids || []).forEach(function(c){ if(c) e.appendChild(c); });
  return e;
}
function txt(tag, cls, t){ return h(tag, { "class": cls || null, text: t }); }

function toast(msg){
  var t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ t.classList.remove("show"); }, 2600);
}
function demoAction(what){
  return function(e){
    if(e) e.preventDefault();
    toast("דמו — " + what + " אינה פעילה כאן. שום נתון לא נשמר.");
  };
}
function btn(label, cls){
  var b = h("button", { "class": "btn" + (cls ? " " + cls : ""), text: label });
  b.onclick = demoAction(label.replace(/^[^֐-׿\w]+/, "").trim());
  return b;
}
function table(cols, rows, cls){
  var wrap = h("div", { "class": "table-wrap" });
  var t = h("table", cls ? { "class": cls } : null), th = h("thead"), tr = h("tr");
  cols.forEach(function(c){ tr.appendChild(txt("th", null, c)); });
  th.appendChild(tr); t.appendChild(th);
  var tb = h("tbody");
  rows.forEach(function(r){
    var x = h("tr");
    r.forEach(function(c){ x.appendChild(c instanceof Node ? h("td", null, [c]) : txt("td", null, String(c))); });
    tb.appendChild(x);
  });
  t.appendChild(tb); wrap.appendChild(t);
  return wrap;
}
function searchbar(ph){
  var f = h("div", { "class": "search-field" }, [
    txt("span", "mag", "🔎"),
    h("input", { placeholder: ph })
  ]);
  var tg = h("button", { "class": "filter-toggle", type: "button", html: "☰ סינון" });
  tg.onclick = demoAction("פתיחת הסינון");
  return h("div", { "class": "searchbar" }, [f, tg]);
}
/* labels: [טקסט, id] — המזהים חייבים להיות של התוכנה האמיתית, אחרת
   הדמו אינו מפעיל את קוד המעבדה שתלוי בהם. */
function toolbar(labels){
  var r = h("div", { "class": "toolbar" });
  labels.forEach(function(l, i){
    var b = btn(Array.isArray(l) ? l[0] : l, i ? "ghost" : "");
    if(Array.isArray(l) && l[1]) b.id = l[1];
    r.appendChild(b);
  });
  return r;
}
function statRow(items){
  var s = h("div", { "class": "stats" });
  items.forEach(function(it){
    s.appendChild(h("div", { "class": "stat" + (it.hero ? " hero" : "") }, [
      txt("div", "k", it.k),
      h("div", { "class": "v", style: it.color ? "color:var(--" + it.color + ")" : null, text: String(it.v) })
    ]));
  });
  return s;
}

/* =========================================================================
   המסכים
   ========================================================================= */
var VIEW = {};

VIEW.home = function(v){
  /* מסך הבית נבנה כולו על ידי ui-lab.js מתוך __uiLab.home() */
  v.appendChild(h("div", { "class": "panel" }, [ txt("h2", null, "עמוד הבית") ]));
};

VIEW.students = function(v){
  var sum = h("div", { id: "stuSummary", "class": "sticky" }, [ statRow([
    { k: "רשומות", v: T.total, hero: true },
    { k: "משובצות", v: T.placed, color: "good" },
    { k: "ממתינות לשיבוץ", v: T.waiting, color: "warn" },
    { k: "קלוט בעירייה", v: T.muni },
    { k: "לא קלוט", v: T.notMuni, color: "bad" }
  ]) ]);

  var rows = STUDENTS.slice(0, 60).map(function(s){
    var g = ganById(s.ganId);
    var d = docsDone(s);
    var chips = h("span", { "class": "docchips" });
    DOCS.forEach(function(x){
      chips.appendChild(h("span", { "class": "docchip" + (s.docs[x[0]] ? " on" : ""), text: x[1].slice(0, 2) }));
    });
    return [
      h("div", { "class": "nm", text: fullName(s) }),
      h("span", { "class": "tzcell", text: s.tz }),
      g ? g.name + " · " + g.age : "—",
      h("span", { "class": "chip edu " + (s.placed ? "reg" : "spec"), text: s.placed ? "✔ משובצת" : "⏳ ממתינה" }),
      s.age, s.city, chips,
      h("span", { "class": "pill " + (s.muni ? "ok" : "no"), text: s.muni ? "קלוט" : "לא קלוט" })
    ];
  });

  var colsBar = h("div", { "class": "row", style: "margin-bottom:8px" }, [
    h("button", { "class": "btn ghost sm", id: "stuColsBtn", type: "button",
      text: "➕ עמודות נוספות", onclick: demoAction("עמודות נוספות") })
  ]);

  var stage = h("div", { "class": "stu-stage" }, [
    h("div", { id: "stuTable", style: "flex:1 1 0;min-width:0" }, [
      table(["שם מלא", "ת״ז", "גן", "שיבוץ", "גיל", "עיר", "מסמכים", "עירייה"], rows, "stu-table")
    ]),
    h("aside", { id: "stuQuick", "class": "stu-quick empty-state" })
  ]);

  v.appendChild(h("div", { "class": "panel" }, [
    h("div", { "class": "section-title" }, [ txt("h2", null, "תיקי התלמידות") ]),
    sum,
    toolbar([["➕ הוספת ילדה", "addStu"], ["✔️ עדכון קבוצתי", "bulkToggle"],
             ["📣 שליחת הודעות", "stuMsg"], ["📤 יצוא", "exportStu"],
             ["⬆️ ייבוא מקובץ", "importStu"], ["✏️ עדכון לפי ת\u05F4ז", "importUpdate"]]),
    searchbar("חיפוש שם או ת״ז…"),
    colsBar,
    h("div", { "class": "filter-panel", id: "stuFilterPanel", hidden: "" }, [
      h("div", { "class": "toolbar", style: "margin-bottom:0" }, [
        h("div", { "class": "field" }, [ txt("label", null, "גן (אפשר לבחור כמה)"),
          h("details", { "class": "msel", id: "f-gan" }, [
            h("summary", { text: "כל הגנים" }),
            h("div", { "class": "msel-menu", html:
              GANS.map(function(g){ return '<label class="msel-opt"><input type="checkbox"> ' + g.name + '</label>'; }).join("") })
          ]) ]),
        h("div", { "class": "field" }, [ txt("label", null, "גיל (אפשר לבחור כמה)"),
          h("div", { "class": "row", id: "f-age", style: "gap:4px;flex-wrap:wrap", html:
            ["2","3","4","5"].map(function(a){ return '<button type="button" class="btn sm ghost">' + a + '</button>'; }).join("") }) ]),
        h("div", { "class": "field" }, [ txt("label", null, "עיר"),
          h("select", { id: "f-city", html: "<option value=''>הכל</option>" + CITY.map(function(c){ return "<option>" + c[0] + "</option>"; }).join("") }) ]),
        h("div", { "class": "field" }, [ txt("label", null, "מועד"),
          h("select", { id: "f-period", html: "<option value=''>הכל</option>" + PERIODS.map(function(p){ return "<option>" + p + "</option>"; }).join("") }) ]),
        h("div", { "class": "field" }, [ txt("label", null, "מאפיין"),
          h("select", { id: "f-flag", html: "<option value=''>הכל</option><option>נשארות</option><option>צהרון</option><option>קייטנה</option>" }) ]),
        h("div", { "class": "field" }, [ txt("label", null, "סטטוס"),
          h("select", { id: "f-status", html: "<option>פעילות</option><option>שסיימו / יצאו</option><option>הכל</option>" }) ])
      ])
    ]),
    h("div", { id: "stuChips", "class": "fchips", html:
      '<span style="font-size:.78rem;color:var(--muted);font-weight:700">סינון:</span>' +
      '<span class="fchip">גיל 3–4<button type="button">✕</button></span>' +
      '<span class="fchip">לא קלוט בעירייה<button type="button">✕</button></span>' +
      '<button type="button" class="clr">נקה הכל</button>' }),
    stage,
    h("div", { id: "stuSelBar" })
  ]));
};

VIEW.gans = function(v){
  v.appendChild(h("div", { "class": "panel" }, [
    h("div", { "class": "section-title" }, [ txt("h2", null, "רשימת הגנים") ]),
    searchbar("חיפוש גן, גננת או כתובת…"),
    /* פאנל הסינון של התוכנה — הבוררים עוברים לשבבים והוא נשאר מוסתר */
    h("div", { "class": "filter-panel", id: "ganFilterPanel", hidden: "" }, [
      h("div", { "class": "toolbar", style: "margin-bottom:0" }, [
        h("div", { "class": "field" }, [txt("label", null, "גיל"),
          h("select", { id: "fg-age", html: "<option value=''>הכל</option><option>3</option><option>3/4</option><option>4</option><option>5</option>" })]),
        h("div", { "class": "field" }, [txt("label", null, "תפוסה"),
          h("select", { id: "fg-full", html: "<option value=''>הכל</option><option value='yes'>מלאה</option><option value='no'>לא מלאה</option>" })]),
        h("div", { "class": "field" }, [txt("label", null, "קמפוס"),
          h("select", { id: "fg-campus", html: "<option value=''>הכל</option>" + CAMPUS.map(function(c){ return "<option>" + c + "</option>"; }).join("") })]),
        h("div", { "class": "field" }, [txt("label", null, "אזור"),
          h("select", { id: "fg-zone", html: "<option value=''>הכל</option><option>צפון</option><option>מרכז</option><option>דרום</option>" })]),
        h("div", { "class": "field" }, [txt("label", null, "סטטוס"),
          h("select", { id: "fg-status", html: "<option value=''>הכל</option><option value='active'>פעיל</option><option value='off'>כבוי</option>" })])
      ])
    ]),
    toolbar([["➕ הוספת גן", "addGan"], ["⬆️ ייבוא מקובץ", "impGan"],
             ["📤 ייצוא / הדפסה", "exportGans"]]),
    h("div", { id: "ganTable" }, [
      table(["שם הגן", "סמל", "גיל", "חינוך", "קמפוס", "גננת", "תפוסה"],
        GANS.map(function(g){
          return [g.name, g.symbol, g.age, g.edu, g.campus,
                  g.teacher || h("span", { style: "color:var(--bad)", text: "ללא גננת" }),
                  h("span", { style: "direction:ltr;unicode-bidi:isolate", text: g.used + "/" + g.cap })];
        }))
    ])
  ]));
};

VIEW.staff = function(v){
  v.appendChild(h("div", { "class": "panel" }, [
    h("div", { "class": "section-title" }, [ txt("h2", null, "רשימת צוות הגנים") ]),
    searchbar("חיפוש שם, ת״ז, טלפון או עיר…"),
    toolbar([["➕ הוספת איש/אשת צוות", "addStaff"], ["📣 שליחת הודעות", "staffMsg"],
             ["⬆️ ייבוא מקובץ", "impStaff"]]),
    h("div", { id: "staffTable" }, [
      table(["איש/אשת צוות", "תפקיד", "משובצת ב־", "ותק", "נייד", "תעודה"],
        STAFF.map(function(m){
          return [
            h("div", null, [ h("b", { text: m.last + " " + m.first }),
                             h("div", { "class": "hint", style: "direction:ltr;unicode-bidi:isolate", text: m.tz }) ]),
            h("span", { "class": "chip edu reg", text: m.role }),
            m.ganId ? ganName(m.ganId) : "—",
            m.seniority + " שנים",
            h("span", { style: "direction:ltr;unicode-bidi:isolate", text: m.mobile }),
            h("span", { "class": "pill " + (m.cert ? "ok" : "no"), text: m.cert ? "יש" : "חסרה" })
          ];
        }))
    ])
  ]));
};

VIEW.map = function(v){
  var list = h("div", { id: "map-gan-list", style: "max-height:190px;overflow:auto;padding:9px;border:1px solid var(--border);border-radius:12px" });
  CAMPUS.forEach(function(c){
    var box = h("div", { style: "border-top:1px dashed var(--border);padding:7px 0;margin-top:5px" });
    box.appendChild(h("label", { "class": "check", html:
      '<input type="checkbox" data-camp="' + c + '" checked> 🏫 ' + c }));
    var inner = h("div", { style: "display:flex;flex-wrap:wrap;gap:5px 14px;margin-top:6px;padding-inline-start:18px" });
    GANS.filter(function(g){ return g.campus === c; }).forEach(function(g, i){
      inner.appendChild(h("label", { "class": "check", html:
        '<input type="checkbox" data-gid="' + g.id + '"' + (i < 3 ? " checked" : "") + '> ' + g.name }));
    });
    box.appendChild(inner); list.appendChild(box);
  });

  /* שלושת הבוררים שמעל המפה, כמו בתוכנה ובלוח */
  var opts = h("div", { "class": "row", style: "gap:10px;flex-wrap:wrap;margin-top:10px;align-items:end" }, [
    h("div", { "class": "field" }, [ txt("label", null, "עיר"),
      h("select", { html: "<option>מודיעין עילית</option><option>ירושלים</option><option>בית שמש</option>" }) ]),
    h("div", { "class": "field" }, [ txt("label", null, "חינוך"),
      h("select", { html: "<option>הכל</option><option>רגיל</option><option>ח״מ</option>" }) ]),
    h("div", { "class": "field" }, [ txt("label", null, "צבע התלמידות"),
      h("select", { html: "<option>לפי גן</option><option>לפי מרחק</option><option>לפי סטטוס</option>" }) ]),
    h("label", { "class": "check", html:
      '<input type="checkbox"> כל התלמידות (גם שאינן רשומות לגנים שנבחרו)' })
  ]);

  var stage = h("div", { id: "map-stage",
    style: "height:430px;border-radius:16px;display:flex;align-items:center;justify-content:center;" +
           "text-align:center;background:var(--surface-2);border:1px solid var(--border)" },
    [ h("div", { "class": "hint", html:
        "🗺️ המפה החיה (Leaflet + כתובות אמיתיות) אינה נטענת בדמו.<br>" +
        "במערכת מוצגים כאן כל הגנים והתלמידות על מפה, עם שיבוץ אוטומטי לפי קרבה." }) ]);

  /* הפאנל "רשומות לגנים שנבחרו" — בלוח הוא לצד המפה */
  var side = h("div", { "class": "panel", style: "margin:0" });
  side.appendChild(txt("h3", null, "רשומות לגנים שנבחרו"));
  side.appendChild(txt("div", "sub", "לחיצה על שם ממקדת על המפה"));
  GANS.slice(0, 3).forEach(function(g){
    var rows = STUDENTS.filter(function(s){ return s.ganId === g.id; }).slice(0, 2);
    side.appendChild(h("div", { style: "margin-top:12px;font-weight:700;font-size:.86rem" },
      [ document.createTextNode(g.name + " · " + g.used) ]));
    rows.forEach(function(s){
      side.appendChild(h("div", { style: "display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--lab-rule-row)" }, [
        h("span", { style: "width:9px;height:9px;border-radius:50%;background:" + (g.ink || "#2c6a4c") }),
        h("div", null, [
          h("div", { style: "font-weight:600;font-size:.85rem", text: fullName(s) }),
          h("div", { "class": "hint", text: s.street + " · " + iRnd(120, 800) + " מ׳" })
        ])
      ]));
    });
  });

  var two = h("div", { style: "display:grid;gap:14px;grid-template-columns:1fr 300px;align-items:start;margin-top:14px" },
    [ stage, side ]);

  /* תצוגה מקדימה של השיבוץ האוטומטי */
  var prev = h("div", { "class": "panel", style: "border:2px solid var(--lab-gold);margin-top:14px" }, [
    h("div", { style: "display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap" }, [
      h("div", null, [
        txt("h3", null, "⚡ תצוגה מקדימה — שיבוץ אוטומטי לפי קרבה"),
        txt("div", "sub", "כל תלמידה לגן הקרוב מבין הנבחרים · מכבד רף שיבוץ, התאמת חינוך וגיל")
      ]),
      h("div", { "class": "row", style: "gap:8px" }, [ btn("בצע 3 שיבוצים"), btn("ביטול", "ghost") ])
    ]),
    table(["תלמידה", "כתובת", "גן מוצע", "מרחק", "הערה"], [
      [h("b", { text: "גולדשטיין מירי" }), "חזון איש 8", h("span", { "class": "chip edu reg", text: "גן גפן" }), "180 מ׳",
       h("span", { style: "color:var(--good)", text: "✓ גיל 2/3 תואם" })],
      [h("b", { text: "לוינגר ברכי" }), "חפץ חיים 11", h("span", { "class": "chip edu reg", text: "גן דובדבן" }), "260 מ׳",
       h("span", { style: "color:var(--accent)", text: "אחות בגן דובדבן — נשמרות יחד" })],
      [h("b", { text: "שטרן טובי" }), "אבני נזר 40", h("span", { "class": "chip edu reg", text: "גן גפן" }), "210 מ׳",
       h("span", { style: "color:var(--good)", text: "✓ 22/28 אחרי השיבוץ" })],
      [h("b", { text: "רוזנברג חני" }), "סורוצקין 22", h("span", { "class": "chip", text: "— לא שובצה —" }), "120 מ׳",
       h("span", { style: "color:var(--bad)", text: "גן רימון מלא 32/32 — חורג מרף השיבוץ" })]
    ])
  ]);

  v.appendChild(h("div", { "class": "panel" }, [
    h("div", { "class": "section-title" }, [ txt("h2", null, "מפת שיבוץ") ]),
    toolbar([["⚡ שיבוץ אוטומטי לפי קרבה", "map-auto"], ["⛶ מסך מלא", "map-full"],
             ["🔄 רענון מיקומים", "map-reload"]]),
    h("details", { "class": "map-fold", open: "" }, [
      h("summary", { text: "גנים להצגה" }),
      h("div", { "class": "map-fold-body" }, [ list, opts ])
    ]),
    two, prev
  ]));
};

VIEW.assign = function(v){
  var host = h("div", { id: "asgList" });
  v.appendChild(h("div", { "class": "panel" }, [
    h("div", { "class": "section-title" }, [ txt("h2", null, "שיבוץ צוות") ]),
    h("div", { "class": "row", style: "gap:10px;flex-wrap:wrap;align-items:end" }, [
      h("div", { "class": "field", style: "min-width:200px" }, [
        txt("label", null, "הקשר"),
        h("select", { id: "asgCtxSel", html:
          "<option>פעילות הגן</option><option>קייטנה</option><option>שנת הלימודים</option>" })
      ])
    ]),
    searchbar("חיפוש גן (שם / סמל / כתובת)…"),
    host
  ]));
};

VIEW.templates = function(v){
  var f1 = h("fieldset", null, [
    txt("legend", null, "📋 רשימת גן"),
    txt("div", "hint", 'רשימת התלמידות בגן — שם, ת״ז, גיל, טלפונים וכתובת — להדפסה לגננת.'),
    h("div", { "class": "row", style: "align-items:end;gap:10px;flex-wrap:wrap" }, [
      h("div", { "class": "field", style: "min-width:220px" }, [
        txt("label", null, "גן"),
        h("select", { html: GANS.map(function(g){ return "<option>" + g.name + " · " + g.symbol + "</option>"; }).join("") })
      ]),
      btn("🖨️ הפקה והדפסה"), btn("📎 שיתוף מסמך", "ghost"),
      h("label", { "class": "check", html: '<input type="checkbox"> התאם לעמוד אחד' })
    ])
  ]);
  var sub = function(title, body, btns){
    var d = h("div", { style: "padding:10px 12px;background:var(--surface-2);border-radius:12px;margin-bottom:10px" });
    d.appendChild(h("b", { text: title }));
    d.appendChild(document.createTextNode(" — " + body));
    var r = h("div", { "class": "row", style: "gap:10px;flex-wrap:wrap;margin-top:8px" });
    btns.forEach(function(b, i){ r.appendChild(btn(b, i ? "ghost" : "")); });
    r.appendChild(h("label", { "class": "check", html: '<input type="checkbox"> התאם לעמוד אחד' }));
    d.appendChild(r); return d;
  };
  var f2 = h("fieldset", null, [
    txt("legend", null, "🧩 מצבת שיבוץ צוות"),
    txt("div", "hint", 'יצוא מצבת השיבוץ (הקשר "פעילות הגן") בשתי תבניות.'),
    sub("🏢 למשרד הראשי", "כל הגנים, מסודר לפי גן עם כל אנשי הצוות, ימים ושעות שבועיות, צבע לפי התפקיד + מקרא.",
        ["🖨️ הפקה והדפסה", "🎨 אקסל צבעוני", "📎 שיתוף מסמך"]),
    sub("🏛️ למשרד החינוך", 'תבנית "מצבת משרד החינוך" — שורה לכל גן, 32 עמודות. פרטי הרכז/ת והמנהל נשמרים ומופיעים בראש.',
        ["⬇️ ייצוא לאקסל (CSV)", "✏️ פרטי כותרת", "🖨️ הדפסה / PDF"])
  ]);
  v.appendChild(h("div", { "class": "panel" }, [
    h("div", { "class": "section-title" }, [ txt("h2", null, "מסמכים ותבניות") ]),
    txt("div", "sub", "הפקת מסמכים מוכנים להדפסה או לשמירה כ-PDF, ממולאים אוטומטית מהנתונים העדכניים."),
    f1, f2,
    txt("div", "note", '💡 בחלון ההדפסה שנפתח אפשר לבחור מדפסת אמיתית או "שמירה כ-PDF".')
  ]));
};

VIEW.reports = function(v){
  v.appendChild(h("div", { "class": "panel" }, [
    txt("h2", null, "סיכום שנת " + YEAR),
    txt("div", "sub", "מתעדכן אוטומטית עם כל רישום."),
    statRow([
      { k: "סה״כ תלמידות רשומות", v: T.total, hero: true },
      { k: "ממוצע לגן", v: (T.total / T.gans).toFixed(1) },
      { k: "גנים פעילים", v: T.gans },
      { k: "קלוטות בעירייה", v: T.muni }
    ])
  ]));
  v.appendChild(h("div", { "class": "panel" }, [
    txt("h2", null, "יעד מספר גנים"),
    txt("div", "sub", "משמש לחישוב הממוצע לגן בסיכום שלמעלה."),
    h("div", { "class": "row" }, [
      h("div", { "class": "field", style: "min-width:150px" }, [
        txt("label", null, "מספר גנים ליעד"), h("input", { value: String(T.gans) })
      ]),
      btn("שמור")
    ])
  ]));
};

VIEW.municipality = function(v){
  v.appendChild(h("div", { "class": "panel" }, [
    txt("h2", null, "רשימת העירייה · שנת " + YEAR),
    txt("div", "sub", 'הדבק/י או העלה/י את רשימת תעודות הזהות שקיבלת מהעירייה. המערכת תבצע התאמה (VLOOKUP) לפי ת״ז ותסמן כל תלמידה כ"קלוט בעירייה".'),
    h("div", { "class": "grid g2" }, [
      h("div", null, [
        txt("label", null, 'הדבקת ת״ז (שורה לכל אחת)'),
        h("textarea", { rows: "8", text: STUDENTS.slice(0, 9).map(function(s){ return s.tz; }).join("\n") }),
        h("div", { "class": "row", style: "margin-top:8px" }, [
          btn("🔗 בצע התאמה וסמן"), btn("📄 טעינת קובץ CSV", "ghost")
        ])
      ]),
      h("div", { id: "muni-result" }, [ txt("div", "hint", "התוצאה תופיע כאן לאחר ההתאמה.") ])
    ])
  ]));
};

VIEW.management = function(v){
  var people = [
    ["ישראל וינברג", "מנכ״ל", "052-8841190"],
    ["שרה ברקוביץ׳", "רכזת רישום", "053-3120774"],
    ["אהובה רקובסקי", "מזכירות", "054-8110297"],
    ["מלכה לוי", "אגף חינוך", "052-4419923"]
  ];
  v.appendChild(h("div", { "class": "panel" }, [
    txt("h2", null, "ספר טלפונים · הנהלה"),
    txt("div", "sub", "אנשי הקשר של ההנהלה והאגפים."),
    table(["שם", "תפקיד", "נייד"], people.map(function(p){
      return [h("b", { text: p[0] }), p[1],
              h("span", { style: "direction:ltr;unicode-bidi:isolate", text: p[2] })];
    }))
  ]));
};

VIEW.messages = function(v){
  var fs1 = h("fieldset", null, [
    txt("legend", null, "1 · למי שולחים"),
    h("div", { "class": "row", style: "gap:6px;flex-wrap:wrap" }, [
      btn("👪 הורי תלמידות"), btn("👩‍🏫 צוות הגנים", "ghost"),
      btn("📞 הנהלה", "ghost"), btn("✍️ רשימה ידנית", "ghost")
    ]),
    h("div", { "class": "grid g4", style: "margin-top:10px" }, [
      h("div", null, [txt("label", null, "חינוך"), h("select", { html: "<option>הכל</option><option>רגיל</option><option>ח״מ</option>" })]),
      h("div", null, [txt("label", null, "קמפוס"), h("select", { html: "<option>הכל</option>" + CAMPUS.map(function(c){ return "<option>" + c + "</option>"; }).join("") })]),
      h("div", null, [txt("label", null, "מועד רישום"), h("select", { html: "<option>הכל</option>" + PERIODS.map(function(p){ return "<option>" + p + "</option>"; }).join("") })]),
      h("div", null, [txt("label", null, "סטטוס שיבוץ"), h("select", { html: "<option>רק משובצות סופית</option><option>רק ממתינות</option><option>כולן</option>" })])
    ]),
    h("div", { "class": "row", style: "align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px" }, [
      h("b", { text: "גנים" }), btn("בחר הכל", "ghost sm"), btn("נקה", "ghost sm"),
      txt("span", "hint", "לא נבחר גן = כל הגנים")
    ]),
    h("div", { style: "max-height:130px;overflow:auto;margin-top:6px;padding:8px;border:1px solid var(--border);border-radius:10px;display:flex;flex-wrap:wrap;gap:4px 14px",
      html: GANS.map(function(g, i){
        return '<label class="check"><input type="checkbox"' + (i < 2 ? " checked" : "") + '> ' + g.name + '</label>';
      }).join("") }),
    h("div", { "class": "note", id: "msg-count",
      text: "61 נמענות תואמות · 58 עם נייד תקין · 3 ללא פרטי קשר" })
  ]);
  var CH = [["✉️ מייל", 1], ["💬 וואטסאפ", 0], ["📱 SMS", 0], ["📞 הודעה קולית", 0]];
  var fs2 = h("fieldset", null, [
    txt("legend", null, "2 · באיזה ערוץ"),
    h("div", { "class": "row", style: "gap:6px;flex-wrap:wrap" },
      CH.map(function(c, i){
        var b = h("button", { "class": "btn sm msg-ch" + (c[1] ? "" : " ghost"), type: "button", text: c[0] });
        b.dataset.v = ["email", "whatsapp", "sms", "voice"][i];
        b.onclick = demoAction("בחירת ערוץ");
        return b;
      })),
    h("div", { "class": "hint", id: "msg-ch-note", style: "margin-top:8px" })
  ]);
  var fs3 = h("fieldset", null, [
    txt("legend", null, "3 · מה שולחים"),
    h("div", { "class": "row", style: "gap:8px;align-items:flex-end;flex-wrap:wrap" }, [
      h("div", { "class": "field", style: "min-width:220px" }, [
        txt("label", null, "תבנית"),
        h("select", { html: "<option>הודעת שיבוץ סופי</option><option>תזכורת מסמכים</option><option>הודעה לצוות</option>" })
      ]),
      btn("💾 שמירה כתבנית חדשה", "ghost sm")
    ]),
    h("div", { style: "margin-top:10px" }, [
      txt("label", null, "נושא (למייל)"), h("input", { id: "msg-subject", value: "שיבוץ ילדתכם לשנת " + YEAR })
    ]),
    h("div", { style: "margin-top:10px" }, [
      txt("label", null, "תוכן ההודעה"),
      h("textarea", { id: "msg-body", rows: "8",
        text: "להורי {{שם הילדה}} שיחיו,\n\nילדתכם שובצה ל{{גן}}, אצל הגננת {{גננת}}.\nפתיחת השנה: {{תאריך}}.\n\nבברכה,\nרשת הגנים" })
    ])
  ]);
  var fs4 = h("fieldset", null, [
    txt("legend", null, "4 · תצוגה מקדימה ושליחה"),
    h("div", { "class": "row", style: "gap:8px;flex-wrap:wrap" }, [
      h("button", { "class": "btn", id: "msg-preview", type: "button", text: "👁️ תצוגה מקדימה", onclick: demoAction("תצוגה מקדימה") }),
      h("button", { "class": "btn", id: "msg-send", type: "button", text: "📤 שליחה", onclick: demoAction("שליחה") }),
      h("button", { "class": "btn ghost", id: "msg-test", type: "button", text: "✉️ שליחת בדיקה אליי", onclick: demoAction("שליחת בדיקה") })
    ]),
    h("div", { id: "msg-out", style: "margin-top:10px", html:
      '<div style="border:1px solid var(--border);border-radius:12px;padding:11px 13px;background:var(--surface-2);font-size:.86rem">' +
      '<div class="hint" style="margin-bottom:4px">אל: rachel.a@example.org</div>' +
      '<b>שיבוץ ילדתכם לשנת ' + YEAR + '</b>' +
      '<div style="margin-top:6px;line-height:1.6">להורי <b>חנה\'לה</b> שיחיו,<br>' +
      'ילדתכם שובצה ל<b>גן רימון</b>, אצל הגננת <b>שרה ברקוביץ׳</b>.</div></div>' })
  ]);
  v.appendChild(h("div", { "class": "panel" }, [
    h("div", { "class": "section-title" }, [
      h("div", null, [
        txt("h2", null, "📣 מרכז ההודעות"),
        txt("div", "sub", "שליחה מרוכזת להורים, לצוות ולהנהלה — במייל, בוואטסאפ, ב-SMS ובהודעה קולית. התוכן נכתב פעם אחת עם שדות מיזוג, והמערכת ממלאת לכל נמענת את הפרטים שלה.")
      ]),
      h("button", { "class": "btn ghost", id: "msg-history", text: "🕘 היסטוריית שליחות", onclick: demoAction("היסטוריית שליחות") })
    ]),
    fs1, fs2, fs3, fs4
  ]));
};

VIEW.export = function(v){
  var FIELDS = ["שם מלא", "ת״ז", "גיל", "גן", "קמפוס", "שם האם", "נייד", "כתובת", "עיר", "מועד", "עירייה", "מסמכים"];
  var checks = h("div", { "class": "checks" });
  FIELDS.forEach(function(f, i){
    checks.appendChild(h("label", { "class": "check", html:
      '<input type="checkbox" class="x-col"' + (i < 7 ? " checked" : "") + '> ' + f }));
  });
  var prevRows = STUDENTS.slice(0, 12).map(function(s){
    var g = ganById(s.ganId);
    return [fullName(s), h("span", { style: "direction:ltr;unicode-bidi:isolate", text: s.tz }),
            s.age, g ? g.name : "—", g ? g.campus : "—", s.mother,
            h("span", { style: "direction:ltr;unicode-bidi:isolate", text: s.mobile })];
  });
  v.appendChild(h("div", { "class": "panel" }, [
    txt("h2", null, "ייצוא רשימות"),
    txt("div", "sub", "בחר/י סינון, בחר/י אילו שדות לכלול, וייצא/י לאקסל או ל-PDF."),
    h("div", { "class": "toolbar" }, [
      h("div", { "class": "field" }, [txt("label", null, "גן"), h("select", { html: "<option>כל הגנים</option>" + GANS.map(function(g){ return "<option>" + g.name + "</option>"; }).join("") })]),
      h("div", { "class": "field" }, [txt("label", null, "גיל"), h("select", { html: "<option>הכל</option><option>3</option><option>4</option><option>5</option>" })]),
      h("div", { "class": "field" }, [txt("label", null, "מועד"), h("select", { html: "<option>הכל</option>" + PERIODS.map(function(p){ return "<option>" + p + "</option>"; }).join("") })]),
      h("div", { "class": "field" }, [txt("label", null, "קלוט בעירייה"), h("select", { html: "<option>הכל</option><option>רק קלוטות</option><option>רק לא קלוטות</option>" })]),
      h("div", { "class": "field" }, [txt("label", null, "מיון"), h("select", { html: "<option>לפי גן</option><option>שם משפחה</option>" })])
    ]),
    h("fieldset", null, [
      txt("legend", null, "שדות לייצוא"),
      h("div", { "class": "row", style: "margin-bottom:8px" }, [
        btn("סמן הכל", "ghost sm"), btn("נקה הכל", "ghost sm"), btn("ברירת מחדל", "ghost sm")
      ]),
      checks
    ]),
    h("div", { "class": "row", style: "align-items:center;flex-wrap:wrap" }, [
      h("button", { "class": "btn", id: "x-preview", text: "🔎 תצוגה מקדימה", onclick: demoAction("תצוגה מקדימה") }),
      h("button", { "class": "btn ghost", id: "x-xls", text: "🎨 אקסל צבעוני", onclick: demoAction("ייצוא") }),
      h("button", { "class": "btn ghost", id: "x-csv", text: "⬇️ ייצוא לאקסל (CSV)", onclick: demoAction("ייצוא") }),
      h("button", { "class": "btn ghost", id: "x-pdf", text: "🖨️ ייצוא ל-PDF / הדפסה", onclick: demoAction("הדפסה") }),
      h("label", { "class": "check", style: "margin-inline-start:auto", html: '<input type="checkbox"> התאם לעמוד אחד' })
    ]),
    h("div", { id: "x-out", style: "margin-top:14px" }, [
      table(["שם מלא", "ת״ז", "גיל", "גן", "קמפוס", "שם האם", "נייד"], prevRows)
    ])
  ]));
};

VIEW.tools = function(v){
  var card = function(icon, name, pill, pillCls, sub, btns){
    var p = h("div", { "class": "panel" });
    var head = h("h2", null, [ document.createTextNode(icon + " " + name) ]);
    if(pill) head.appendChild(h("span", { "class": "pill " + (pillCls || "neutral"), text: pill }));
    p.appendChild(head);
    p.appendChild(txt("div", "sub", sub));
    if(btns){
      var r = h("div", { "class": "row", style: "margin-top:10px" });
      btns.forEach(function(b, i){ r.appendChild(btn(b, i ? "ghost" : "")); });
      p.appendChild(r);
    }
    return p;
  };
  v.appendChild(card("🔗", "חיבור Google Drive", "מחובר", "ok",
    "חיבור פר-מכשיר שמאפשר יצירת תיקייה אוטומטית לכל ילדה והעלאת מסמכים ישירות אל הדרייב.",
    ["🔄 בדיקת חיבור וגרסה", "📂 פתח תיקיית האב", "🗂️ ארגן תיקיות לפי גן"]));
  v.appendChild(card("🔗", "נדרים פלוס", "בהכנה · לא מחובר", "neutral",
    "כשהורה נרשם דרך המערכת — ייפתח אוטומטית תיק ילדה שלם, המסמכים יעלו לתיקיית הדרייב שלה, ותתקבל התראה.",
    null));
  v.appendChild(card("📝", "רישום דיגיטלי — טופס להורים", "פעיל דרך הגשר", "ok",
    "טופס ציבורי עם חתימה דיגיטלית והעלאת ת״ז ותוספת.",
    ["💾 שמירה ופרסום הטופס", "📄 פתיחת הטופס", "📁 רישומים ממתינים"]));
  v.appendChild(card("💾", "גיבוי ושחזור", null, null,
    'הנתונים מסונכרנים בענן. גיבוי אוטומטי יומי נשמר ל-Drive בתיקיית "גיבויים".',
    ["⬇️ הורדת גיבוי", "⬆️ שחזור מקובץ"]));
  v.appendChild(card("🤖", "עוזר חכם (AI)", "פועל דרך הגשר", "ok",
    "צ׳אט עזרה שמסביר איך להשתמש בתוכנה, ויודע גם לבצע פעולות באישור.",
    ["🔑 הגדרת מפתח"]));
  v.appendChild(card("🧭", "עוזר חכם ודיוק מפה", null, null,
    "מפתחות ה-API נשמרים בגשר ולא בתוכנה. בלי מפתח גאוקוד — נפילה ל-OpenStreetMap.",
    ["🔑 הגדרת מפתח מפה"]));
};

VIEW.settings = function(v){
  var sec = function(title, sub, body){
    var p = h("div", { "class": "panel" }, [ txt("h2", null, title), txt("div", "sub", sub) ]);
    if(body) p.appendChild(body);
    return p;
  };
  v.appendChild(sec("מי מחובר עכשיו", "משתמשים פעילים ב-5 הדקות האחרונות.",
    h("div", { "class": "row", style: "gap:8px;flex-wrap:wrap;margin-top:8px", html:
      '<span class="pill ok">● שרה ברקוביץ׳ · לפני 0 שנ׳</span>' +
      '<span class="pill neutral">● אהובה רקובסקי · לפני 4 דק׳</span>' +
      '<span class="pill neutral">● מזכירות · לפני 7 דק׳</span>' })));
  v.appendChild(sec("יומן פעילות — מי ערך מה ומתי", "העריכה האחרונה של כל משתמש.",
    table(["משתמש", "מתי", "מה עשה/תה"], [
      ["שרה ברקוביץ׳", "היום 16:23", "שיבצה 12 תלמידות לגן רימון"],
      ["אהובה רקובסקי", "היום 14:50", "עדכנה תיק: לבין יסכה"],
      ["מזכירות", "אתמול 08:20", "ייבוא 34 רשומות ממועד ב׳"],
      ["ישראל וינברג", "אתמול 11:40", "עדכן גן אגוז לחינוך מיוחד"]
    ])));
  v.appendChild(sec("מיתוג — כותרת ולוגו", "שינוי הכותרת הראשית והלוגו של המערכת."));
  v.appendChild(sec("התקנה כאפליקציה — טלפון או מחשב", "הוספת המערכת למסך הבית."));
  v.appendChild(sec("רף שיבוץ — מקסימום משובצות בגן", "מגבלה קשיחה על השיבוץ הסופי בלבד.",
    h("div", { "class": "row", style: "margin-top:8px" }, [
      h("div", { "class": "field" }, [txt("label", null, "ברירת מחדל — רגיל"), h("input", { value: "32" })]),
      h("div", { "class": "field" }, [txt("label", null, "ברירת מחדל — ח״מ"), h("input", { value: "12" })]),
      btn("שמירה")
    ])));
  v.appendChild(sec("שנים", "כל שנה מנוהלת בנפרד.",
    h("div", { "class": "row", style: "gap:6px;margin-top:8px" }, [
      btn(YEAR + " · פעילה"), btn(PREV, "ghost"), btn("+ הוספת שנה", "ghost")
    ])));
  v.appendChild(sec("מעבר שנה — קידום לגן המתקדם", "מעתיק את התלמידות משנה קודמת ומקדם אותן לגיל הבא."));
  v.appendChild(sec("נתונים היסטוריים (שנים קודמות)", "מספרי רישום משנים שאין להן נתונים מלאים."));
  v.appendChild(sec("מינימום לפתיחת צהרון", "בלשונית שיבוץ — צהרון, כמותנה לפתיחה.",
    h("div", { "class": "row", style: "margin-top:8px" }, [
      h("div", { "class": "field" }, [txt("label", null, "תלמידות"), h("input", { value: "15" })]), btn("שמירה")
    ])));
  v.appendChild(sec("גילי הילדים (רשימת תלמידים)", "הגילים לבחירה בתיק.",
    h("div", { "class": "row", style: "gap:6px;margin-top:8px", html:
      ["2", "3", "4", "5", "6"].map(function(a){ return '<span class="fchip">' + a + '</span>'; }).join("") })));
  v.appendChild(sec("תפקידי צוות", "לכל תפקיד: שיוך חינוך וסדר בשיבוץ.",
    h("div", { "class": "row", style: "gap:6px;margin-top:8px", html:
      ROLES.map(function(r){ return '<span class="fchip">' + r + '</span>'; }).join("") })));
  v.appendChild(sec("קמפוסים", "הקמפוס של כל תלמידה נגזר אוטומטית לפי הגן.",
    h("div", { "class": "row", style: "gap:6px;margin-top:8px", html:
      CAMPUS.map(function(c){ return '<span class="fchip">' + c + '</span>'; }).join("") })));
  v.appendChild(sec("מנהלי מערכת", "הרשאות עריכה מלאות."));
  v.appendChild(sec("חשבון והתחברות", "כתובת המייל והסיסמה."));
  v.appendChild(sec("ניהול משתמשים", "הוספה, הרשאות והסרה."));
  v.appendChild(sec("💡 פניות והצעות שיפור", "כל הצעה נשמרת ונשלחת לפיתוח."));
};

VIEW.guide = function(v){
  var item = function(icon, title, body){
    return h("div", { "class": "panel" }, [
      txt("h2", null, icon + " " + title), txt("div", "sub", body)
    ]);
  };
  v.appendChild(h("div", { "class": "panel" }, [
    txt("h2", null, "מדריך למשתמש"),
    txt("div", "sub", "כל מה שצריך לדעת כדי לעבוד עם המערכת — לפי נושאים.")
  ]));
  v.appendChild(item("🎒", "תיקי התלמידות", "הוספה, עריכה, סינון מתקדם, עדכון קבוצתי וייבוא מקובץ."));
  v.appendChild(item("🏫", "גנים ושיבוץ", "רף שיבוץ לכל גן, שיבוץ ידני ושיבוץ אוטומטי לפי קרבה גיאוגרפית."));
  v.appendChild(item("👩‍🏫", "צוות ושיבוץ צוות", "מאגר אנשי הצוות, תקנים לכל גן ומצבת להפקה."));
  v.appendChild(item("📣", "מרכז ההודעות", "שליחה מרוכזת עם שדות מיזוג — מייל, וואטסאפ, SMS והודעה קולית."));
  v.appendChild(item("🤖", "עוזר חכם", "פאנל צד שעונה על שאלות וגם מבצע פעולות — כל פעולה מוצגת לאישור."));
};

/* =========================================================================
   וו הקריאה שהמעבדה משתמשת בו — אותו חוזה בדיוק כמו ב-index.html
   ========================================================================= */
var active = "home";

function campusStats(){
  var m = {};
  GANS.forEach(function(g){
    var e = m[g.campus] || (m[g.campus] = { name: g.campus, cap: 0, used: 0, gans: 0, n: 0, muni: 0, need: 0, got: 0 });
    e.cap += g.cap; e.used += g.used; e.gans++;
    e.need += 2 + (g.age === "5" ? 1 : 0);
    e.got  += (g.teacher ? 1 : 0) + 1 + (g.age === "5" && rnd() > 0.35 ? 1 : 0);
  });
  STUDENTS.forEach(function(s){
    var g = ganById(s.ganId); if(!g) return;
    var e = m[g.campus]; e.n++; if(s.muni) e.muni++;
  });
  return Object.keys(m).map(function(k){ return m[k]; });
}
function byCity(){
  var m = {};
  STUDENTS.forEach(function(s){
    var e = m[s.city] || (m[s.city] = { city: s.city, n: 0, ok: 0 });
    e.n++; if(s.muni) e.ok++;
  });
  return Object.keys(m).map(function(k){ return m[k]; }).sort(function(a, b){ return b.n - a.n; });
}

window.__uiLab = Object.freeze({
  stats: function(){
    return { year: YEAR, students: T.total, gansActive: T.gans, gansTarget: 30,
             email: "demo@example.org", staff: STAFF.length, notMuni: T.notMuni };
  },

  home: function(){
    var docBreak = DOCS.map(function(d){
      return { label: d[1], missing: STUDENTS.filter(function(s){ return !s.docs[d[0]]; }).length };
    }).sort(function(a, b){ return b.missing - a.missing; });
    var noT = GANS.filter(function(g){ return !g.teacher; });
    return {
      year: YEAR, name: "רכזת רישום",
      total: T.total, placed: T.placed, waiting: T.waiting, notMuni: T.notMuni,
      missingDocs: STUDENTS.filter(function(s){ return docsDone(s) < DOCS.length; }).length,
      topDoc: docBreak[0].label, docBreak: docBreak,
      topAge: "3", topAgeN: 33,
      noTeacherCount: noT.length,
      noTeacherCampus: noT.map(function(g){ return g.campus; }),
      campuses: campusStats(),
      nearFull: GANS.filter(function(g){ return g.used >= g.cap - 2; }).map(function(g){ return g.name; }),
      gansActive: T.gans,
      ganCards: GANS.map(function(g){
        return { id: g.id, name: g.name, symbol: g.symbol, age: g.age, edu: g.edu,
                 campus: g.campus, teacher: g.teacher, ageInk: g.ink,
                 ageKey: Number((String(g.age).match(/\d+/) || [])[0]) || 99,
                 used: g.used, cap: g.cap };
      }).sort(function(a, b){ return (a.ageKey - b.ageKey) || a.name.localeCompare(b.name, "he"); }),
      activity: [
        { who: "שרה ברקוביץ׳", ts: Date.now() - 36e5,  what: "שיבצה 12 תלמידות לגן רימון" },
        { who: "אהובה רקובסקי", ts: Date.now() - 9e6,  what: "עדכנה תיק: לבין יסכה" },
        { who: "מזכירות",       ts: Date.now() - 9e7,  what: "ייבוא 34 רשומות ממועד ב׳" },
        { who: "ישראל וינברג",  ts: Date.now() - 17e7, what: "עדכן גן אגוז לחינוך מיוחד" }
      ]
    };
  },

  stuKpis: function(){
    var ageN = {};
    STUDENTS.filter(function(s){ return !(s.ganId && s.placed); }).forEach(function(s){
      var g = ganById(s.ganId);
      var a = String((g && g.age) || s.age || "").trim();
      if(a) ageN[a] = (ageN[a] || 0) + 1;
    });
    var topAge = "", topAgeN = 0;
    Object.keys(ageN).forEach(function(a){ if(ageN[a] > topAgeN){ topAgeN = ageN[a]; topAge = a; } });
    var last = "", lastN = 0;
    PERIODS.filter(function(p){ return p !== "סופי"; }).forEach(function(pr){
      var n = STUDENTS.filter(function(s){ return s.period === pr; }).length;
      if(n){ last = pr; lastN = n; }
    });
    var now = new Date();
    return {
      date: "יום שלישי, כ״ג באב תשפ״ו",
      time: now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
      sincePeriod: last, sinceN: lastN, topAge: topAge, topAgeN: topAgeN
    };
  },

  subtitle: function(tab){
    var camps = CAMPUS.length;
    switch(tab){
      case "students":     return T.total + " תלמידות · " + YEAR;
      case "gans":         return T.gans + " גנים · " + camps + " קמפוסים · " + YEAR;
      case "staff":        return "מאגר כללי · " + STAFF.length + " אנשי צוות פעילים · " + YEAR;
      case "assign":       return YEAR + " · " + T.gans + " גנים";
      case "map":          return "312 מתוך " + T.total + " מיקומים נטענו · מודיעין עילית";
      case "reports":      return YEAR + " · " + T.total + " תלמידות · " + T.gans + " גנים";
      case "municipality": return T.muni + " נקלטו · " + T.notMuni + " ממתינות · " + byCity().length + " ערים";
      case "messages":     return "שליחה מרוכזת · " + YEAR;
      case "export":       return "בחר/י מה לייצא, לאיזה פורמט ולמי";
      case "templates":    return "מסמכים ותבניות · " + YEAR;
      case "settings":     return "כל ההגדרות במקום אחד · מקובצות";
      default:             return YEAR;
    }
  },

  reportsBoard: function(){
    var amap = {};
    STUDENTS.forEach(function(s){
      var g = ganById(s.ganId);
      var a = (g && g.age) || s.age || "ללא גיל";
      var e = amap[a] || (amap[a] = { age: a, placed: 0, waiting: 0 });
      if(s.ganId && s.placed) e.placed++; else e.waiting++;
    });
    return {
      year: YEAR, prevYear: PREV,
      occupancy: Math.round(T.used / T.cap * 100), capUsed: T.used, capTotal: T.cap,
      docsPct: Math.round(T.allDocs / T.total * 100), docsN: T.allDocs,
      muniPct: Math.round(T.muni / T.total * 100), muniN: T.muni,
      placedPct: Math.round(T.placed / T.total * 100), placedN: T.placed,
      total: T.total,
      prev: { docs: Math.round(T.allDocs / T.total * 100) - 11,
              muni: Math.round(T.muni / T.total * 100) + 3,
              placed: Math.round(T.placed / T.total * 100) - 6 },
      byCity: byCity().slice(0, 8),
      byAge: Object.keys(amap).map(function(k){ return amap[k]; })
               .sort(function(a, b){ return String(a.age).localeCompare(String(b.age), "he", { numeric: true }); }),
      perGan: GANS.map(function(g){
        var rows = STUDENTS.filter(function(s){ return s.ganId === g.id; });
        var ok = rows.filter(function(s){ return docsDone(s) === DOCS.length; }).length;
        return { id: g.id, name: g.name, campus: g.campus, ageInk: g.ink,
                 n: rows.length, cap: g.cap, used: g.used,
                 occ: Math.round(g.used / g.cap * 100),
                 muni: rows.length ? Math.round(rows.filter(function(s){ return s.muni; }).length / rows.length * 100) : 0,
                 docs: rows.length ? Math.round(ok / rows.length * 100) : 0 };
      }).sort(function(a, b){ return b.occ - a.occ; })
    };
  },

  muniBoard: function(){
    var pend = STUDENTS.filter(function(s){ return !s.muni; });
    var counts = { tz: 0, gan: 0, docs: 0, ready: 0 };
    var rows = pend.map(function(s){
      var r;
      if(!s.tz)            r = { key: "tz",   label: 'חסרה ת״ז',      tone: "bad" };
      else if(!s.ganId)    r = { key: "gan",  label: "חסר שיבוץ",     tone: "warn" };
      else if(docsDone(s) < DOCS.length) r = { key: "docs", label: "מסמכים חסרים", tone: "warn" };
      else                 r = { key: "ready", label: "מוכן לשליחה", tone: "good" };
      counts[r.key]++;
      return { id: s.id, name: fullName(s), tz: s.tz, gan: ganName(s.ganId),
               city: s.city, reason: r.label, tone: r.tone };
    }).sort(function(a, b){ return a.name.localeCompare(b.name, "he"); });
    return { year: YEAR, total: T.total, absorbed: T.muni, pending: pend.length,
             pct: Math.round(T.muni / T.total * 100), counts: counts,
             rows: rows.slice(0, 60), rowsTotal: rows.length,
             byCity: byCity().slice(0, 8), listed: T.muni };
  },

  mgmtBoard: function(){
    var cs = campusStats();
    var needT = 0, gotT = 0;
    cs.forEach(function(c){ needT += c.need; gotT += Math.min(c.got, c.need); });
    return {
      year: YEAR, prevYear: PREV, total: T.total, prevTotal: 381,
      target: T.cap,
      occupancy: Math.round(T.used / T.cap * 100),
      staffing: Math.round(gotT / needT * 100),
      openSlots: Math.max(0, needT - gotT),
      muniPct: Math.round(T.muni / T.total * 100),
      campuses: cs.map(function(c){
        return { name: c.name, gans: c.gans, n: c.n,
                 occ: Math.round(c.used / c.cap * 100),
                 staff: Math.round(Math.min(c.got, c.need) / c.need * 100),
                 muni: c.n ? Math.round(c.muni / c.n * 100) : 0 };
      }),
      byPeriod: ["א׳", "ב׳", "ג׳"].map(function(p){
        var n = STUDENTS.filter(function(s){ return s.period === p; }).length;
        return { p: p, now: n, prev: Math.round(n * 0.92) };
      })
    };
  },

  staffBoard: function(){
    var has = function(r){ return STAFF.filter(function(m){ return m.role.indexOf(r) >= 0; }); };
    var gan = has("גננת"), say = has("סייעת");
    var sp = function(a){ return a.filter(function(m){ return m.edu !== "רגיל"; }).length; };
    var kinds = {};
    say.forEach(function(m){ kinds[m.role] = (kinds[m.role] || 0) + 1; });
    var assigned = STAFF.filter(function(m){ return m.ganId; }).length;
    return {
      total: STAFF.length,
      ganenet: gan.length, ganenetSplit: { n: gan.length, special: sp(gan), regular: gan.length - sp(gan) },
      sayaat: say.length,  sayaatSplit:  { n: say.length, special: sp(say), regular: say.length - sp(say) },
      sayaatKinds: Object.keys(kinds).map(function(k){ return { role: k, n: kinds[k] }; })
                     .sort(function(a, b){ return b.n - a.n; }).slice(0, 3),
      noCert: STAFF.filter(function(m){ return !m.cert; }).length,
      assigned: assigned, unassigned: STAFF.length - assigned
    };
  },

  gansBoard: function(){
    var m = {};
    GANS.forEach(function(g){
      var e = m[g.campus] || (m[g.campus] = { name: g.campus, gans: [], cap: 0, used: 0 });
      e.cap += g.cap; e.used += g.used;
      e.gans.push({ id: g.id, name: g.name, symbol: g.symbol, age: g.age, edu: g.edu,
                    campus: g.campus, teacher: g.teacher, phone: g.phone,
                    ageInk: g.ink, used: g.used, cap: g.cap,
                    reg: STUDENTS.filter(function(s){ return s.ganId === g.id; }).length });
    });
    return { campuses: CAMPUS.map(function(c){ return m[c]; }).filter(Boolean) };
  },

  assignBoard: function(){
    return {
      context: "activity", contextLabel: "פעילות הגן",
      gans: GANS.map(function(g){
        var reg = STUDENTS.filter(function(s){ return s.ganId === g.id; }).length;
        var staff = STAFF.filter(function(m){ return m.ganId === g.id; });
        return {
          id: g.id, name: g.name, symbol: g.symbol, age: g.age, edu: g.edu, campus: g.campus,
          ageInk: g.ink, reg: reg, mandatory: g.age === "5", freeDays: [],
          bRole: "סייעת ב׳", bMin: 30, bEligible: reg >= 30 && g.age !== "5",
          filled: staff.map(function(m){
            return { role: m.role, name: m.last + " " + m.first, phone: m.mobile,
                     extraLabel: "ותק", extra: m.seniority + " שנים", students: "" };
          })
        };
      })
    };
  },

  studentCards: function(){
    return {
      total: STUDENTS.length, openId: "",
      rows: STUDENTS.slice(0, 120).map(function(s){
        var g = ganById(s.ganId);
        var placed = !!(s.ganId && s.placed);
        return {
          id: s.id, name: fullName(s), ini: ini(fullName(s)), tz: s.tz,
          gan: g ? g.name : "", campus: g ? g.campus : "", age: s.age, period: s.period,
          ageInk: g ? g.ink : "", placed: placed, muni: s.muni,
          docsDone: docsDone(s), docsTotal: DOCS.length,
          status: placed ? "משובצת" : (s.ganId ? "ממתינה" : "ללא גן"),
          tone:   placed ? "good"   : (s.ganId ? "warn"   : "bad")
        };
      })
    };
  },

  ganColors: function(){
    var out = {};
    GANS.forEach(function(g, i){
      out[g.id] = ["#2c6a4c", "#e0a53a", "#3f7cac", "#c65d5d", "#7b5ea7", "#4bb1a6"][i % 6];
    });
    return out;
  },

  ageLegend: function(){
    return ["3", "4", "5"].map(function(a){
      return '<span style="display:inline-flex;align-items:center;gap:5px">' +
        '<span style="width:14px;height:14px;border-radius:4px;border:1px solid var(--border);' +
        'background:color-mix(in srgb, ' + AGE_HUE[a] + ' 55%, var(--surface))"></span>גיל ' + a + '</span>';
    }).join(" ");
  },

  ganChips: function(){
    return [
      { sel:"#fg-age",    label:"גיל",   value:"", options:["3","3/4","4","5"] },
      { sel:"#fg-full",   label:"תפוסה", value:"", options:[["yes","מלאה"],["no","לא מלאה"]] },
      { sel:"#fg-campus", label:"קמפוס", value:"", options:CAMPUS },
      { sel:"#fg-zone",   label:"אזור",  value:"", options:["צפון","מרכז","דרום"] }
    ];
  },

  openGan:     function(){ toast("דמו — כרטיס השיבוץ של הגן אינו נפתח כאן."); },
  openStudent: function(){ toast("דמו — תיק התלמידה אינו נפתח כאן."); },
  addStudent:  function(){ toast("דמו — הוספת ילדה אינה פעילה כאן."); },
  openMenu:    function(){ openDrawer(); },
  activeTab:   function(){ return active; },
  go:          function(tab){ route(tab); }
});

/* =========================================================================
   ניווט ותשתית הדף
   ========================================================================= */
function openDrawer(){ document.getElementById("drawer").classList.add("open");
                       document.getElementById("scrim").classList.add("show"); }
function closeDrawer(){ document.getElementById("drawer").classList.remove("open");
                        document.getElementById("scrim").classList.remove("show"); }

function renderTabs(){
  var nav = document.getElementById("tabs");
  var counts = { students: T.total, gans: T.gans };
  nav.innerHTML = "";
  TABS.forEach(function(t){
    var b = h("button", { "data-tab": t.id, "class": t.id === active ? "active" : "" }, [
      txt("span", "ic", t.icon), txt("span", "tl", t.label)
    ]);
    if(counts[t.id] != null) b.appendChild(txt("span", "count", String(counts[t.id])));
    b.onclick = function(){ route(t.id); closeDrawer(); };
    nav.appendChild(b);
  });
}

function route(tab){
  if(tab) active = tab;
  var v = document.getElementById("view");
  v.innerHTML = "";
  renderTabs();
  (VIEW[active] || VIEW.home)(v);
  window.scrollTo(0, 0);
}

/* גובה רצועת הדמו נמדד בזמן ריצה — בנייד היא נשברת לשתי שורות, וגובה
   קשיח היה משאיר אותה על גבי הכותרת. */
function sizeFlag(){
  var f = document.querySelector(".demo-flag");
  if(!f) return;
  document.documentElement.style.setProperty("--demo-bar", Math.ceil(f.getBoundingClientRect().height) + "px");
}

function boot(){
  /* מחליף את המידע בכותרת ובמגירה לנתוני הדמו */
  var y = document.getElementById("yearSelect");
  if(y) y.innerHTML = "<option>" + YEAR + "</option><option>" + PREV + "</option>";
  var yc = document.getElementById("yearChip"); if(yc) yc.textContent = YEAR;
  var ec = document.getElementById("eduChip");  if(ec) ec.textContent = "הכל";
  var edu = document.getElementById("drawerEdu");
  if(edu) edu.innerHTML = '<button class="on">הכל</button><button>רגיל</button><button>ח״מ</button>';
  var t2 = document.querySelector("#drawerBrand .txt .t2");
  if(t2) t2.textContent = "רשת הגנים · דמו";

  var bind = function(id, fn){ var e = document.getElementById(id); if(e) e.onclick = fn; };
  bind("menuBtn", openDrawer);
  bind("drawerClose", closeDrawer);
  bind("backBtn", function(){ route("home"); });
  document.getElementById("scrim").onclick = closeDrawer;
  bind("themeBtn", function(){
    var cur = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = cur;
  });
  bind("aiHelpBtn", function(){
    document.getElementById("aiPanel").classList.toggle("open");
    document.body.classList.toggle("ai-docked");
  });
  bind("feedbackBtn", function(){ toast("דמו — טופס הפניות אינו פעיל כאן."); });
  bind("aiClose", function(){
    document.getElementById("aiPanel").classList.remove("open");
    document.body.classList.remove("ai-docked");
  });
  bind("aiClear", function(){ toast("דמו — העוזר אינו מחובר כאן."); });
  bind("aiSend",  function(){ toast("דמו — העוזר אינו מחובר כאן."); });

  var mode = document.getElementById("aiMode");
  if(mode){ mode.textContent = "דמו"; mode.className = "pill neutral"; }
  var msgs = document.getElementById("aiMsgs");
  if(msgs) msgs.innerHTML =
    '<div class="aimsg bot">שלום. אפשר לשאול אותי על נתונים, או לבקש ממני לבצע פעולה.</div>' +
    '<div class="aimsg user">כמה תלמידות בגן רימון?</div>' +
    '<div class="aimsg bot">בגן רימון 27 תלמידות רשומות בשנת ' + YEAR + ', מתוכן 24 משובצות סופית. רף השיבוץ בגן הוא 32.</div>' +
    '<div class="aimsg user">שבצי את שרה כהן לגן רימון</div>' +
    '<div class="aiact"><b>⚠ אישור פעולה — שיבוץ תלמידה</b>' +
    '<div>כהן שרה · 329771003</div>' +
    '<div style="display:flex;gap:8px;margin-top:8px">' +
    '<div style="flex:1;background:var(--surface-2);border-radius:9px;padding:6px 9px">' +
    '<div style="font-size:.7rem;color:var(--muted)">לפני</div><b style="margin:0">ללא גן</b></div>' +
    '<div style="flex:1;background:var(--surface-2);border-radius:9px;padding:6px 9px">' +
    '<div style="font-size:.7rem;color:var(--muted)">אחרי</div><b style="margin:0">גן רימון · 28/32</b></div></div>' +
    '<div class="aiact-row"><button class="btn">אישור וביצוע</button>' +
    '<button class="btn ghost">ביטול</button></div></div>';
  if(msgs) msgs.querySelectorAll(".aiact .btn").forEach(function(b){
    b.onclick = function(){ toast("דמו — הפעולה אינה מתבצעת כאן."); };
  });

  sizeFlag();
  window.addEventListener("resize", sizeFlag);
  if(window.ResizeObserver){
    new ResizeObserver(sizeFlag).observe(document.querySelector(".demo-flag"));
  }

  route("home");
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();

})();
