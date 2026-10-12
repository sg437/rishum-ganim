/* בדיקת "כתובת אחת לכולם" — מעבר מ-rishum-ganim.pages.dev (עותק שלא מתעדכן) לכתובת החיה.
   עריכה שטרם עלתה שמורה בדפדפן לפי כתובת — לכן עוברים רק אחרי שהיא עלתה.
   הרצה:  node tests/host-move.test.cjs */
const fs=require('fs'), path=require('path'), vm=require('vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const headScript=(src)=>{ const m=src.match(/<script>\(function\(\)\{try\{if\(location\.hostname!=="rishum-ganim\.pages\.dev"\)return;[\s\S]*?<\/script>/); if(!m) throw new Error('no head script'); return m[0].replace(/^<script>|<\/script>$/g,''); };
let pass=0, fail=0; const check=(n,c,d)=>{ if(c){pass++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n+(d?'  → '+d:''));} };
function run(src, host, pending){
  const out={ replaced:null, win:{} };
  const ls={ getItem:k=> k==='rg-pending-v1' && pending ? JSON.stringify({v:1,items:pending}) : null };
  const ctx={ location:{ hostname:host, pathname:'/index.html', search:'?a=1', hash:'#x', replace(u){ out.replaced=u; } }, localStorage:ls, JSON, window:out.win };
  vm.createContext(ctx); vm.runInContext(src, ctx); out.win=ctx.window; return out;
}
const IDX=headScript(read('index.html'));
let r=run(IDX,'sg437.github.io',null);                 check('הכתובת החיה — לא זזים', r.replaced===null && !r.win.__RG_MOVE_TO);
r=run(IDX,'abc.rishum-ganim.pages.dev',null);          check('תצוגה מקדימה של Cloudflare — לא זזים', r.replaced===null);
r=run(IDX,'rishum-ganim.pages.dev',null);              check('העותק הישן בלי עריכות ממתינות — עוברים מיד, עם הנתיב והפרמטרים', r.replaced==='https://sg437.github.io/rishum-ganim/index.html?a=1#x', r.replaced);
r=run(IDX,'rishum-ganim.pages.dev',[{coll:'stu',id:'s1'}]); check('העותק הישן עם עריכה ממתינה — נשארים עד שתעלה', r.replaced===null && r.win.__RG_MOVE_TO==='https://sg437.github.io/rishum-ganim/index.html?a=1#x');
['management.html','register.html'].forEach(f=>{ const s=headScript(read(f)); const r=run(s,'rishum-ganim.pages.dev',null); check(f+' — עובר לכתובת החיה', r.replaced && r.replaced.startsWith('https://sg437.github.io/rishum-ganim/')); });

// _maybeMoveHost — מתוך index.html
const SRC=read('index.html'); const a=SRC.indexOf('function _maybeMoveHost('); const b=SRC.indexOf('\n}\n',a)+3;
const mk=(over)=>{ const st={ moved:null, toasts:0 }; const ctx=Object.assign({ PENDING_LS_KEY:'rg-pending-v1', serverConfirmed:true, _pending:new Map(),
  localStorage:{ getItem:()=>null }, toast(){ st.toasts++; }, setTimeout:(f)=>f(), location:{ replace(u){ st.moved=u; } }, window:{ __RG_MOVE_TO:'https://sg437.github.io/rishum-ganim/' } }, over||{});
  vm.createContext(ctx); vm.runInContext(SRC.slice(a,b)+';_maybeMoveHost();', ctx); return st; };
check('לפני אישור השרת — לא עוברים', mk({serverConfirmed:false}).moved===null);
check('יש עריכה ממתינה — לא עוברים', mk({_pending:new Map([['stu:x',{}]])}).moved===null);
check('עדיין שמורה בדפדפן (טרם שוחזרה) — לא עוברים', mk({localStorage:{getItem:()=>'{}'}}).moved===null);
check('הכול עלה — עוברים, עם הודעה', (()=>{ const st=mk(); return st.moved==='https://sg437.github.io/rishum-ganim/' && st.toasts===1; })());
check('לא בעותק הישן — לא עושים כלום', mk({window:{}}).moved===null);
console.log(`\n${pass} עברו · ${fail} נכשלו`); process.exit(fail?1:0);
