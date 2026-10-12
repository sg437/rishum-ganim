/* בדיקת הבאנר האדום — רק לתקלה אמיתית, לא לרגע של חיבור מחדש.
   הרצה:  node tests/offline-banner.test.cjs */
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
const code=[ line('let _reconnecting'), grab('function maybeShowOfflineBanner(') ].join('\n');
const shown=[];
const ctx={ setTimeout:(f,ms)=>{ ctx._next={f,ms}; return 1; }, document:{ visibilityState:'visible' },
  _syncState:'offline', _offlineDismissed:false, _offlineTimer:1, showOfflineBanner(){ shown.push(1); } };
vm.createContext(ctx);
vm.runInContext(code+';Object.defineProperty(this,"_reconnecting",{get:()=>_reconnecting,set:v=>{_reconnecting=v}});this.maybeShowOfflineBanner=maybeShowOfflineBanner;', ctx);
let pass=0, fail=0; const check=(n,c)=>{ if(c){pass++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n);} };
check('השהיה של 45 שניות (לא 12)', /OFFLINE_BANNER_DELAY_MS = 45000/.test(SRC) && /setTimeout\(maybeShowOfflineBanner, OFFLINE_BANNER_DELAY_MS\)/.test(SRC) && !/setTimeout\(showOfflineBanner, 12000\)/.test(SRC));
ctx._syncState='synced'; ctx.maybeShowOfflineBanner(); check('חזר ל"נשמר בענן" בינתיים — בלי באנר', shown.length===0);
ctx._syncState='offline'; ctx._reconnecting=true; ctx.maybeShowOfflineBanner(); check('באמצע חיבור מחדש — בלי באנר', shown.length===0);
ctx._reconnecting=false; ctx.document.visibilityState='hidden'; ctx.maybeShowOfflineBanner(); check('לשונית ברקע — נדחה, בלי באנר', shown.length===0 && ctx._next && ctx._next.ms===5000);
ctx.document.visibilityState='visible'; ctx._offlineDismissed=true; ctx.maybeShowOfflineBanner(); check('המשתמש/ת סגר/ה את הבאנר — לא חוזר', shown.length===0);
ctx._offlineDismissed=false; ctx.maybeShowOfflineBanner(); check('תקוע 45 שניות רצופות — באנר', shown.length===1);
check('דחייה מהשרת מוצגת מיד', /_lastSaveErrShown=sig; _offlineDismissed=false; showOfflineBanner\(\);/.test(SRC));
check('ריפוי בקרת-האמת בשקט', !/toast\("מעדכן נתונים מהשרת/.test(SRC));
console.log(`\n${pass} עברו · ${fail} נכשלו`); process.exit(fail?1:0);
