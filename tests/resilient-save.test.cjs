/* ============================================================================
   בדיקת "שמירה עמידה לרשת חלשה" (resilient save)
   ----------------------------------------------------------------------------
   בסלולרי לא-יציב כתיבת ה-SDK נכשלת לסירוגין (זורקת שגיאה מהר, לא רק "נתקעת").
   קודם לא היה מנגנון התאוששות על שגיאה מהירה — הכתיבה פשוט לא נקלטה, בשקט.
   כאן נבדקים שני החלקים של index.html:
     1) מדיניות ההתאוששות (recoverFailedWrite): ניסיון חוזר על אותו ערוץ ואז
        מעבר לערוץ חלופי (REST); מחזיר איך/אם נשמר.
     2) מכונת-המצב של אזהרת "שינוי לא נשמר" (markWriteFailed / clearWriteFailed /
        הבודק ב-setSyncStatus): נדלקת בכשל, לא נכבית מקריאה מוצלחת ("synced"),
        ונכבית רק בשמירה מוצלחת.
   סימולציה טהורה ב-Node, בלי Firebase.  הרצה: node tests/resilient-save.test.cjs
   ============================================================================ */

/* ---- מדיניות ההתאוששות (זהה ללולאה ב-recoverFailedWrite) ----
   sdk/rest הן פונקציות async שזורקות בכשל; מחזיר "sdk" / "rest" / "fail". */
async function recover({ sdk, rest, sleep = async()=>{}, retries = 2 }){
  for(let i=0; i<retries; i++){
    await sleep(i);
    try{ await sdk(); return "sdk"; }
    catch(_){ /* ניסיון הבא */ }
  }
  try{ await rest(); return "rest"; }
  catch(_){ return "fail"; }
}
/* עוזר: פונקציית-כתיבה שנכשלת failCount פעמים ואז מצליחה */
function flaky(failCount){
  let n=0;
  return async()=>{ if(n++ < failCount) throw new Error("net"); return true; };
}
const always = ()=>{ throw new Error("net"); };  // תמיד נכשל (async דרך recover)
const alwaysFail = async()=>{ throw new Error("net"); };

/* ---- מכונת-המצב של האזהרה (זהה ל-index.html) ---- */
function makeStatus(){
  let writeFailed=false, pill="", banner=false;
  return {
    // setSyncStatus עם הבודק: כל עוד writeFailed ומצב אינו "pending" — מציג אזהרה
    setSyncStatus(state){
      if(writeFailed && state!=="pending"){ pill="שינוי לא נשמר"; return; }
      pill = state;
    },
    markWriteFailed(){ writeFailed=true; banner=true; this.setSyncStatus("error"); },
    clearWriteFailed(){ if(!writeFailed) return; writeFailed=false; banner=false; this.setSyncStatus("synced"); },
    get(){ return { writeFailed, pill, banner }; }
  };
}

/* ---- כלי בדיקה ---- */
let pass=0, fail=0;
function check(name, cond, detail){
  if(cond){ pass++; console.log("  ✓ "+name); }
  else { fail++; console.log("  ✗ "+name+(detail?("  → "+detail):"")); }
}
const run = (async()=>{

console.log("\n=== מדיניות התאוששות ===");
{
  // הערה: recoverFailedWrite נקרא *אחרי* שהניסיון הראשון (ב-runPush) כבר נכשל.
  // כאן sdk מתחיל "טרי" — כלומר מדמה את הניסיונות החוזרים בלבד.
  const r1 = await recover({ sdk: flaky(0), rest: alwaysFail });      // מצליח מיד בניסיון החוזר
  check("ניסיון חוזר על אותו ערוץ מצליח → 'sdk'", r1==="sdk", "התקבל: "+r1);

  const r2 = await recover({ sdk: flaky(1), rest: alwaysFail });      // נכשל פעם, אז מצליח
  check("כשל רגעי ואז הצלחה בניסיון הבא → 'sdk'", r2==="sdk", "התקבל: "+r2);

  const r3 = await recover({ sdk: always, rest: flaky(0) });          // SDK מת, REST מציל
  check("SDK נכשל בכל הניסיונות, REST מצליח → 'rest'", r3==="rest", "התקבל: "+r3);

  const r4 = await recover({ sdk: always, rest: alwaysFail });        // הכול נכשל
  check("הכול נכשל → 'fail'", r4==="fail", "התקבל: "+r4);

  // מונה הניסיונות: עם retries=2, SDK שמצליח רק בפעם ה-3 לא ייתפס ע"י הניסיונות (2) → REST
  let calls=0;
  const r5 = await recover({ sdk: async()=>{ calls++; if(calls<3) throw new Error("net"); }, rest: flaky(0), retries:2 });
  check("2 ניסיונות בלבד על SDK ואז REST", r5==="rest" && calls===2, "channel="+r5+" calls="+calls);
}

console.log("\n=== אזהרת 'שינוי לא נשמר' (מכונת-מצב) ===");
{
  const S = makeStatus();
  S.setSyncStatus("synced");
  check("מצב תקין: 'synced'", S.get().pill==="synced");

  S.markWriteFailed();
  check("כשל-כתיבה מדליק אזהרה", S.get().writeFailed && S.get().pill==="שינוי לא נשמר");
  check("הבאנר מוצג", S.get().banner===true);

  // קריאה מוצלחת מהשרת לא אמורה 'לכבות' את האזהרה (הבאג המקורי)
  S.setSyncStatus("synced");
  check("קריאה 'synced' לא מסתירה את האזהרה (sticky)", S.get().pill==="שינוי לא נשמר");
  S.setSyncStatus("offline");
  check("גם 'offline' לא מסתיר את האזהרה", S.get().pill==="שינוי לא נשמר");

  // ניסיון-חוזר פעיל ('pending') כן מותר להציג
  S.setSyncStatus("pending");
  check("'מסנכרן' (ניסיון חוזר) כן מוצג", S.get().pill==="pending");

  // שמירה מוצלחת מנקה הכול
  S.clearWriteFailed();
  check("שמירה מוצלחת מכבה את האזהרה", !S.get().writeFailed && S.get().pill==="synced" && S.get().banner===false);

  // ומכאן קריאה רגילה מתנהגת כרגיל
  S.setSyncStatus("pending"); S.setSyncStatus("synced");
  check("אחרי ניקוי — החיווי חוזר להתנהג רגיל", S.get().pill==="synced");
}

console.log("\n=== שמירה רגילה (בלי כשל) לא מפעילה אזהרה ===");
{
  const S = makeStatus();
  S.setSyncStatus("pending");   // שמירה מתחילה
  S.setSyncStatus("synced");    // onSnapshot מאשר
  check("אין אזהרה כשהכול תקין", !S.get().writeFailed && S.get().pill==="synced");
  S.clearWriteFailed();         // no-op כשלא היה כשל
  check("clearWriteFailed בלי כשל = ללא שינוי", S.get().pill==="synced");
}

console.log("\n============================================");
console.log(`תוצאה: ${pass} עברו · ${fail} נכשלו`);
console.log("============================================\n");
process.exit(fail ? 1 : 0);
});
run();
