/* בדיקת "למה זה מנהל/ת" — ארבעה מקורות למנהל/ת עיר, והמסך מציג את כולם.
   התקלה: חשבון שאינו ברשימת "מנהלי מערכת" של העיר קיבל בכל זאת את ניהול המשתמשים —
   כי הוא מנהל/ת מכוח המרשם המרכזי / מרכז / בעלים, והמסך לא אמר זאת.
   הרצה:  node tests/admin-why.test.cjs */
const fs=require('fs'), path=require('path'), vm=require('vm');
const SRC=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
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
const line=d=>{ const a=SRC.indexOf(d); return SRC.slice(a, SRC.indexOf('\n',a)); };
const code=[ line('const OWNER_EMAILS'), line('function isOwnerEmail('), grab('function orgUser('), grab('function isHQ('), grab('function cityRole('), grab('function isAdmin('), grab('function adminWhy('), grab('function effectiveAdmins(') ].join('\n');
const ctx={ String, Array, Map, Set, Object, currentUser:{email:'x@y.z'}, CITY:{id:'modiin-illit'},
  ORG:{ users:{ 'hq@y.z':{hq:true}, 'regadmin@y.z':{cities:{'modiin-illit':'admin'}}, 'editor@y.z':{cities:{'modiin-illit':'edit'}} } },
  DB:{ settings:{ admins:['cityadmin@y.z'] } }, myEmail(){ return ctx.currentUser.email; } };
vm.createContext(ctx); vm.runInContext(code+';this.isAdmin=isAdmin;this.adminWhy=adminWhy;this.effectiveAdmins=effectiveAdmins;', ctx);
let pass=0, fail=0; const check=(n,c,d)=>{ if(c){pass++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n+(d?'  → '+d:''));} };
const as=e=>{ ctx.currentUser={email:e}; return { admin:ctx.isAdmin(), why:ctx.adminWhy() }; };
let r;
r=as('sg@taharat.org');     check('בעלים — מנהל/ת, עם הסבר', r.admin && /בעלי/.test(r.why));
r=as('hq@y.z');             check('מרכז — מנהל/ת, עם הסבר', r.admin && /מרכז/.test(r.why));
r=as('regadmin@y.z');       check('"מנהל/ת עיר" במרשם — מנהל/ת, עם הסבר', r.admin && /מרשם/.test(r.why));
r=as('cityadmin@y.z');      check('ברשימת העיר — מנהל/ת, עם הסבר', r.admin && /רשימת/.test(r.why));
r=as('editor@y.z');         check('עריכה במרשם — לא מנהל/ת', !r.admin && r.why==='');
r=as('nobody@y.z');         check('לא מוכר/ת — לא מנהל/ת', !r.admin && r.why==='');
const all=ctx.effectiveAdmins();
check('רשימת המנהלים בפועל כוללת את כל המקורות', ['sg@taharat.org','hq@y.z','regadmin@y.z','cityadmin@y.z'].every(e=>all.get(e)));
check('ולא כוללת עורך/ת', !all.has('editor@y.z'));
check('adminWhy מסכים עם isAdmin בכל המקרים', ['sg@taharat.org','hq@y.z','regadmin@y.z','cityadmin@y.z','editor@y.z','nobody@y.z'].every(e=>{ const r=as(e); return r.admin===!!r.why; }));
console.log(`\n${pass} עברו · ${fail} נכשלו`); process.exit(fail?1:0);
