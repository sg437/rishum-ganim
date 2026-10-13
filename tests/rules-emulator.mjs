/* ============================================================================
   בדיקת כללי השרת (firestore.rules) באמולטור הרשמי של Firebase
   ----------------------------------------------------------------------------
   מריצה את הכללים האמיתיים מול כל סוג משתמש × כל פעולה, ומדפיסה טבלה.
   כך נמצאה התקלה "אין הרשאה" אצל מנהלת עיר: הכללים הקודמים קראו את org/meta
   עשרות פעמים בבדיקה אחת, ואצל מי שמופיע/ה במרשם המנוע עצר ב-"maximum of 1000
   expressions to evaluate" — וענה "אין הרשאה" למרות שכל תנאי לבדו התקיים.

   דורשת Java + firebase-tools + @firebase/rules-unit-testing (לא חלק מבדיקות ה-CI):
     npm i firebase-tools@13 @firebase/rules-unit-testing@3 firebase@10
     echo '{"emulators":{"firestore":{"port":8089}}}' > firebase.json
     npx firebase emulators:exec --only firestore --project rishum-rules "node tests/rules-emulator.mjs firestore.rules"
   הציפייה (✓ = מותר, · = חסום):
     owner/hq — הכול · מנהל/ת עיר (במרשם או ברשימת העיר) — הכול בעיר שלו/ה כולל הרשאות ·
     עריכה — קריאה וכתיבה בלי שינוי הרשאות · צפייה — קריאה בלבד · זר/ה — כלום ·
     עיר אחרת — רק העיר שלו/ה · מסמכים ישנים אחרי המעבר — חסומים לכולם.
   ============================================================================ */
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, collection, getDocs, query, limit } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'rishum-full', firestore:{ rules: readFileSync(process.argv[2]||'firestore.rules','utf8'), host:'127.0.0.1', port:8089 } });
const U={ owner:'sg@taharat.org', hq:'yw4514613@gmail.com', regAdmin:'regadmin@x.com', regEdit:'regedit@x.com', regView:'regview@x.com',
          her:'rg9740817@gmail.com', listAdmin:'listadmin@x.com', allowed:'shoshi4639@gmail.com', stranger:'stranger@x.com', otherCity:'jer@x.com', herNoRole:'norole@x.com' };
const users={}; const many={}; for(let i=0;i<40;i++) many['u'+i+'@x.com']={ name:'u'+i, cities:{ 'modiin-illit':'edit' } };
Object.assign(users, many, {
  [U.hq]:{ hq:true }, [U.regAdmin]:{ cities:{ 'modiin-illit':'admin' } }, [U.regEdit]:{ cities:{ 'modiin-illit':'edit' } },
  [U.regView]:{ cities:{ 'modiin-illit':'view' } }, [U.her]:{ name:'R', hq:false, cities:{ 'modiin-illit':'admin' } },
  [U.otherCity]:{ cities:{ jerusalem:'edit' } }, [U.herNoRole]:{ cities:{} } });
const meta={ model:'recs', activeYear:'x', settings:{ admins:['7684252sg@gmail.com', U.her, U.listAdmin, U.herNoRole], allowedEmails:[U.allowed, U.regView], userActivity:{} } };
async function seed(){ await env.clearFirestore(); await env.withSecurityRulesDisabled(async c=>{ const db=c.firestore();
  await setDoc(doc(db,'app/meta'), meta); await setDoc(doc(db,'org/meta'), { cities:[{id:'jerusalem'}], users });
  await setDoc(doc(db,'app/r_s_a'), { _t:'rec' }); await setDoc(doc(db,'cities/jerusalem/app/meta'), { settings:{ admins:[] } }); await setDoc(doc(db,'org/hq'), {}); }); }
const ok=async p=>{ try{ await p; return '✓'; }catch(e){ return '·'; } };
const OPS={
  'קריאה':       db=>getDoc(doc(db,'app/meta')),
  'רשימה':       db=>getDocs(query(collection(db,'app'), limit(1))),
  'כתיבת תיק':   db=>setDoc(doc(db,'app/r_s_new'), { _t:'rec' }),
  'meta רגיל':   db=>setDoc(doc(db,'app/meta'), { updatedAt:1 }, { mergeFields:['updatedAt'] }),
  'meta הרשאות': db=>setDoc(doc(db,'app/meta'), { settings:{ admins:['evil@x.com'] } }, { mergeFields:['settings.admins'] }),
  'ישן חסום':    db=>setDoc(doc(db,'app/students_x'), { students:[] }),
  'ירושלים ק':   db=>getDoc(doc(db,'cities/jerusalem/app/meta')),
  'ירושלים כ':   db=>setDoc(doc(db,'cities/jerusalem/app/r_s_a'), { _t:'rec' }),
  'org ק':       db=>getDoc(doc(db,'org/meta')),
  'org כ':       db=>setDoc(doc(db,'org/meta'), { x:1 }, { merge:true }),
  'hq ק':        db=>getDoc(doc(db,'org/hq')),
};
console.log('משתמש'.padEnd(10), Object.keys(OPS).join(' | '));
for(const [k,em] of Object.entries(U)){
  const row=[];
  for(const [op,fn] of Object.entries(OPS)){ await seed(); const db=env.authenticatedContext('uid-'+k,{ email:em, email_verified:true }).firestore(); row.push(await ok(fn(db))); }
  console.log(k.padEnd(10), row.join('     '));
}
await env.cleanup();
