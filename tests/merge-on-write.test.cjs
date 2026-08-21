/* ============================================================================
   בדיקת "מיזוג במקום דריסה" (merge-on-write) — מנעול נגד דריסה
   ----------------------------------------------------------------------------
   הבדיקה משחזרת את תקלת הדריסה שקרתה בייצור (שני מכשירים כותבים במקביל וכל אחד
   דורס את השני), ומוכיחה שהמנגנון החדש (merge-on-write עם בדיקת גרסה) פותר אותה.

   אין כאן שום גישה לנתונים אמיתיים / Firebase — סימולציה טהורה ב-Node.
   הרצה:  node tests/merge-on-write.test.cjs
   ============================================================================ */

/* ---- מודל "שרת" למסמך students_<year>: רשימת תלמידות + גרסה (rev) ---- */
function makeServer(students){
  return { students: students.map(s=>({...s})), rev: 1 };
}
function serverList(srv){ return srv.students.map(s=>({...s})); }

/* ---- המצב הישן (הבאג): כתיבה מלאה שדורסת הכל ---- */
function pushOverwrite(srv, localStudents){
  srv.students = localStudents.map(s=>({...s}));   // דריסה מוחלטת
  srv.rev++;
}

/* ---- המנגנון החדש: מיזוג טרנזקציוני עם בדיקת גרסה ----
   מחשב את השינוי של המכשיר (מול baseline מהסנכרון האחרון), ומחיל אותו על
   העותק *העדכני* של השרת. אם הגרסה השתנתה תוך כדי — קורא מחדש וממזג שוב (retry). */
function jkey(o){ return JSON.stringify(o); }
function diffAgainstBaseline(local, baseline){
  const curr = new Map(local.map(s=>[s.id, s]));
  const changed=[], deleted=[];
  for(const [id,s] of curr){ if(baseline.get(id) !== jkey(s)) changed.push(s); }
  for(const id of baseline.keys()){ if(!curr.has(id)) deleted.push(id); }
  return { changed, deleted };
}
function pushMerge(srv, device){
  const { changed, deleted } = diffAgainstBaseline(device.local, device.baseline);
  // טרנזקציה: קרא את השרת העדכני, מזג, כתוב. חזור אם הגרסה השתנתה בין הקריאה לכתיבה.
  for(let attempt=0; attempt<5; attempt++){
    const readRev = srv.rev;
    const merged = new Map(serverList(srv).map(s=>[s.id, s]));   // המצב העדכני מהשרת
    for(const s of changed) merged.set(s.id, {...s});            // החל את השינויים שלי
    for(const id of deleted) merged.delete(id);
    // "commit" מותנה בכך שאיש לא כתב בינתיים (rev לא השתנה)
    if(srv.rev === readRev){
      srv.students = [...merged.values()];
      srv.rev++;
      // עדכן את בסיס-ההשוואה של המכשיר למצב שנכתב
      device.baseline = new Map(srv.students.map(s=>[s.id, jkey(s)]));
      return { ok:true, attempts:attempt+1 };
    }
    // אחרת: מישהו כתב בינתיים — הלולאה תקרא מחדש (retry)
  }
  return { ok:false };
}

/* ---- כלי בדיקה ---- */
let pass=0, fail=0;
function check(name, cond, detail){
  if(cond){ pass++; console.log("  ✓ "+name); }
  else { fail++; console.log("  ✗ "+name+(detail?("  → "+detail):"")); }
}
function loadDevice(srv){ // מכשיר טוען מצב עדכני מהשרת
  const local = serverList(srv);
  return { local, baseline:new Map(local.map(s=>[s.id, jkey(s)])) };
}
function findNote(srv, id){ const s=srv.students.find(x=>x.id===id); return s?s.notes:undefined; }

/* בסיס נתונים לדוגמה: 5 תלמידות */
function seed(){ return [
  {id:"s1", name:"שרה",  notes:""},
  {id:"s2", name:"רבקה", notes:""},
  {id:"s3", name:"מרים", notes:""},
  {id:"s4", name:"חנה",  notes:""},
  {id:"s5", name:"לאה",  notes:""},
]; }

console.log("\n=== תרחיש 1: שני מכשירים עורכים תלמידות *שונות* במקביל ===");
{
  // המצב הישן — דריסה
  const srv = makeServer(seed());
  const A = loadDevice(srv), B = loadDevice(srv);
  A.local.find(s=>s.id==="s1").notes = "הערה מ-A";   // A עורך את שרה
  B.local.find(s=>s.id==="s2").notes = "הערה מ-B";   // B עורך את רבקה
  pushOverwrite(srv, A.local);   // A שומר
  pushOverwrite(srv, B.local);   // B שומר (דורס)
  console.log("  [מצב ישן / דריסה] — מצופה שהבאג ישוחזר (אובדן נתונים):");
  check("הבאג משוחזר: הערת A נדרסה ואבדה", findNote(srv,"s1")==="", "התקבל: "+JSON.stringify(findNote(srv,"s1")));
}
{
  // המצב החדש — מיזוג
  const srv = makeServer(seed());
  const A = loadDevice(srv), B = loadDevice(srv);
  A.local.find(s=>s.id==="s1").notes = "הערה מ-A";
  B.local.find(s=>s.id==="s2").notes = "הערה מ-B";
  pushMerge(srv, A);
  pushMerge(srv, B);
  console.log("  [מצב חדש / מיזוג]");
  check("הערה של A שרדה", findNote(srv,"s1")==="הערה מ-A", "התקבל: "+JSON.stringify(findNote(srv,"s1")));
  check("הערה של B שרדה", findNote(srv,"s2")==="הערה מ-B", "התקבל: "+JSON.stringify(findNote(srv,"s2")));
}

console.log("\n=== תרחיש 2: מכשיר ישן (בלי 2 תלמידות שנוספו) שומר — שחזור התקלה של היום ===");
{
  // שרת כבר מכיל 6 (הצוות הוסיף אחת), אבל מכשיר ישן עדיין על 5 ושומר עריכה
  const srvSeed = seed();
  const srv = makeServer(srvSeed);
  const stale = loadDevice(srv);                 // המכשיר הישן נטען כשהיו 5
  // בינתיים מישהו אחר הוסיף תלמידה (במכשיר אחר) והמצב בשרת עלה ל-6
  const other = loadDevice(srv);
  other.local.push({id:"s6", name:"תמר", notes:"נרשמה היום"});
  console.log("  [מצב ישן / דריסה]");
  {
    const srvOld = makeServer(srvSeed);
    const st = loadDevice(srvOld);
    const ot = loadDevice(srvOld); ot.local.push({id:"s6", name:"תמר", notes:"נרשמה היום"});
    pushOverwrite(srvOld, ot.local);                 // המכשיר האחר שמר → 6
    st.local.find(s=>s.id==="s1").notes="עריכה קטנה"; // המכשיר הישן עורך משהו אחר ושומר
    pushOverwrite(srvOld, st.local);                 // דורס → חוזר ל-5!
    check("הבאג משוחזר: התלמידה שנוספה נדרסה ואבדה", !srvOld.students.some(s=>s.id==="s6"), "כמות: "+srvOld.students.length);
  }
  console.log("  [מצב חדש / מיזוג]");
  {
    pushMerge(srv, other);                            // המכשיר האחר שמר → 6
    stale.local.find(s=>s.id==="s1").notes="עריכה קטנה"; // הישן עורך ושומר
    pushMerge(srv, stale);
    check("התלמידה שנוספה שרדה", srv.students.some(s=>s.id==="s6"), "כמות: "+srv.students.length);
    check("גם העריכה של המכשיר הישן נשמרה", findNote(srv,"s1")==="עריכה קטנה");
    check("סה\"כ 6 תלמידות", srv.students.length===6, "כמות: "+srv.students.length);
  }
}

console.log("\n=== תרחיש 3: הוספה במכשיר אחד + מחיקה במכשיר אחר, במקביל ===");
{
  const srv = makeServer(seed());
  const A = loadDevice(srv), B = loadDevice(srv);
  A.local.push({id:"s6", name:"תמר", notes:""});      // A מוסיף
  B.local = B.local.filter(s=>s.id!=="s3");            // B מוחק את מרים
  pushMerge(srv, A);
  pushMerge(srv, B);
  check("ההוספה של A נשמרה (s6 קיים)", srv.students.some(s=>s.id==="s6"));
  check("המחיקה של B נשמרה (s3 נמחק)", !srv.students.some(s=>s.id==="s3"));
  check("סה\"כ 5 תלמידות (5+1-1)", srv.students.length===5, "כמות: "+srv.students.length);
}

console.log("\n=== תרחיש 4: שני מכשירים עורכים את *אותה* תלמידה (התנגשות אמיתית) ===");
{
  const srv = makeServer(seed());
  const A = loadDevice(srv), B = loadDevice(srv);
  A.local.find(s=>s.id==="s1").notes = "מ-A";
  B.local.find(s=>s.id==="s1").notes = "מ-B";
  pushMerge(srv, A);
  pushMerge(srv, B);
  // כאן דריסה *מכוונת* על אותו שדה מקובלת (אחד מנצח) — העיקר ששאר הנתונים שלמים
  check("אחד מהערכים נשמר (בלי אובדן רשומות אחרות)", ["מ-A","מ-B"].includes(findNote(srv,"s1")), "התקבל: "+JSON.stringify(findNote(srv,"s1")));
  check("כל 5 התלמידות עדיין קיימות", srv.students.length===5, "כמות: "+srv.students.length);
}

console.log("\n=== תרחיש 5: 20 מכשירים עורכים 20 תלמידות שונות במקביל (עומס) ===");
{
  const big=[]; for(let i=1;i<=20;i++) big.push({id:"s"+i, name:"ת"+i, notes:""});
  const srv = makeServer(big);
  const devices=[];
  for(let i=1;i<=20;i++){ const d=loadDevice(srv); d.local.find(s=>s.id==="s"+i).notes="ערך "+i; devices.push(d); }
  // כולם שומרים במקביל (מיזוג, עם retry על התנגשות גרסה)
  for(const d of devices) pushMerge(srv, d);
  let allKept=true; for(let i=1;i<=20;i++){ if(findNote(srv,"s"+i)!=="ערך "+i) allKept=false; }
  check("כל 20 העריכות נשמרו (אף אחת לא נדרסה)", allKept);
}

console.log("\n============================================");
console.log(`תוצאה: ${pass} עברו · ${fail} נכשלו`);
console.log("============================================\n");
process.exit(fail? 1 : 0);
