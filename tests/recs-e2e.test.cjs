/* ============================================================================
   בדיקת דפדפן מקצה לקצה — "מסמך לכל רשומה" (Playwright + Chromium)
   ----------------------------------------------------------------------------
   index.html האמיתי רץ מול Firestore מדומה *שעובד* (מסמכים בזיכרון, מאזינים,
   writeBatch, mergeFields, getDocsFromServer). התרחיש:
     1. עיר במבנה הישן (students_<שנה>, gans, staff, management) נטענת ומוצגת.
     2. מנהל/ת מריץ/ה את המעבר — כל רשומה נכתבת כמסמך r_*, האימות עובר,
        meta מסומן model:"recs", והמסמכים הישנים לא נגעו.
     3. אחרי המעבר המסך מציג בדיוק את אותן רשומות.
     4. עריכת תלמידה אחת כותבת מסמך אחד (r_s_<id>) — ולא נוגעת במסמכים הישנים.
     5. מחיקת גן מוחקת את המסמך שלו; גן חדש נכתב כמסמך חדש.
   הרצה:  NODE_PATH=$(npm root) node tests/recs-e2e.test.cjs
   ============================================================================ */
const fs=require('fs'), path=require('path');
let chromium;
try{ ({chromium}=require('playwright')); }
catch(e){ console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית).'); process.exit(0); }
const ROOT=path.join(__dirname,'..');
const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'rg-recs-'));
let html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
html=html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/,'');
html=html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g,'./fbstub.js');
html=html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','./noop.js');
const expose=`
Object.defineProperty(window,'DB',{get:()=>DB,configurable:true});
Object.defineProperty(window,'RECS',{get:()=>RECS,configurable:true});
Object.defineProperty(window,'savePending',{get:()=>savePending,configurable:true});
Object.assign(window,{ migrateToRecs, save, isAdmin, route }); window.__goSettings=()=>{ active='settings'; route(); };
window.__ready=true;
`;
const endIdx=html.lastIndexOf('</script>');
html=html.slice(0,endIdx)+expose+html.slice(endIdx);
fs.writeFileSync(path.join(TMP,'app.html'),html);
fs.writeFileSync(path.join(TMP,'noop.js'),'window.L=window.L||{};');
fs.writeFileSync(path.join(TMP,'ui-lab.css'),'');
fs.writeFileSync(path.join(TMP,'ui-lab.js'),'');
/* Firestore מדומה שעובד באמת — מספיק כדי להריץ את התוכנה מקצה לקצה */
fs.writeFileSync(path.join(TMP,'fbstub.js'),`
const noop=()=>{}; const P=()=>Promise.resolve();
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
/* כמו השרת האמיתי: שדות המפה נשמרים וחוזרים בסדר אלפביתי, לא בסדר שבו נכתבו */
const sortDeep=v=>Array.isArray(v)?v.map(sortDeep):(v&&typeof v==='object')?Object.keys(v).sort().reduce((o,k)=>(o[k]=sortDeep(v[k]),o),{}):v;
const store=window.__store=new Map(Object.entries(window.__SEED||{}));   // "app/meta" → data
window.__ops=[];                                                          // יומן כתיבות: {op, path}
const listeners=[];
const collOf=p=>p.split('/').slice(0,-1).join('/'), idOf=p=>p.split('/').pop();
const meta={ fromCache:false, hasPendingWrites:false };
const docSnap=p=>({ id:idOf(p), exists:()=>store.has(p), data:()=>clone(store.get(p)), metadata:meta });
function emit(paths){
  for(const l of listeners){
    if(l.coll){ const ch=paths.filter(p=>collOf(p)===l.path).map(p=>({ type:store.has(p)?'modified':'removed', doc:{ id:idOf(p), data:()=>clone(store.get(p)) } }));
      if(ch.length) setTimeout(()=>l.cb({ metadata:meta, docChanges:()=>ch }),0); }
    else if(paths.includes(l.path)) setTimeout(()=>l.cb(docSnap(l.path)),0);
  }
}
const setPath=(o,segs,v)=>{ let c=o; for(let i=0;i<segs.length-1;i++){ if(typeof c[segs[i]]!=='object'||c[segs[i]]===null) c[segs[i]]={}; c=c[segs[i]]; } c[segs[segs.length-1]]=v; };
const getPath=(o,segs)=>segs.reduce((a,k)=>a==null?undefined:a[k],o);
function applySet(p,data,opts){
  if(opts&&opts.mergeFields){ const cur=clone(store.get(p))||{}; opts.mergeFields.forEach(fp=>setPath(cur,fp.segments,clone(getPath(data,fp.segments)))); store.set(p,sortDeep(cur)); }
  else if(opts&&opts.merge){ store.set(p,Object.assign(clone(store.get(p))||{},clone(data))); }
  else store.set(p,sortDeep(clone(data)));
  window.__ops.push({op:'set',path:p});
}
export const initializeApp=()=>({name:'stub'});
export const getAuth=()=>({currentUser:null});
export const onAuthStateChanged=(a,cb)=>{ window.__authCb=cb; setTimeout(()=>cb(null),0); return noop; };
export const signInWithEmailAndPassword=P, sendPasswordResetEmail=P, signInWithPopup=P, signOut=P;
export class GoogleAuthProvider{ setCustomParameters(){} }
export const initializeFirestore=()=>({stub:true});
export const persistentLocalCache=()=>({}), persistentMultipleTabManager=()=>({});
export const doc=(db,...segs)=>({path:segs.join('/')});
export const collection=(db,...segs)=>({path:segs.join('/'), coll:true});
export const setDoc=(ref,data,opts)=>{ applySet(ref.path,data,opts); emit([ref.path]); return P(); };
export const deleteDoc=(ref)=>{ store.delete(ref.path); window.__ops.push({op:'delete',path:ref.path}); emit([ref.path]); return P(); };
export const terminate=P, clearIndexedDbPersistence=P, disableNetwork=P, enableNetwork=P;
export const onSnapshot=(ref,opts,cb)=>{ cb=typeof opts==='function'?opts:cb;
  const l={ path:ref.path, coll:!!ref.coll, cb }; listeners.push(l);
  setTimeout(()=>{ if(l.coll){ const ch=[...store.keys()].filter(p=>collOf(p)===ref.path).map(p=>({ type:'added', doc:{ id:idOf(p), data:()=>clone(store.get(p)) } })); cb({ metadata:meta, docChanges:()=>ch }); } else cb(docSnap(ref.path)); },0);
  return ()=>{ const i=listeners.indexOf(l); if(i>=0) listeners.splice(i,1); }; };
export const getDocsFromServer=async(ref)=>{ window.__reads=(window.__reads||0)+1; if(window.__reads===2 && window.__duringMigration) window.__duringMigration(); const ds=[...store.keys()].filter(p=>collOf(p)===ref.path).map(p=>({ id:idOf(p), data:()=>clone(store.get(p)) })); return { forEach:f=>ds.forEach(f), docs:ds }; };
export const writeBatch=()=>{ const ops=[]; return { set:(r,d,o)=>ops.push(['set',r,d,o]), delete:r=>ops.push(['del',r]),
  commit:()=>{ const ps=[]; ops.forEach(([t,r,d,o])=>{ if(t==='set') applySet(r.path,d,o); else { store.delete(r.path); window.__ops.push({op:'delete',path:r.path}); } ps.push(r.path); }); emit(ps); return P(); } }; };
export const runTransaction=async(db,fn)=>{ const sets=[]; await fn({ get:async r=>docSnap(r.path), set:(r,d)=>sets.push([r,d]) }); sets.forEach(([r,d])=>applySet(r.path,d)); emit(sets.map(([r])=>r.path)); };
export class FieldPath{ constructor(...s){ this.segments=s; } }
export const initializeAppCheck=()=>({}); export class ReCaptchaV3Provider{}; export const getToken=async()=>({token:""});
`);
/* נתוני העיר במבנה הישן */
const Y='תשפ"ז';
const SEED={
  'app/meta': { years:[Y], activeYear:Y, settings:{ admins:['sg@taharat.org'], allowedEmails:[] } },
  'app/students_תשפ_ז': { year:Y, students:[ { id:'s1', year:Y, firstName:'רחל', lastName:'כהן' }, { id:'s2', year:Y, firstName:'לאה', lastName:'לוי', notes:'ישן', docFiles:{ zeta:{ name:'ז', id:'1' }, alpha:{ name:'א', id:'2' } }, extraField:'x' }, { id:'s3', year:Y, firstName:'שרה', lastName:'אברהם' } ] },
  'app/gans': { gans:[ { id:'g1', ganName:'גן ורד' }, { id:'g2', ganName:'גן חצב' } ] },
  'app/staff': { staff:[ { id:'t1', name:'כהן מרים', role:'סייעת' } ] },
  'app/management': { management:[ { id:'m1', name:'מנהלת' } ] },
  /* שארית מניסיון מעבר קודם שלא הושלם — התיק נמחק אחר כך מהמבנה הישן, ואסור שיחזור */
  'app/r_s_gone': { _t:'rec', k:'s', d:{ id:'gone', year:Y, firstName:'נמחקה', lastName:'מזמן' }, o:9, u:1 },
};
const PORT=8763;
/* השרת מגיש רק את הקבצים שהבדיקה כתבה — מרשימה שנבנית מראש, לא מנתיב שבבקשה */
const FILES=new Map(['app.html','noop.js','ui-lab.css','ui-lab.js','fbstub.js'].map(n=>[ '/'+n, {
  body:fs.readFileSync(path.join(TMP,n)),
  type:n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html; charset=utf-8':'text/css' }]));
const server=require('http').createServer((req,res)=>{
  const f=FILES.get(String(req.url||'').split('?')[0]);
  if(!f){ res.writeHead(404); return res.end('nf'); }
  res.writeHead(200,{'Content-Type':f.type}); res.end(f.body);
});
let pass=0, fail=0; const check=(n,c,d)=>{ if(c){pass++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n+(d?'  → '+d:''));} };
(async()=>{
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  const b=await chromium.launch({ executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
  const pg=await b.newPage();
  const errors=[]; pg.on('pageerror',e=>errors.push(e.message)); pg.on('console',m=>{ if(process.env.DBG) console.log('console:',m.text()); }); if(process.env.DBG) pg.on('pageerror',e=>console.log('pageerror:',e.message));
  await pg.addInitScript(s=>{ window.__SEED=s; try{ localStorage.clear(); }catch(_){} }, SEED);
  await pg.goto('http://127.0.0.1:'+PORT+'/app.html',{ waitUntil:'domcontentloaded' });
  await pg.waitForFunction(()=>window.__ready && window.__authCb, null, { timeout:15000 });
  await pg.evaluate(()=>window.__authCb({ email:'sg@taharat.org', displayName:'מנהל', getIdToken:async()=>'t' }));
  await pg.waitForFunction(()=>window.DB && window.DB.students.length===3, null, { timeout:15000 });
  const sig=()=>pg.evaluate(()=>JSON.stringify({ s:DB.students.map(x=>[x.id,x.firstName,x.notes||'']), g:DB.gans.map(x=>[x.id,x.ganName]), t:DB.staff.map(x=>[x.id,x.name]), m:DB.management.map(x=>[x.id,x.name]) }));
  console.log('1) המבנה הישן נטען');
  const before=await sig();
  check('3 תלמידות · 2 גנים · צוות · הנהלה — מהמבנה הישן', JSON.parse(before).s.length===3 && JSON.parse(before).g.length===2 && !(await pg.evaluate(()=>RECS)));
  const legacyBefore=await pg.evaluate(()=>JSON.stringify(['app/students_תשפ_ז','app/gans','app/staff','app/management'].map(p=>window.__store.get(p))));

  console.log('2) המעבר');
  await pg.waitForFunction(()=>!window.savePending, null, { timeout:10000 });
  /* עובדת שומרת בדיוק בשניות של המעבר: אחרי שהמעבר קרא את הנתונים, לפני הסימון */
  await pg.evaluate(()=>{ window.__reads=0; window.__duringMigration=()=>{ const d=window.__store.get('app/students_תשפ_ז'); d.students.find(x=>x.id==='s3').notes='נשמר בזמן המעבר'; window.__store.set('app/students_תשפ_ז', d); }; });
  const r=await pg.evaluate(async()=>{ window.__ops.length=0; try{ const r=await migrateToRecs(); return { ok:true, count:r.count }; }catch(e){ return { ok:false, err:e.message }; } });
  check('המעבר הושלם ואומת', r.ok && r.count===7, JSON.stringify(r));
  const recDocs=await pg.evaluate(()=>[...window.__store.keys()].filter(k=>k.startsWith('app/r_')).sort());
  check('נכתבו 7 מסמכי-רשומה, והשארית מניסיון קודם נמחקה', recDocs.length===7 && !recDocs.includes('app/r_s_gone'), recDocs.join(','));
  check('meta מסומן model:"recs"', await pg.evaluate(()=>window.__store.get('app/meta').model==='recs'));
  check('שינוי שנשמר בזמן המעבר — הגיע גם למבנה החדש', await pg.evaluate(()=>window.__store.get('app/r_s_s3').d.notes==='נשמר בזמן המעבר'));
  check('המעבר לא כתב לשום מסמך ישן (גיבוי)', await pg.evaluate(()=>!window.__ops.some(o=>/students_|app\/gans$|app\/staff$|app\/management$/.test(o.path))));

  console.log('3) אחרי המעבר — אותו מסך');
  await pg.waitForFunction(()=>RECS===true, null, { timeout:10000 });
  check('התוכנה עברה למבנה החדש', await pg.evaluate(()=>RECS));
  check('אותן רשומות, אותו סדר — כולל השינוי שנשמר בזמן המעבר', before.replace('["s3","שרה",""]','["s3","שרה","נשמר בזמן המעבר"]')===await sig(), await sig());

  console.log('4) עריכת תלמידה אחת');
  await pg.waitForFunction(()=>!window.savePending, null, { timeout:10000 });
  await pg.evaluate(()=>{ window.__ops.length=0; DB.students.find(s=>s.id==='s2').notes='חדש'; save(); });
  await pg.waitForFunction(()=>!window.savePending && window.__ops.some(o=>o.path==='app/r_s_s2'), null, { timeout:15000 });
  const ops=await pg.evaluate(()=>window.__ops.map(o=>o.op+':'+o.path));
  check('נכתב מסמך התלמידה בלבד (ו-meta)', ops.filter(o=>o.startsWith('set:app/r_')).length===1 && ops.includes('set:app/r_s_s2'), ops.join(', '));
  check('לא נכתב שום מסמך ישן', !ops.some(o=>/students_|app\/gans$|app\/staff$|app\/management$/.test(o)), ops.join(', '));
  check('השינוי בשרת', await pg.evaluate(()=>window.__store.get('app/r_s_s2').d.notes==='חדש'));

  console.log('5) מחיקה והוספה');
  await pg.evaluate(()=>{ window.__ops.length=0; DB.gans=DB.gans.filter(g=>g.id!=='g1'); DB.gans.push({ id:'g9', ganName:'גן חדש' }); save(); });
  await pg.waitForFunction(()=>!window.savePending && window.__ops.some(o=>o.path==='app/r_g_g9'), null, { timeout:15000 });
  const ops2=await pg.evaluate(()=>window.__ops.map(o=>o.op+':'+o.path));
  check('מחיקת גן = מחיקת המסמך שלו', ops2.includes('delete:app/r_g_g1'), ops2.join(', '));
  check('גן חדש = מסמך חדש', ops2.includes('set:app/r_g_g9'));
  check('המסך: הגן נמחק, החדש בסוף', await pg.evaluate(()=>JSON.stringify(DB.gans.map(g=>g.id)))==='["g2","g9"]');

  console.log('6) דרך הכפתור במסך — ההתקדמות והתוצאה נשארות על המסך גם כשהוא נבנה מחדש');
  const p2=await b.newPage(); p2.on('dialog',d=>d.accept());
  await p2.addInitScript(s=>{ window.__SEED=s; try{ localStorage.clear(); }catch(_){} }, SEED);
  await p2.goto('http://127.0.0.1:'+PORT+'/app.html',{ waitUntil:'domcontentloaded' });
  await p2.waitForFunction(()=>window.__ready && window.__authCb, null, { timeout:15000 });
  await p2.evaluate(()=>window.__authCb({ email:'sg@taharat.org', displayName:'מנהל', getIdToken:async()=>'t' }));
  await p2.waitForFunction(()=>window.DB && window.DB.students.length===3 && !window.savePending, null, { timeout:15000 });
  await p2.evaluate(()=>{ window.__noReload=true; const orig=location.reload.bind(location); try{ Object.defineProperty(location,'reload',{value:()=>{ window.__reloaded=true; }}); }catch(_){} window.__goSettings(); });
  const hasBtn=await p2.evaluate(()=>!!document.getElementById('recs-migrate'));
  check('הכפתור מופיע בהגדרות למנהל/ת', hasBtn);
  await p2.click('#recs-migrate');
  await p2.waitForFunction(()=>/המעבר הושלם/.test((document.getElementById('recs-log')||{}).textContent||'') || /המעבר הושלם/.test(document.body.textContent), null, { timeout:15000 }).catch(()=>{});
  const shown=await p2.evaluate(()=>((document.getElementById('recs-log')||{}).textContent||'')+' | '+(document.getElementById('toast')||{}).textContent);
  check('אחרי המעבר — "המעבר הושלם" מוצג (גם אחרי שהמסך נבנה מחדש)', /המעבר הושלם/.test(shown), shown);
  check('המעבר באמת בוצע', await p2.evaluate(()=>window.__store.get('app/meta').model==='recs'));
  await p2.close();

  const real=errors.filter(e=>!/Failed to fetch|NetworkError|net::/.test(e));
  check('אין שגיאות JavaScript', !real.length, real.join(' | '));
  await b.close(); server.close();
  console.log(`\n${pass} עברו · ${fail} נכשלו`); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
