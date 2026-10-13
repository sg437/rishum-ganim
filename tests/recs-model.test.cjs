/* ============================================================================
   בדיקת "מסמך לכל רשומה" (RECS) — המבנה החדש של הנתונים, והמעבר אליו
   ----------------------------------------------------------------------------
   נבדק — על הקוד שנשלף מ-index.html ומ-management.html עצמם:
     1. מזהי המסמכים: יציבים, חוקיים, וזהים בתוכנת העיר ובמרכזי.
     2. המעבר: כל רשומה מהמבנה הישן נכתבת, האימות עובר, ובנייה מהמבנה החדש
        מחזירה בדיוק את אותן רשימות באותו סדר.
     3. האימות תופס רשומה חסרה או שונה — ואז אין מעבר.
     4. עריכה: נכתבת רק הרשומה שהשתנתה (תלמידה אחת = מסמך אחד), מחיקה = מחיקת
        המסמך, רשומה חדשה — בסוף הסדר.
     5. המרכזי בונה מאותם מסמכים את אותו סדר.
     6. כללי השרת חוסמים כתיבה למסמכים הישנים אחרי המעבר.
   הרצה:  node tests/recs-model.test.cjs
   ============================================================================ */
const fs=require('fs'), path=require('path'), vm=require('vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const SRC=read('index.html'), MGMT=read('management.html'), RULES=read('firestore.rules');
function grabFrom(src, decl){
  const at=src.indexOf(decl); if(at<0) throw new Error('לא נמצא: '+decl);
  let i=src.indexOf('{',at), depth=0, inLine=false, inBlock=false, q='', esc=false;
  for(let j=i;j<src.length;j++){ const c=src[j], n=src[j+1];
    if(esc){esc=false;continue;} if(q){ if(c==='\\') esc=true; else if(c===q) q=''; continue; }
    if(inLine){ if(c==='\n') inLine=false; continue; } if(inBlock){ if(c==='*'&&n==='/'){inBlock=false;j++;} continue; }
    if(c==='/'&&n==='/'){inLine=true;j++;continue;} if(c==='/'&&n==='*'){inBlock=true;j++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='{') depth++; else if(c==='}'){ depth--; if(!depth) return src.slice(at,j+1); } }
  throw new Error('סוגריים: '+decl);
}
const lineFrom=(src,d)=>{ const a=src.indexOf(d); if(a<0) throw new Error('לא נמצא: '+d); return src.slice(a, src.indexOf('\n',a)); };
const grab=d=>grabFrom(SRC,d), line=d=>lineFrom(SRC,d);

const sb={ Date, Math, Object, Array, JSON, Map, Set, String, DB:{ students:[], gans:[], staff:[], management:[], activeYear:'תשפ"ז' } };
vm.createContext(sb);
vm.runInContext([
  'let _idn=0; function uid(){ return "u"+(++_idn); }',
  'let _stuKeys=null, _stuBlank=null;',
  'function myEmail(){ return "admin@example.com"; }',
  'function _mk(o){ return JSON.stringify(o); }',
  'const _mergeBase = { stu:new Map(), gan:new Map(), staff:new Map(), mgmt:new Map() };',
  grab('function makeStudent'), grab('function stuKeys'), grab('function stuBlank'),
  grab('function packStudent'), grab('function normStudent'), grab('function normStaff(m)'),
  grab('function refreshMergeBase'),
  line('const RECS_KINDS'), line('const _recOrd'),
  line('function _recHash('), grab('function recDocId('), grab('function recsListsFromDocs('),
  grab('function recDoc('), grab('function recsOps('),
  grab('function legacyListsFromDocs('), grab('function recsMigrationOps('), grab('function recsVerify('), grab('function recsLateOps('),
].join('\n'), sb);
const G=k=>vm.runInContext(k, sb);

let pass=0, fail=0; const check=(n,c,d)=>{ if(c){pass++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n+(d?'  → '+d:''));} };
const J=o=>JSON.stringify(o);

/* ---- נתונים ישנים לדוגמה: שתי שנים, גנים, צוות, הנהלה ---- */
const mkS=(id,year,extra)=>Object.assign(G('makeStudent')(), { id, year, firstName:'ילדה '+id, lastName:'משפחה' }, extra||{});
const legacy=new Map([
  ['meta', { years:['תשפ"ז','תשפ"ו'], activeYear:'תשפ"ז', settings:{} }],
  ['students_תשפ_ז', { year:'תשפ"ז', students:[mkS('s1','תשפ"ז'), mkS('s2','תשפ"ז',{ notes:'הערה', placed:true }), mkS('s/3','תשפ"ז')].map(s=>G('packStudent')(s)) }],
  ['students_תשפ_ו', { year:'תשפ"ו', students:[mkS('s4','תשפ"ו',{ finished:true })].map(s=>G('packStudent')(s)) }],
  ['gans',       { gans:[{ id:'g1', ganName:'גן א' }, { id:'g2', ganName:'גן ב', capacity:'30' }] }],
  ['staff',      { staff:[{ id:'t1', name:'כהן רחל', role:'סייעת' }] }],
  ['management', { management:[{ id:'m1', name:'מנהלת' }] }],
  ['presence_x', { _t:'presence', ts:1 }],
]);

console.log('1) מזהי מסמכים');
const recDocId=G('recDocId');
check('מזהה רגיל — כפי שהוא, עם קידומת לפי סוג', recDocId('stu','s1')==='r_s_s1' && recDocId('gan','g1')==='r_g_g1' && recDocId('staff','t1')==='r_t_t1' && recDocId('mgmt','m1')==='r_m_m1');
check('מזהה עם תו אסור ("/") — מגובב, יציב וחוקי', /^r_s_x[0-9a-z]+$/.test(recDocId('stu','s/3')) && recDocId('stu','s/3')===recDocId('stu','s/3'));
check('אין התנגשות עם מסמכי "המודל הישן" (stu_/gan_) שמנוקים אוטומטית', !recDocId('stu','a').startsWith('stu_') && !recDocId('gan','a').startsWith('gan_'));
const fnI=grab('function recDocId(')+grabFrom(SRC,'function _recHash('), fnM=grabFrom(MGMT,'function recDocId(')+grabFrom(MGMT,'function _recHash(');
check('recDocId ו-_recHash זהים בתוכנת העיר ובמרכזי', fnI===fnM);

console.log('2) המעבר — כתיבה, אימות, ובנייה זהה');
const lists=G('legacyListsFromDocs')(legacy);
check('נקראו כל הרשומות מהמבנה הישן', lists.stu.length===4 && lists.gan.length===2 && lists.staff.length===1 && lists.mgmt.length===1);
const ops=G('recsMigrationOps')(lists);
check('מסמך לכל רשומה', ops.length===8 && new Set(ops.map(o=>o.id)).size===8);
const after=new Map(legacy); ops.forEach(op=>after.set(op.id, JSON.parse(J(op.data))));   // "השרת" אחרי הכתיבה (סבב JSON כמו Firestore)
check('האימות עובר כשהכול נכתב', G('recsVerify')(ops, after).length===0, J(G('recsVerify')(ops, after)));
const L=G('recsListsFromDocs')(after);
const norm=a=>a.map(x=>G('normStudent')(x));
check('תלמידות — אותן רשומות, אותו סדר', J(norm(L.s))===J(lists.stu));
check('גנים / צוות / הנהלה — אותן רשומות, אותו סדר', J(L.g)===J(lists.gan) && J(L.t.map(G('normStaff')))===J(lists.staff) && J(L.m)===J(lists.mgmt));
check('תלמידה שסומנה "סיימה" ושנה קודמת — נשמרות', norm(L.s).some(x=>x.id==='s4' && x.finished===true && x.year==='תשפ"ו'));

console.log('3) האימות תופס תקלה — ואז אין מעבר');
const missing=new Map(after); missing.delete('r_s_s2');
check('רשומה חסרה — מדווחת', G('recsVerify')(ops, missing).some(x=>x.includes('r_s_s2')));
const changed=new Map(after); const v=JSON.parse(J(changed.get('r_g_g2'))); v.d.capacity='99'; changed.set('r_g_g2', v);
check('רשומה שונה — מדווחת', G('recsVerify')(ops, changed).some(x=>x.includes('r_g_g2')));
check('הקוד מסמן את המעבר רק אחרי אימות נקי', (()=>{ const m=grab('async function migrateToRecs('); return m.indexOf('recsVerify(')>0 && m.indexOf('if(bad.length) throw')>m.indexOf('recsVerify(') && m.indexOf('model:"recs"')>m.indexOf('if(bad.length) throw'); })());

console.log('3ב) שינוי שנשמר בשניות של המעבר — מועתק גם למבנה החדש');
{ const last=new Map(after);
  const sd=JSON.parse(J(last.get('students_תשפ_ז'))); const n=G('normStudent')(sd.students[0]); n.notes='נשמר בזמן המעבר'; sd.students[0]=G('packStudent')(n);
  sd.students.push(G('packStudent')(mkS('s5','תשפ"ז'))); last.set('students_תשפ_ז', sd);
  const gd=JSON.parse(J(last.get('gans'))); gd.gans=gd.gans.filter(g=>g.id!=='g2'); last.set('gans', gd);
  const late=G('recsLateOps')(ops, last);
  check('תיק שנערך בזמן המעבר — נכתב שוב', late.some(o=>o.id==='r_s_s1' && o.data && o.data.d.notes==='נשמר בזמן המעבר'), J(late.map(o=>o.id)));
  check('תיק שנוסף בזמן המעבר — נכתב', late.some(o=>o.id==='r_s_s5' && o.data));
  check('גן שנמחק בזמן המעבר — נמחק גם בחדש', late.some(o=>o.id==='r_g_g2' && o.data===null));
  check('מה שלא השתנה — לא נכתב שוב', late.length===3, J(late.map(o=>o.id)));
  const newer=new Map(last); const v=JSON.parse(J(newer.get('r_s_s1'))); v.u=v.u+5000; v.d.notes='עריכה חדשה במבנה החדש'; newer.set('r_s_s1', v);
  check('רשומה שכבר נערכה במבנה החדש — לא נדרסת', !G('recsLateOps')(ops, newer).some(o=>o.id==='r_s_s1'));
  const noId=new Map([['gans',{ gans:[{ ganName:'בלי מזהה' }] }]]);
  check('רשומה בלי מזהה — מזהה יציב בין קריאות (בלי כפילויות)', G('legacyListsFromDocs')(noId).gan[0].id===G('legacyListsFromDocs')(noId).gan[0].id);
}

console.log('4) עריכה במבנה החדש — רק מה שהשתנה');
sb.DB.students=norm(L.s); sb.DB.gans=JSON.parse(J(L.g)); sb.DB.staff=L.t.map(G('normStaff')); sb.DB.management=JSON.parse(J(L.m));
G('refreshMergeBase')();
check('בלי שינוי — אין מה לכתוב', G('recsOps')().length===0);
sb.DB.students.find(s=>s.id==='s1').notes='עודכן';
let w=G('recsOps')();
check('עריכת תלמידה אחת = כתיבת מסמך אחד', w.length===1 && w[0].id==='r_s_s1' && w[0].data.d.notes==='עודכן');
check('המסמך נשמר דחוס (בלי ברירות מחדל)', J(w[0].data.d).length < J(sb.DB.students.find(s=>s.id==='s1')).length);
check('הסדר נשמר (o לא משתנה בעריכה)', w[0].data.o===0);
G('refreshMergeBase')();
sb.DB.gans=sb.DB.gans.filter(g=>g.id!=='g1');
sb.DB.staff.push(G('normStaff')({ id:'t2', name:'לוי שרה' }));
w=G('recsOps')();
check('מחיקת גן = מחיקת המסמך שלו', w.some(o=>o.id==='r_g_g1' && o.data===null));
const nt=w.find(o=>o.id==='r_t_t2');
check('רשומה חדשה — מסמך חדש, בסוף הסדר', !!nt && nt.data.o > 1000);

console.log('5) המרכזי — אותן רשימות מאותם מסמכים');
const msb={ Map, String, Object };
vm.createContext(msb); vm.runInContext(grabFrom(MGMT,'function cityIsRecs(')+'\n'+grabFrom(MGMT,'function recsLists('), msb);
const Lm=vm.runInContext('recsLists', msb)(after);
check('המרכזי: אותו סדר בדיוק', J(Lm.s.map(x=>x.id))===J(L.s.map(x=>x.id)) && J(Lm.g.map(x=>x.id))===J(L.g.map(x=>x.id)));
check('המרכזי מזהה עיר שעברה לפי meta.model', vm.runInContext('cityIsRecs', msb)(new Map([['meta',{model:'recs'}]])) && !vm.runInContext('cityIsRecs', msb)(legacy));
check('המרכזי בונה את העיר מהמבנה החדש כשעברה', /const R=cityIsRecs\(docs\) \? recsLists\(docs\) : null;/.test(MGMT));
check('המרכזי כותב תיק במבנה החדש (updateStudent/addStudents)', (MGMT.match(/if\(cityIsRecs\(cityDocs\.get\(c\.id\)\)\)\{/g)||[]).length===2);

console.log('6) תוכנת העיר וכללי השרת');
check('rebuildDB עובר למבנה החדש לפי meta.model', /RECS = meta\.model==="recs";/.test(SRC));
check('pushAll כותב במבנה החדש כשהעיר עברה (SDK, ו-REST כשה-SDK תקוע)', /if\(RECS\)\{ if\(restMode \|\| Date\.now\(\)<_sdkStuckUntil\) await recsPushRest\(gen\); else await recsPushSDK\(gen\); return; \}/.test(SRC));
check('כללי השרת: אחרי המעבר — אין כתיבה למסמכים הישנים', /legacyListDoc\(docId\) && modelIsRecs\(homeMetaPath\(\)\)/.test(RULES) && /legacyListDoc\(docId\) && modelIsRecs\(cityMetaPath\(cityId\)\)/.test(RULES));

console.log(`\n${pass} עברו · ${fail} נכשלו`); process.exit(fail?1:0);
