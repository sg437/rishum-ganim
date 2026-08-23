/* ============================================================================
   בדיקת "שמירה עמידה לרשת חלשה" (resilient save) v2 — כתיבות-ממתינות
   ----------------------------------------------------------------------------
   v1 (ניסיון-חוזר + מעבר-REST + עצירת המאזין) נכשלה בבדיקת מצב-טיסה — הערה אבדה.
   v2 שונה מיסודו: לא עוצרים את המאזין ולא עוברים ל-REST. כל עריכה נרשמת כ"ממתינה"
   (_pending) לפני הכתיבה, מוחלת מעל כל סנאפשוט כדי שלא תיעלם, מסומנת "טרם נשמר"
   (לא "נשמר" מטעה), ומנוסה שוב אוטומטית עד שהשרת מאשר.

   כאן משוכפלת בדיוק הלוגיקה מ-index.html (recordPending + _guardApplyList עם
   TTL=Infinity + מכונת-המצב של החיווי), ונבדק תרחיש מצב-הטיסה מקצה-לקצה, כולל
   הוספה/מחיקה אופליין, נסיגה בעריכת-אחר, ואי-אובדן.
   סימולציה טהורה ב-Node.  הרצה:  node tests/resilient-save.test.cjs
   ============================================================================ */

const _mk = o => JSON.stringify(o);
const _pendKey = (c,id)=> c+":"+id;

/* ---- זהה ל-index.html: רישום הממתינים מההפרש מול בסיס-ההשוואה (לפני הכתיבה) ---- */
function recordPending(pending, coll, list, base){
  const cur=new Map(list.map(o=>[o.id,o]));
  for(const [id,o] of cur){ const b=base.get(id), j=_mk(o); if(!b || b.j!==j) pending.set(_pendKey(coll,id), {coll,id,j,prev:(b?b.j:null)}); }
  for(const [id,b] of base){ if(!cur.has(id)) pending.set(_pendKey(coll,id), {coll,id,j:null,prev:b.j}); }
}
/* ---- זהה ל-index.html: מיזוג תלת-כיווני base(prev)→ours(j) מול server(cj) ---- */
function guardApplyList(coll, list, guard, now, ttl){
  const map=new Map(list.map(o=>[o.id,o])); let changed=false;
  for(const [key,g] of guard){
    if(g.coll!==coll) continue;
    const cj = map.has(g.id) ? _mk(map.get(g.id)) : null;
    if(cj===g.j){ guard.delete(key); continue; }             // אושר בשרת → שחרר
    if(now - g.ts > ttl){ guard.delete(key); continue; }     // (Infinity → לעולם לא)
    if(cj===g.prev){ if(g.j===null) map.delete(g.id); else map.set(g.id, JSON.parse(g.j)); changed=true; }
    else { guard.delete(key); }                              // עריכת-אחר → נסיגה
  }
  return changed ? [...map.values()] : list;
}
/* applyPending של index.html (לרשימת תלמידות בלבד, לצורך הבדיקה) */
const applyStu = (server, pending)=> guardApplyList("stu", server.map(o=>({...o})), pending, Date.now(), Infinity);
const baseOf = list => new Map(list.map(o=>[o.id,{j:_mk(o)}]));

/* ---- מכונת-מצב החיווי (זהה לעקרון ב-index.html) ---- */
function makeStatus(pending){
  let saveFailed=false, pill="";
  const refresh=(fromCache)=>{ if(!pending.size){ saveFailed=false; pill=fromCache?"offline":"synced"; } };
  return {
    setSyncStatus(state){
      if(pending.size && state!=="pending"){ pill = saveFailed ? "טרם נשמר" : "מסנכרן"; return; }
      pill = state;
    },
    onFail(){ saveFailed=true; this.setSyncStatus("error"); },
    onSuccessAwaitEcho(){ saveFailed=false; refresh(false); }, // האישור יגיע בסנאפשוט
    afterSnapshot(fromCache){ refresh(fromCache); },
    get(){ return { saveFailed, pill, size:pending.size }; }
  };
}

let pass=0, fail=0;
function check(name, cond, detail){ if(cond){ pass++; console.log("  ✓ "+name); } else { fail++; console.log("  ✗ "+name+(detail?("  → "+detail):"")); } }
const find=(a,id)=>a.find(o=>o.id===id);
const seed=()=>[{id:"s1",note:""},{id:"s2",note:""},{id:"s3",note:""}];

console.log("\n=== תרחיש מצב-טיסה מקצה-לקצה: עריכה אינה אובדת ===");
{
  const pending=new Map();
  const server=seed();                 // מצב השרת המאושר
  const base=baseOf(server);
  const dev=seed(); find(dev,"s1").note="הערה חשובה";   // המשתמש ערך

  recordPending(pending, "stu", dev, base);              // נרשם *לפני* הכתיבה
  check("נרשמה כתיבה ממתינה", pending.size===1);

  // הכתיבה נכשלה (מצב טיסה) → מחזיקים; rebuild מהשרת (בלי ההערה) + applyPending
  let shown = applyStu(server, pending);
  check("אחרי כשל אופליין — ההערה עדיין מוצגת", find(shown,"s1").note==="הערה חשובה");
  check("הממתין נשמר (לא אבד)", pending.size===1);

  // סנאפשוט נוסף באופליין (עדיין השרת הישן) — עדיין מוחזק
  shown = applyStu(server, pending);
  check("סנאפשוט אופליין חוזר — ההערה עדיין מוצגת", find(shown,"s1").note==="הערה חשובה");

  // הרשת חזרה, הכתיבה הצליחה → השרת כולל את ההערה → האישור מנקה את הממתין
  const serverAfter=seed(); find(serverAfter,"s1").note="הערה חשובה";
  shown = applyStu(serverAfter, pending);
  check("אחרי אישור-שרת — ההערה קיימת (מהשרת)", find(shown,"s1").note==="הערה חשובה");
  check("הממתין שוחרר (אושר)", pending.size===0);
  check("אין כפילות", shown.filter(o=>o.id==="s1").length===1);
}

console.log("\n=== מחיקה אופליין — לא 'קופצת חזרה', ונשמרת בסוף ===");
{
  const pending=new Map();
  const server=seed(); const base=baseOf(server);
  const dev=server.filter(o=>o.id!=="s2");   // מחקנו את s2
  recordPending(pending, "stu", dev, base);
  let shown=applyStu(server, pending);
  check("s2 לא מוצג (מחיקה אופטימית מוחזקת)", !find(shown,"s2") && shown.length===2);
  const serverAfter=server.filter(o=>o.id!=="s2");   // אושר בשרת
  shown=applyStu(serverAfter, pending);
  check("אחרי אישור — s2 מחוק והממתין שוחרר", !find(shown,"s2") && pending.size===0);
}

console.log("\n=== הוספה אופליין — מוחזקת עד אישור ===");
{
  const pending=new Map();
  const server=seed(); const base=baseOf(server);
  const dev=server.concat([{id:"s4",note:"חדשה"}]);
  recordPending(pending, "stu", dev, base);
  let shown=applyStu(server, pending);
  check("ההוספה מוצגת אופליין", !!find(shown,"s4") && shown.length===4);
  const serverAfter=server.concat([{id:"s4",note:"חדשה"}]);
  shown=applyStu(serverAfter, pending);
  check("אחרי אישור — s4 קיים פעם אחת והממתין שוחרר", shown.filter(o=>o.id==="s4").length===1 && pending.size===0);
}

console.log("\n=== נסיגה: עריכת-אחר על אותה רשומה גוברת (לא מחזירים לאחור עריכה של אחר) ===");
{
  const pending=new Map();
  const server=seed(); const base=baseOf(server);
  const dev=seed(); find(dev,"s1").note="שלי";
  recordPending(pending, "stu", dev, base);
  const serverOther=seed(); find(serverOther,"s1").note="של אחר";  // מישהו אחר שמר קודם
  const shown=applyStu(serverOther, pending);
  check("מוצג ערך האחר (נסיגה)", find(shown,"s1").note==="של אחר");
  check("הממתין שוחרר", pending.size===0);
}

console.log("\n=== מכונת-מצב החיווי: לא 'נשמר' מטעה; 'טרם נשמר' רק בכשל אמיתי ===");
{
  const pending=new Map();
  const server=seed(); const base=baseOf(server);
  const dev=seed(); find(dev,"s1").note="x";
  recordPending(pending, "stu", dev, base);
  const S=makeStatus(pending);

  S.setSyncStatus("pending");                 // שמירה מתחילה
  check("בזמן שמירה — 'מסנכרן'", S.get().pill==="pending");

  S.onFail();                                 // הכתיבה נכשלה
  check("כשל — 'טרם נשמר'", S.get().pill==="טרם נשמר" && S.get().saveFailed);
  S.setSyncStatus("synced");                  // קריאה מהשרת עובדת
  check("קריאה 'synced' לא מסתירה — עדיין 'טרם נשמר'", S.get().pill==="טרם נשמר");

  // ניסיון חוזר שהצליח (ממתין לאישור-שרת); קריאה מהשרת שמגיעה לפני האישור לא תציג "נשמר" מטעה
  S.setSyncStatus("pending"); S.onSuccessAwaitEcho();
  S.setSyncStatus("synced"); // סנאפשוט-קריאה מגיע לפני שהאישור ניקה את _pending
  check("אחרי הצלחה, לפני אישור — 'מסנכרן' ולא 'נשמר' מטעה", S.get().pill==="מסנכרן" && !S.get().saveFailed);

  // הסנאפשוט אישר → applyPending ניקה את הממתין
  applyStu((()=>{ const s=seed(); find(s,"s1").note="x"; return s; })(), pending);
  S.afterSnapshot(false);
  check("אחרי אישור — 'נשמר' והממתין ריק", S.get().pill==="synced" && S.get().size===0);
}

console.log("\n=== שמירה רגילה (בלי כשל) — אין ממתינים תקועים ===");
{
  const pending=new Map();
  const server=seed(); const base=baseOf(server);
  recordPending(pending, "stu", server.map(o=>({...o})), base); // אין שינוי אמיתי
  check("שמירה בלי שינוי אינה יוצרת ממתין", pending.size===0);
}

console.log("\n============================================");
console.log(`תוצאה: ${pass} עברו · ${fail} נכשלו`);
console.log("============================================\n");
process.exit(fail ? 1 : 0);
