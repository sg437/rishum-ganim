/* ============================================================================
   בדיקת "שומר-ראש לסנכרון" (sync guard) — UI אופטימי
   ----------------------------------------------------------------------------
   מנעול-נגד-דריסה כותב בטרנזקציה (SDK) או ב-REST, ואלה — בשונה מ-setDoc —
   אינן מייצרות "הד" מקומי מיידי. לכן מיד אחרי שמירה, בנייה-מחדש מהסנאפשוט
   *שלפני ההד* מחזירה לרגע את המצב הישן והעריכה "נעלמת" עד שהשרת מחזיר אותה
   (הבהוב/פיגור ויזואלי, בולט ברשתות חלשות). השומר-ראש מציג את מה שנכתב מיד,
   עד שהשרת מאשר או עד פקיעת-זמן — בלי להחזיר לאחור עריכה של משתמש אחר.

   הבדיקה משכפלת בדיוק את האלגוריתם מ-index.html (_guardRecordList /
   _guardApplyList) ומוכיחה: גישור-עד-הד, אישור-בהד, נסיגה-בעריכה-מקבילה,
   גישור הוספה/מחיקה, פקיעת-זמן, ואי-כפילות. אין כאן שום גישה ל-Firebase —
   סימולציה טהורה ב-Node.
   הרצה:  node tests/sync-guard.test.cjs
   ============================================================================ */

const _mk = o => JSON.stringify(o);
const _guardKey = (coll, id) => coll + ":" + id;

/* ---- זהה ל-index.html: רישום מה שנכתב מתוך ההפרש מול בסיס-ההשוואה ---- */
function guardRecordList(guard, coll, list, baseMap, now){
  const cur = new Map(list.map(o => [o.id, o]));
  for(const [id, o] of cur){ const b = baseMap.get(id), j = _mk(o); if(!b || b.j !== j) guard.set(_guardKey(coll, id), { coll, id, j, prev:(b ? b.j : null), ts:now }); }
  for(const [id, b] of baseMap){ if(!cur.has(id)) guard.set(_guardKey(coll, id), { coll, id, j:null, prev:b.j, ts:now }); }
}
/* ---- זהה ל-index.html: מיזוג תלת-כיווני base(prev)→ours(j) מול server(cj) ---- */
function guardApplyList(coll, list, guard, now, ttl){
  const map = new Map(list.map(o => [o.id, o])); let changed = false;
  for(const [key, g] of guard){
    if(g.coll !== coll) continue;
    const cj = map.has(g.id) ? _mk(map.get(g.id)) : null;
    if(cj === g.j){ guard.delete(key); continue; }             // אושר → שחרר
    if(now - g.ts > ttl){ guard.delete(key); continue; }       // פקע → תן לשרת לנצח
    if(cj === g.prev){                                         // ההד עוד לא הגיע → הצג את שלנו
      if(g.j === null) map.delete(g.id);
      else map.set(g.id, JSON.parse(g.j));
      changed = true;
    } else { guard.delete(key); }                             // מישהו שינה אחרינו → נסיגה
  }
  return changed ? [...map.values()] : list;
}

const TTL = 12000;
/* בסיס-השוואה (baseMap) בפורמט של index.html: id → {j} */
const baseOf = list => new Map(list.map(o => [o.id, { j:_mk(o) }]));

/* ---- כלי בדיקה ---- */
let pass = 0, fail = 0;
function check(name, cond, detail){
  if(cond){ pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (detail ? ("  → " + detail) : "")); }
}
const find = (arr, id) => arr.find(o => o.id === id);
function seed(){ return [
  {id:"s1", name:"שרה",  note:""},
  {id:"s2", name:"רבקה", note:""},
  {id:"s3", name:"מרים", note:""},
]; }

console.log("\n=== תרחיש 1: גישור — עריכה נשארת על המסך עד שההד מגיע ===");
{
  const server = seed();                       // מצב השרת (המאושר) לפני הכתיבה
  const guard = new Map();
  const local = seed(); find(local,"s1").note = "עריכה שלי"; // המשתמש ערך והקוד רשם שומר
  guardRecordList(guard, "stu", local, baseOf(server), 1000);

  // rebuild ראשון: הסנאפשוט עדיין *לפני ההד* (השרת מציג את המצב הישן)
  const shown1 = guardApplyList("stu", server.map(o=>({...o})), guard, 1100, TTL);
  check("העריכה מוצגת מיד (לא 'נעלמה')", find(shown1,"s1").note === "עריכה שלי", "התקבל: " + JSON.stringify(find(shown1,"s1").note));
  check("השומר עדיין פעיל (ממתין להד)", guard.size === 1);

  // rebuild שני: אותו מצב-שרת ישן — עדיין מגושר
  const shown2 = guardApplyList("stu", server.map(o=>({...o})), guard, 1200, TTL);
  check("גם ב-rebuild חוזר — העריכה עדיין מוצגת", find(shown2,"s1").note === "עריכה שלי");
}

console.log("\n=== תרחיש 2: אישור — כשההד מגיע, השומר משתחרר ואין כפילות ===");
{
  const server = seed();
  const guard = new Map();
  const local = seed(); find(local,"s1").note = "עריכה שלי";
  guardRecordList(guard, "stu", local, baseOf(server), 1000);

  // ההד הגיע: מצב-השרת עכשיו כולל את העריכה שלנו
  const echoed = seed(); find(echoed,"s1").note = "עריכה שלי";
  const shown = guardApplyList("stu", echoed.map(o=>({...o})), guard, 1300, TTL);
  check("העריכה קיימת (מהשרת)", find(shown,"s1").note === "עריכה שלי");
  check("השומר השתחרר (אושר)", guard.size === 0);
  check("אין כפילות של s1", shown.filter(o=>o.id==="s1").length === 1);
  check("סה\"כ 3 רשומות", shown.length === 3, "כמות: " + shown.length);
}

console.log("\n=== תרחיש 3: נסיגה — עריכה של משתמש אחר על אותה רשומה גוברת (לא 'מוחזרת לאחור') ===");
{
  const server = seed();
  const guard = new Map();
  const local = seed(); find(local,"s1").note = "מ-שלי";
  guardRecordList(guard, "stu", local, baseOf(server), 1000);

  // בזמן שההד שלנו בדרך — משתמש אחר שמר ערך *אחר* לאותה רשומה (המנעול-נגד-דריסה קבע מנצח)
  const other = seed(); find(other,"s1").note = "מ-אחר";
  const shown = guardApplyList("stu", other.map(o=>({...o})), guard, 1400, TTL);
  check("מוצג הערך של האחר (yield לשרת)", find(shown,"s1").note === "מ-אחר", "התקבל: " + JSON.stringify(find(shown,"s1").note));
  check("השומר השתחרר (נסיגה)", guard.size === 0);
}

console.log("\n=== תרחיש 4: גישור הוספה — רשומה חדשה נשארת עד שההד מגיע ===");
{
  const server = seed();
  const guard = new Map();
  const local = seed(); local.push({id:"s4", name:"חנה", note:"חדשה"});
  guardRecordList(guard, "stu", local, baseOf(server), 1000);

  // rebuild לפני ההד: השרת עדיין בלי s4
  const shown1 = guardApplyList("stu", server.map(o=>({...o})), guard, 1100, TTL);
  check("ההוספה מוצגת מיד", !!find(shown1,"s4") && find(shown1,"s4").note === "חדשה");
  check("סה\"כ 4 (3+1)", shown1.length === 4, "כמות: " + shown1.length);

  // ההד הגיע: השרת כולל את s4
  const echoed = server.concat([{id:"s4", name:"חנה", note:"חדשה"}]);
  const shown2 = guardApplyList("stu", echoed.map(o=>({...o})), guard, 1200, TTL);
  check("אחרי ההד — s4 קיים פעם אחת בלבד", shown2.filter(o=>o.id==="s4").length === 1);
  check("השומר השתחרר", guard.size === 0);
}

console.log("\n=== תרחיש 5: גישור מחיקה — רשומה שמחקנו לא 'קופצת חזרה' ===");
{
  const server = seed();
  const guard = new Map();
  const local = server.filter(o => o.id !== "s2"); // מחקנו את s2
  guardRecordList(guard, "stu", local, baseOf(server), 1000);

  // rebuild לפני ההד: השרת עדיין מכיל את s2
  const shown1 = guardApplyList("stu", server.map(o=>({...o})), guard, 1100, TTL);
  check("s2 לא מוצג (מחיקה אופטימית)", !find(shown1,"s2"));
  check("סה\"כ 2 (3-1)", shown1.length === 2, "כמות: " + shown1.length);

  // ההד הגיע: השרת בלי s2
  const echoed = server.filter(o => o.id !== "s2");
  const shown2 = guardApplyList("stu", echoed.map(o=>({...o})), guard, 1200, TTL);
  check("אחרי ההד — עדיין 2 והשומר השתחרר", shown2.length === 2 && guard.size === 0);
}

console.log("\n=== תרחיש 6: מחיקה מול עריכת-אחר — עריכת האחר גוברת (לא נמחקת בטעות) ===");
{
  const server = seed();
  const guard = new Map();
  const local = server.filter(o => o.id !== "s2"); // אנחנו מחקנו את s2
  guardRecordList(guard, "stu", local, baseOf(server), 1000);

  // אבל משתמש אחר ערך את s2 אחרינו — עריכתו צריכה לשרוד
  const other = seed(); find(other,"s2").note = "עדכון מאוחר";
  const shown = guardApplyList("stu", other.map(o=>({...o})), guard, 1300, TTL);
  check("s2 שרד עם עריכת האחר (yield)", !!find(shown,"s2") && find(shown,"s2").note === "עדכון מאוחר");
  check("השומר השתחרר", guard.size === 0);
}

console.log("\n=== תרחיש 7: פקיעת-זמן — אם ההד לא הגיע עד TTL, נסוגים לשרת ===");
{
  const server = seed();
  const guard = new Map();
  const local = seed(); find(local,"s1").note = "עריכה תקועה";
  guardRecordList(guard, "stu", local, baseOf(server), 1000);

  // עבר הרבה זמן וההד לא הגיע (רשת גרועה מאוד / כתיבה שלא נקלטה) — מציגים את השרת
  const shown = guardApplyList("stu", server.map(o=>({...o})), guard, 1000 + TTL + 1, TTL);
  check("אחרי TTL — מוצג מצב השרת", find(shown,"s1").note === "", "התקבל: " + JSON.stringify(find(shown,"s1").note));
  check("השומר השתחרר (פקיעה)", guard.size === 0);
}

console.log("\n=== תרחיש 8: מספר אוספים במקביל (stu/gan) — כל אחד מגושר בנפרד ===");
{
  const guard = new Map();
  const stuServer = seed();
  const ganServer = [{id:"g1", ganName:"גן א"}, {id:"g2", ganName:"גן ב"}];
  const stuLocal = seed(); find(stuLocal,"s3").note = "הערה";
  const ganLocal = ganServer.map(o=>({...o})); find(ganLocal,"g1").ganName = "גן א׳ מעודכן";
  guardRecordList(guard, "stu", stuLocal, baseOf(stuServer), 1000);
  guardRecordList(guard, "gan", ganLocal, baseOf(ganServer), 1000);

  const stuShown = guardApplyList("stu", stuServer.map(o=>({...o})), guard, 1100, TTL);
  const ganShown = guardApplyList("gan", ganServer.map(o=>({...o})), guard, 1100, TTL);
  check("עריכת תלמידה מגושרת", find(stuShown,"s3").note === "הערה");
  check("עריכת גן מגושרת", find(ganShown,"g1").ganName === "גן א׳ מעודכן");
  check("שתי רשומות שומר פעילות", guard.size === 2);
}

console.log("\n=== תרחיש 9: כשאין שינוי — אין כלל רשומות שומר (אפס תקורה) ===");
{
  const server = seed();
  const guard = new Map();
  guardRecordList(guard, "stu", server.map(o=>({...o})), baseOf(server), 1000);
  check("שמירה בלי שינוי אמיתי אינה יוצרת שומר", guard.size === 0);
  const shown = guardApplyList("stu", server.map(o=>({...o})), guard, 1100, TTL);
  check("מוחזרת אותה רשימה (בלי הקצאה)", shown.length === 3);
}

console.log("\n============================================");
console.log(`תוצאה: ${pass} עברו · ${fail} נכשלו`);
console.log("============================================\n");
process.exit(fail ? 1 : 0);
