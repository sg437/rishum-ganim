/* בדיקת שמירת המרשם במרכזי — מיזוג לפי רשומה, לא דריסה.
   התרחיש: שני משתמשי מרכז (או מסך ישן) עורכים את המרשם במקביל. כל אחד שומר רק את מה
   שהוא שינה — ולא מוחק את מה שהשני הוסיף בינתיים.
   הרצה:  node tests/org-merge.test.cjs */
const fs=require('fs'), path=require('path'), vm=require('vm');
const SRC=fs.readFileSync(path.join(__dirname,'..','management.html'),'utf8');
function grab(decl){
  const at=SRC.indexOf(decl); if(at<0) throw new Error('לא נמצא: '+decl);
  let i=SRC.indexOf('{',at), depth=0, inLine=false, inBlock=false, q='', esc=false;
  for(let j=i;j<SRC.length;j++){ const c=SRC[j], n=SRC[j+1];
    if(esc){esc=false;continue;} if(q){ if(c==='\\') esc=true; else if(c===q) q=''; continue; }
    if(inLine){ if(c==='\n') inLine=false; continue; } if(inBlock){ if(c==='*'&&n==='/'){inBlock=false;j++;} continue; }
    if(c==='/'&&n==='/'){inLine=true;j++;continue;} if(c==='/'&&n==='*'){inBlock=true;j++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='{') depth++; else if(c==='}'){ depth--; if(!depth) return SRC.slice(at,j+1); } }
  throw new Error('סוגריים: '+decl);
}
const sb={ Map, Object, JSON, Array, String };
vm.createContext(sb);
vm.runInContext(['function lower(s){ return String(s||"").toLowerCase(); }', grab('function normOrg('), grab('function _canonOrg('), grab('function orgDiff('), grab('function orgApply(')].join('\n'), sb);
const G=k=>vm.runInContext(k, sb), J=JSON.stringify;
let pass=0, fail=0; const check=(n,c,d)=>{ if(c){pass++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n+(d?'  → '+d:''));} };

const start={ cities:[{ id:'beitar', name:'ביתר' }], users:{ 'a@x.com':{ name:'א', cities:{ beitar:'edit' } } } };
// שני מסכים פתוחים על אותו מרשם
const screenA=JSON.parse(J(start)), screenB=JSON.parse(J(start));
let server=JSON.parse(J(start));
// א' מוסיף/ה משתמש/ת ושומר/ת
const nextA=JSON.parse(J(screenA)); nextA.users['new@x.com']={ name:'חדשה', cities:{ beitar:'edit' } };
server=G('orgApply')(G('normOrg')(server), G('orgDiff')(G('normOrg')(screenA), G('normOrg')(nextA)));
// ב' (מסך ישן — לא רואה את החדשה) משנה תפקיד ושומר/ת
const nextB=JSON.parse(J(screenB)); nextB.users['a@x.com'].cities.beitar='admin'; nextB.cities.push({ id:'ashdod', name:'אשדוד' });
server=G('orgApply')(G('normOrg')(server), G('orgDiff')(G('normOrg')(screenB), G('normOrg')(nextB)));
check('המשתמשת ש-א\' הוסיף/ה — לא נמחקה ע"י השמירה של ב\'', !!server.users['new@x.com'], J(server.users));
check('השינוי של ב\' נשמר', server.users['a@x.com'].cities.beitar==='admin' && server.cities.some(c=>c.id==='ashdod'));
// מחיקה מכוונת — עובדת
const screenC=JSON.parse(J(server)), nextC=JSON.parse(J(screenC)); delete nextC.users['new@x.com'];
server=G('orgApply')(G('normOrg')(server), G('orgDiff')(G('normOrg')(screenC), G('normOrg')(nextC)));
check('מחיקה מכוונת של משתמש/ת — מתבצעת', !server.users['new@x.com']);
check('ושאר המרשם נשאר', server.users['a@x.com'] && server.cities.length===2);
const d0=G('orgDiff')(G('normOrg')(server), G('normOrg')(JSON.parse(J(server))));
check('בלי שינוי — אין מה לכתוב', !d0.cSet.length && !d0.cDel.length && !d0.uSet.length && !d0.uDel.length);
check('saveOrg כותב בטרנזקציה ממוזגת, לא setDoc של כל המסמך', /runTransaction\(db, async tx=>\{\s*const snap=await tx\.get\(ref\);\s*const merged=orgApply/.test(grab('async function saveOrg(')) && !/setDoc\(doc\(db,"org","meta"\), payload\)/.test(SRC));
console.log(`\n${pass} עברו · ${fail} נכשלו`); process.exit(fail?1:0);
