/* ============================================================================
   בדיקת דפדפן לשדרוגים החדשים (Playwright + Chromium)
   ----------------------------------------------------------------------------
   טוענת את index.html האמיתי עם Firebase מדומה (בלי רשת), מזריקה נתוני בדיקה,
   ומוודאת שהמסכים והלוגיקה החדשים עובדים בפועל:
     • מרכז ההודעות — בנייה, מיזוג פרטי הגן לכל הורה, ערוצים, מצב ידני.
     • רף שיבוץ — עמודה בטבלת הגנים, חיווי בתיק, וחסימת שמירה מעל הרף.
     • בדיקת קרבה מהתיק · כפתורי טלפון בטבלה · חלון השיבוץ האוטומטי.
     • העוזר החכם — פאנל הצד, כלי הקריאה, וכלי השינוי (כולל כיבוד הרף).
   דרישות: playwright + Chromium מקומי. הרצה:
     PW_CHROME=/path/to/chrome node tests/ui.test.cjs
   ============================================================================ */

const fs=require('fs'), path=require('path');
let chromium;
try{ ({chromium}=require('playwright')); }
catch(e){
  console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית, לא נדרשת לשימוש בתוכנה).');
  console.log('    התקנה:  npm i -D playwright && npx playwright install chromium');
  console.log('    הרצה:   NODE_PATH=$(npm root) node tests/ui.test.cjs   [PW_CHROME=/path/to/chrome]');
  process.exit(0);
}
const SRC=path.join(__dirname,'..','index.html');
const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'rg-ui-'));
let html=fs.readFileSync(SRC,'utf8');

// מחליפים את ייבוא Firebase בייבוא מקומי מדומה, ומסירים את ה-CSP (הבדיקה מקומית)
html=html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/,'');
html=html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g,'./fbstub.js');
// לא לטעון Leaflet מהרשת בבדיקה
html=html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','./noop.js');
// DRIVE_READY נגזר מכתובת הגשר; לבדיקות שדורשות "גשר מחובר" מספקים כתובת תקפה
html=html.replace(/const DRIVE_READY = [^;]+;/,
  'let DRIVE_READY = false; window.__forceDriveReady=()=>{DRIVE_READY=true};');
// הקוד רץ כמודול (scope נפרד) — חושפים לבדיקה את מה שנדרש
const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; };
window.__get=k=> k==='active'?active : k==='DB'?DB : undefined;
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.defineProperty(window,'stuFilter',{get:()=>stuFilter,set:v=>{stuFilter=v},configurable:true});
Object.defineProperty(window,'_cityCenter',{get:()=>_cityCenter,set:v=>{_cityCenter=v},configurable:true});
Object.defineProperty(window,'_placeMarker',{get:()=>_placeMarker,set:v=>{_placeMarker=v},configurable:true});
Object.defineProperty(window,'_placeGanId',{get:()=>_placeGanId,set:v=>{_placeGanId=v},configurable:true});
Object.defineProperty(window,'_placeKind',{get:()=>_placeKind,set:v=>{_placeKind=v},configurable:true});
Object.defineProperty(window,'_walkWhy',{get:()=>_walkWhy,configurable:true});
Object.defineProperty(window,'_geoGoogle',{get:()=>_geoGoogle,set:v=>{_geoGoogle=v},configurable:true});
window.__setDriveCall=fn=>{ driveCall=fn; };   // הצהרת פונקציה — ניתנת להחלפה בתוך המודול
window.__setDownloadBlob=fn=>{ downloadBlob=fn; };   // כדי לבדוק תוכן קובץ שהופק בלי להוריד אותו
Object.assign(window,{ TABS, route, closeModal, openStudentById, openAutoAssign, _mapState, openStuQuick, renderStuTable,
  msgState, msgBuild, msgApplyTemplate, msgManualPanel, msgMerge, AI_TOOLS, aiParseActions, aiOpen, aiClose,
  staffName,
  aiDocSpec, aiDocDeliver, aiIsOverload, aiIsQuota, aiIsBridgeHiccup, aiErrHe, aiAsk, AI_RETRY_WAITS, tableXlsHtml,
  aiSystemPrompt, aiGuidePick, guideSections, guidePlainText, aiQueryStaff, aiQueryAsg,
  guideContent, ganAssignCap, ganAssignedCount, autoAssignPlan, proxPanelHtml, proxBind, phoneCell, drivePing, bridgeHasMailDoc, shareReportDoc, shareDocClose, mapGanShown, mapGanIssue, mapEnsureCityCenter, ensureGeo, geoDropHouseNo, geoQueryCandidates, splitStreetNo, streetPointFromGans, geoStripCountry, geocodeOnce, mapWalk, bridgeErrHe, mapPlaceSave, save });
window.__ready=true;
`;
const endIdx=html.lastIndexOf('</script>');
html=html.slice(0,endIdx)+expose+html.slice(endIdx);
fs.writeFileSync(path.join(TMP,'app.html'),html);

fs.writeFileSync(path.join(TMP,'noop.js'),'window.L=window.L||{};');
fs.writeFileSync(path.join(TMP,'fbstub.js'),`
const noop=()=>{}; const P=()=>Promise.resolve();
export const initializeApp=()=>({name:'stub'});
export const getAuth=()=>({currentUser:null});
export const onAuthStateChanged=(a,cb)=>{ setTimeout(()=>cb(null),0); return noop; };
export const signInWithEmailAndPassword=P, signOut=P, sendPasswordResetEmail=P, signInWithPopup=P;
export class GoogleAuthProvider{ setCustomParameters(){} }
export const initializeFirestore=()=>({stub:true});
export const persistentLocalCache=()=>({}), persistentMultipleTabManager=()=>({});
export const doc=()=>({}), setDoc=P, deleteDoc=P, collection=()=>({}), terminate=P,
  clearIndexedDbPersistence=P, disableNetwork=P, enableNetwork=P;
export const onSnapshot=()=>noop;
export const writeBatch=()=>({set:noop,delete:noop,commit:P});
export const runTransaction=P;
export const initializeAppCheck=()=>({}); export class ReCaptchaV3Provider{}
`);

const PORT=8731;
const server=require('http').createServer((req,res)=>{
  const f=path.join(TMP, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''));
  try{ const body=fs.readFileSync(f);
    const ct = f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html; charset=utf-8':'text/plain';
    res.writeHead(200,{'Content-Type':ct}); res.end(body);
  }catch(e){ res.writeHead(404); res.end('nf'); }
});
(async()=>{
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  const b=await chromium.launch({ executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
  const pg=await b.newPage();
  const errors=[];
  pg.on('pageerror',e=>errors.push('pageerror: '+e.message));
  // בקשות רשת שנכשלות אינן תקלה: חלק מהבדיקות מריצות בכוונה את מסלול "הגאוקודר לא זמין"
  // ספריות ה-PDF נטענות מ-CDN שחסום בבדיקה — נפילת הטעינה צפויה כאן (יש נפילה למסמך HTML)
  const BENIGN=/Failed to load resource|net::ERR_|pdf-fail/;
  pg.on('console',m=>{ if(m.type()==='error' && !BENIGN.test(m.text())) errors.push('console: '+m.text()); });
  await pg.route('**',r=>{ const u=r.request().url();
    if(u.startsWith('http://127.0.0.1:'+PORT+'/')) return r.continue();
    return r.abort(); });
  await pg.goto('http://127.0.0.1:'+PORT+'/app.html');
  await pg.waitForTimeout(700);

  // נתוני בדיקה + פתיחת המסך
  const setup=await pg.evaluate(()=>{
    if(!window.__ready) return 'module-not-ready';
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[
      {id:'g1',ganName:'גן הדקל',active:true,education:'רגיל',age:'4',capacity:'30',assignCap:'2',teacherName:'שרה לוי',campus:'מרכז',address:'הרב שך',building:'5',phoneGan:'08-9761234',geo:{lat:31.93,lng:35.04}},
      {id:'g2',ganName:'גן הרימון',active:true,education:'רגיל',age:'4',capacity:'30',assignCap:'',teacherName:'מרים כהן',campus:'מרכז',address:'רשב"י',building:'3',phoneGan:'08-9765555',geo:{lat:31.94,lng:35.06}}
    ];
    DB.students=[1,2,3,4].map(i=>({id:'s'+i,year:'תשפ"ז',firstName:'ילדה'+i,lastName:'כהן',tz:'12345678'+i,
      age:'4',education:'רגיל',ganId:i<4?'g1':'',placed:i<3,finished:false,street:'הרב שך',building:String(i),
      city:'מודיעין עילית',momMobile:'050123456'+i,email:'p'+i+'@example.com',period:'א',
      docs:{},docFiles:{},programs:{},programsPaid:{},special:{},support:{},geo:{lat:31.93+i/1000,lng:35.04}}));
    DB.staff=[{id:'st1',lastName:'ברוך',firstName:'רחל',role:'גננת',education:'רגיל',mobile:'0521234567',email:'r@example.com',active:true}];
    DB.management=[{id:'m1',dept:'כספים',name:'יוסי',role:'גזבר',phone:'08-9760000',mobile:'0501112222',email:'y@example.com'}];
    DB.settings=DB.settings||{}; DB.settings.assignCaps={'רגיל':'36','ח"מ':'','useCapacity':false};
    __set('eduPicked',true); __set('activeEdu',null);
    document.body.classList.remove('locked');
    return 'ok';
  });
  if(setup!=='ok'){ console.log('❌ טעינת האפליקציה נכשלה: '+setup); errors.forEach(e=>console.log('   '+e)); await b.close(); server.close(); process.exit(1); }

  let fail=0;
  const step=async(name,fn)=>{
    const before=errors.length;
    let r; try{ r=await fn(); }catch(e){ r='EX: '+e.message; }
    const newErr=errors.slice(before);
    const ok = r===true && !newErr.length;
    if(!ok){ fail++; console.log('❌ '+name+(r!==true?(' → '+r):'')+(newErr.length?('\\n   '+newErr.join('\\n   ')):'')); }
    else console.log('✅ '+name);
  };

  await step('לשונית "הודעות" קיימת בניווט', ()=>pg.evaluate(()=>TABS.some(t=>t.id==='messages')));
  await step('מרכז ההודעות נבנה', ()=>pg.evaluate(()=>{ __set('active','messages'); route();
    return !!document.querySelector('#msg-tpl') && !!document.querySelector('#msg-send'); }));
  await step('תבנית השיבוץ ממזגת את פרטי הגן של כל תלמידה', ()=>pg.evaluate(()=>{
    msgApplyTemplate('placement'); msgState.parentFilter={edu:'',gans:[],ages:[],campus:'',period:'',placed:'yes'};
    msgState.channel='email';
    const items=msgBuild(msgState);
    return items.length===2 && items[0].text.includes('גן הדקל') && items[0].text.includes('שרה לוי')
        && items[0].subject.includes('ילדה1') && !/\\{\\{/.test(items[0].text); }));
  await step('ספירת נמענים לפי ערוץ', ()=>pg.evaluate(()=>{
    msgState.channel='whatsapp'; const w=msgBuild(msgState).length;
    msgState.channel='email';    const e=msgBuild(msgState).length;
    return w===2 && e===2; }));
  await step('הודעות לצוות ולהנהלה', ()=>pg.evaluate(()=>{
    msgState.audience='staff'; msgApplyTemplate('staff-general');
    const s=msgBuild(msgState);
    msgState.audience='management'; const m=msgBuild(msgState);
    msgState.audience='parents';
    return s.length===1 && s[0].text.includes('רחל') && m.length===1 && m[0].to==='y@example.com'; }));
  await step('מצב ידני לוואטסאפ נבנה עם קישורי wa.me', ()=>pg.evaluate(()=>{
    __set('active','messages'); route(); msgState.channel='whatsapp'; msgApplyTemplate('placement');
    const items=msgBuild(msgState);
    msgManualPanel(document.querySelector('#msg-out'), items, 'whatsapp', true);
    const a=document.querySelector('#msg-out .msg-open');
    return !!a && a.getAttribute('href').startsWith('https://wa.me/9725'); }));

  await step('לשונית הגנים מציגה עמודת "משובצות / רף"', ()=>pg.evaluate(()=>{
    __set('active','gans'); route();
    return document.body.innerText.includes('משובצות / רף') && document.body.innerText.includes('2 / 2'); }));
  await step('טבלת התלמידות: סדר העמודות החדש, בלי ראשי תיבות, עם 🧭 וטלפון', ()=>pg.evaluate(()=>{
    __set('active','students'); route();
    const heads=[...document.querySelectorAll('#stuTable thead th')].map(t=>t.textContent.replace(/[▲▼]/g,'').trim());
    const main=heads.slice(0,6).join('|');
    return !!document.querySelector('.stu-prox')
        && !!document.querySelector('td a[href^="tel:"]')
        && !document.querySelector('#stuTable .ini')          // ראשי התיבות ירדו מהרשימה
        && !document.querySelector('#stuTable td .act[href^="tel:"]')  // בלי סמל הטלפון בטבלה
        && main==='מספר זהות|שם|תאריך לידה|כתובת|טלפון|שיבוץ סופי'
        && !!document.querySelector('.docchips .docchip'); }));
  await step('עמודות נוספות מוסתרות כברירת מחדל, והכפתור מציג אותן', ()=>pg.evaluate(()=>{
    __set('active','students'); route();
    const tbl=()=>document.querySelector('#stuTable table');
    const hidden = tbl().classList.contains('hide-xcol')
      && getComputedStyle(document.querySelector('#stuTable .xcol')).display==='none';
    document.querySelector('#stuColsBtn').click();
    const shown = !tbl().classList.contains('hide-xcol')
      && getComputedStyle(document.querySelector('#stuTable .xcol')).display!=='none';
    document.querySelector('#stuColsBtn').click();   // חזרה למצב ברירת המחדל
    return hidden && shown; }));
  await step('תגית מסמך עם קובץ מצורף היא קישור ישיר למסמך', ()=>pg.evaluate(()=>{
    const s=DB.students.find(x=>x.id==='s1');
    s.docs=Object.assign({}, s.docs, { idCopy:true });
    s.docFiles=Object.assign({}, s.docFiles, { idCopy:{ name:'תז.pdf', link:'https://drive.google.com/file/d/abc/view' } });
    renderStuTable();
    const a=document.querySelector('#stuTable a.docchip.has-file');
    return !!a && /^https:\/\/drive\.google\.com\//.test(a.getAttribute('href')); }));
  await step('סינון גן נסגר בלחיצה במקום אחר במסך', ()=>pg.evaluate(()=>{
    __set('active','students'); route();
    const tg=document.querySelector('#stuFilterToggle'); if(!document.querySelector('#f-gan')) tg.click();
    const d=document.querySelector('#f-gan'); if(!d) return false;
    d.open=true;
    document.querySelector('#stuTable').click();
    return !d.open; }));
  await step('לחיצה על שורה פותחת תיק מקוצר בצד, ולחיצה חוזרת סוגרת', ()=>pg.evaluate(()=>{
    __set('active','students'); route();
    const tr=document.querySelector('tr[data-sid]'); const id=tr.dataset.sid;
    tr.click();
    const box=document.querySelector('#stuQuick');
    const opened = box.classList.contains('stu-quick') && !box.classList.contains('empty-state')
      && !!box.querySelector('#q-open') && box.textContent.includes('פתיחת התיק המלא')
      && document.querySelector('tr[data-sid="'+id+'"]').classList.contains('sel');
    tr.click();
    return opened && box.classList.contains('empty-state'); }));
  await step('התיק המקוצר מציג גן, מסמכים וכל הטלפונים', ()=>pg.evaluate(()=>{
    openStuQuick('s1'); const box=document.querySelector('#stuQuick');
    return box.textContent.includes('גן הדקל') && box.querySelectorAll('.qdoc').length===3
        && !!box.querySelector('a[href^="https://wa.me/"]') && !!box.querySelector('a[href^="tel:"]'); }));
  await step('"פתיחת התיק המלא" פותחת את הטופס המלא', ()=>pg.evaluate(()=>{
    openStuQuick('s1'); document.querySelector('#q-open').click();
    const ok=!!document.querySelector('#s-ganId') && !!document.querySelector('#saveStu');
    closeModal(); return ok; }));
  await step('צ׳יפים של סינון פעיל — הסרה ו"נקה הכל"', ()=>pg.evaluate(()=>{
    stuFilter.age=['4']; stuFilter.muni='no'; __set('active','students'); route();
    const chips=document.querySelectorAll('#stuChips .fchip');
    if(chips.length!==2) return 'צ׳יפים: '+chips.length;
    document.querySelector('#chips-clear').click();
    return document.querySelectorAll('#stuChips .fchip').length===0
        && !stuFilter.muni && !stuFilter.age.length; }));
  await step('תיק הילדה נפתח עם חיווי רף שיבוץ ומקטע בדיקת קרבה', ()=>pg.evaluate(()=>{
    openStudentById('s4');
    const hint=document.querySelector('#s-gan-room'), fold=document.querySelector('#s-prox-fold');
    document.querySelector('#s-ganId').value='g1';
    document.querySelector('#s-ganId').dispatchEvent(new Event('change'));
    return !!fold && !!hint && hint.textContent.includes('מלא'); }));
  await step('מקטע בדיקת הקרבה נבנה בפתיחה', ()=>pg.evaluate(()=>{
    const f=document.querySelector('#s-prox-fold'); f.open=true; f.dispatchEvent(new Event('toggle'));
    return document.querySelectorAll('.pxc-gan').length===2; }));
  await step('שמירת תיק מעל הרף נחסמת', ()=>pg.evaluate(()=>{
    document.querySelector('#s-placed').checked=true;
    document.querySelector('#saveStu').click();
    const st=DB.students.find(x=>x.id==='s4');
    return st.ganId==='' && document.querySelector('#toast').textContent.includes('מלא'); }));
  await step('חלון השיבוץ האוטומטי נפתח ומחשב תצוגה מקדימה', ()=>pg.evaluate(()=>{
    closeModal();
    _mapState.inited=true; _mapState.edu=null; _mapState.city=null; _mapState.ganIds=new Set(['g1','g2']);
    _mapState.allStudents=true;
    openAutoAssign();
    const t=document.querySelector('#aa-out').innerText;
    return t.includes('נבדקו') && !!document.querySelector('#aa-apply'); }));
  await step('הגדרות — מקטע רף שיבוץ', ()=>pg.evaluate(()=>{ closeModal();
    __set('active','settings'); route();
    return !!document.querySelector('#ac-reg') && !!document.querySelector('#saveAC'); }));
  await step('פאנל העוזר נפתח ונסגר', ()=>pg.evaluate(()=>{
    aiOpen(); const on=document.querySelector('#aiPanel').classList.contains('open')
      && document.body.classList.contains('ai-docked') && !!document.querySelector('.aimsg');
    aiClose(); const off=!document.querySelector('#aiPanel').classList.contains('open');
    return on && off; }));
  await step('כלי הקריאה של העוזר מחזירים נתוני אמת', ()=>pg.evaluate(()=>{
    const s=AI_TOOLS.stats.run();
    const g=AI_TOOLS.list_gans.run({});
    const f=AI_TOOLS.find_students.run({ganName:'הדקל'});
    return s['תלמידות_פעילות']===4 && g.length===2 && g[0]['רף_שיבוץ']===2 && f['סה_כ']===3; }));
  await step('כלי שינוי של העוזר מכבד את רף השיבוץ', ()=>pg.evaluate(()=>{
    const pv=AI_TOOLS.assign_student.preview({student:'ילדה4',gan:'גן הדקל'});
    if(!pv.warn || !pv.warn.includes('מלא')) return 'לא הוצגה אזהרה';
    const r=AI_TOOLS.assign_student.run({student:'ילדה4',gan:'גן הדקל'}, pv.ctx);
    return !!r['שגיאה']; }));
  await step('כלי שינוי מבצע כשיש מקום', ()=>pg.evaluate(()=>{
    const pv=AI_TOOLS.assign_student.preview({student:'ילדה4',gan:'גן הרימון'});
    const r=AI_TOOLS.assign_student.run({student:'ילדה4',gan:'גן הרימון'}, pv.ctx);
    return !r['שגיאה'] && DB.students.find(x=>x.id==='s4').ganId==='g2'; }));
  /* ---- הפקת מסמך לפי בקשה חופשית ---- */
  await step('הפקת מסמך מזהה עמודות בעברית מדוברת ומסננת לפי גן', ()=>pg.evaluate(()=>{
    const spec=aiDocSpec({ kind:'students', filter:{ganName:'הדקל'},
      fields:['שם משפחה','שם הילדה','רחוב','מספר בית','טלפון','עמודה שאינה קיימת'] });
    if(spec.error) return spec.error;
    const labels=spec.cols.map(c=>c[1]).join("|");
    return labels==='שם משפחה|שם פרטי|רחוב|בניין|טלפון'
      && spec.unknown.length===1 && spec.rows.length===3 && spec.format==='excel'; }));
  await step('בקשה בלי עמודות מקבלת ברירת מחדל, ופורמט CSV מזוהה', ()=>pg.evaluate(()=>{
    const spec=aiDocSpec({ format:'csv' });
    return !spec.error && spec.format==='csv' && spec.cols.length>=8 && spec.rows.length===4; }));
  await step('הקובץ שנוצר מכיל את הכותרות ואת נתוני התלמידות', async()=>{
    return await pg.evaluate(async()=>{
      let got=null;
      __setDownloadBlob((blob,name)=>{ got={ name, text:null, blob }; });
      const spec=aiDocSpec({ kind:'students', filter:{ganName:'הדקל'}, format:'csv',
        fields:['שם משפחה','שם הילדה','טלפון'] });
      const res=await aiDocDeliver(spec);
      if(!got) return 'לא נוצר קובץ';
      const text=await got.blob.text();
      return got.name.endsWith('.csv') && text.includes('שם משפחה') && text.includes('ילדה1')
        && !!res['בוצע'] && res['בוצע'].includes('3 שורות'); }); });
  await step('הקובץ יורד למחשב תמיד — גם בבקשה לשמור בדרייב', ()=>pg.evaluate(()=>{
    let got=null;
    __setDownloadBlob((blob,name)=>{ got=name; });
    const spec=aiDocSpec({ kind:'students', format:'excel', drive:true });
    const res=aiDocDeliver(spec);
    return !!got && got.endsWith('.xls') && !res['שגיאה'] && res['בוצע'].includes('הורד למחשב'); }));
  await step('כלי הפקת המסמך מוצג לאישור עם מניין השורות והעמודות', ()=>pg.evaluate(()=>{
    const pv=AI_TOOLS.make_document.preview({ kind:'gans', format:'excel', fields:['שם הגן','טלפון'] });
    return !pv.error && pv.text.includes('קובץ אקסל') && pv.text.includes('טלפון בגן'); }));

  await step('מסמך צוות — ברירת מחדל, סינון לפי תפקיד, וגנים משובצים', ()=>pg.evaluate(()=>{
    DB.staff.push({id:'st2',lastName:'דוד',firstName:'לאה',role:'סייעת',education:'רגיל',
      mobile:'0539999999',city:'מודיעין עילית',active:true});
    DB.assignments={'תשפ"ז':{activity:{ g1:{ 'גננת':{staffId:'st1',days:['א','ב']},
                                             'סייעת':{staffId:'st2',days:['ג']} } }}};
    const all=aiDocSpec({ kind:'staff' });
    const one=aiDocSpec({ kind:'staff', filter:{role:'סייעת'} });
    const gans=all.cols.find(c=>c[0]==='gans');
    return !all.error && all.rows.length===2 && one.rows.length===1 && staffName(one.rows[0])==='דוד לאה'
      && all.title.includes('רשימת צוות') && !!gans && gans[2](DB.staff[0])==='גן הדקל'; }));
  await step('מסמך מצבת שיבוץ — שורה לכל תפקיד משובץ, עם הגן והטלפון', ()=>pg.evaluate(()=>{
    const spec=aiDocSpec({ kind:'assignment', fields:['שם הגן','תפקיד','שם','ימים','מספר ילדות'] });
    if(spec.error) return spec.error;
    const val=(r,k)=>spec.cols.find(c=>c[0]===k)[2](r);
    return spec.rows.length===2 && spec.title.includes('מצבת שיבוץ')
      && val(spec.rows[0],'gan')==='גן הדקל' && val(spec.rows[0],'role')==='גננת'
      && val(spec.rows[0],'name')==='ברוך רחל' && val(spec.rows[0],'students')===3
      && spec.cols.map(c=>c[1]).join("|")==='גן|תפקיד|שם|ימים / תקופה|מספר תלמידות'; }));
  await step('סינון מצבת השיבוץ לפי גן ולפי תפקיד', ()=>pg.evaluate(()=>{
    const byRole=aiQueryAsg({ role:'סייעת' });
    const byGan=aiQueryAsg({ ganName:'הרימון' });
    const staffOfGan=aiQueryStaff({ ganName:'הדקל' });
    return byRole.list.length===1 && byRole.list[0].role==='סייעת'
      && byGan.list.length===0 && staffOfGan.list.length===2; }));

  /* ---- ההנחיה לעוזר: המדריך נשלח לפי הצורך, לא במלואו ---- */
  await step('ההנחיה קצרה בהרבה מהמדריך המלא, ונושאת את הפרק הרלוונטי', ()=>pg.evaluate(()=>{
    const full=guidePlainText().length;
    const sys=aiSystemPrompt([{role:'user',content:'איך מייצאים רשימת תלמידות לאקסל?'}]);
    const picked=aiGuidePick([{role:'user',content:'איך מייצאים רשימת תלמידות לאקסל?'}]);
    return full>40000 && sys.length < full/2 && picked.length>0
      && picked.some(s=>s.title.includes('ייצוא'))
      && sys.includes('read_guide') && sys.includes('פרקי המדריך:'); }));
  await step('שאלה על מסך אחר מושכת את הפרק שלו', ()=>pg.evaluate(()=>{
    const p=aiGuidePick([{role:'user',content:'איפה מגדירים את הגיבוי והשחזור?'}]);
    return p.length>0 && p[0].title.includes('גיבוי'); }));
  await step('read_guide מחזיר פרק מלא, וללא התאמה מציע את רשימת הפרקים', ()=>pg.evaluate(()=>{
    const ok=AI_TOOLS.read_guide.run({section:'גיבוי'});
    const bad=AI_TOOLS.read_guide.run({section:'קקטוסים'});
    return ok['פרק'].includes('גיבוי') && ok['תוכן'].length>50
      && !!bad['שגיאה'] && bad['פרקים'].length===guideSections().length; }));

  /* ---- עומס אצל ספק ה-AI: זיהוי, ניסיון חוזר, והודעה בעברית ---- */
  await step('הודעת עומס של הספק מזוהה ומתורגמת לעברית', ()=>pg.evaluate(()=>{
    const en='This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.';
    return aiIsOverload(en) && aiIsOverload('overloaded: http-503: The model is overloaded')
      && !aiIsOverload('You exceeded your current quota')
      && aiIsQuota('You exceeded your current quota')
      && aiErrHe(en).includes('עמוס') && aiErrHe('quota exceeded').includes('מכסה'); }));
  await step('בקשה שנכשלה בעומס נשלחת שוב לבד ומצליחה', async()=>{
    return await pg.evaluate(async()=>{
      AI_RETRY_WAITS.length=0; AI_RETRY_WAITS.push(5,5,5);   // בלי להמתין באמת בבדיקה
      let calls=0; const seen=[];
      __setDriveCall(async()=>{ calls++;
        if(calls<3) throw new Error('overloaded: http-503: The model is overloaded. Please try again later.');
        return { ok:true, text:'שלום' }; });
      const res=await aiAsk([{role:'user',content:'שלום'}], (n)=>seen.push(n));
      return calls===3 && seen.join(",")==='1,2' && res.text==='שלום'; }); });
  await step('ניתוק זמני מהגשר נשלח שוב לבד', async()=>{
    return await pg.evaluate(async()=>{
      AI_RETRY_WAITS.length=0; AI_RETRY_WAITS.push(5,5,5);
      let calls=0; const why=[];
      __setDriveCall(async()=>{ calls++;
        if(calls<3) throw new Error('network');
        return { ok:true, text:'שלום' }; });
      const res=await aiAsk([{role:'user',content:'שלום'}], (n,sec,w)=>why.push(w));
      return calls===3 && why.join(",")==='bridge,bridge' && res.text==='שלום'; }); });
  await step('כשל מתמשך מול הגשר מוצג עם הפרטים הטכניים', ()=>pg.evaluate(()=>{
    const net=aiErrHe('network');
    const bad=aiErrHe('bad-response:302:<HTML><HEAD><TITLE>Moved Temporarily');
    return aiIsBridgeHiccup('network') && aiIsBridgeHiccup('bad-response:500:x')
      && net.includes('לא נענה') && net.includes('בדיקת חיבור')
      && bad.includes('אינה JSON') && bad.includes('302'); }));
  await step('שגיאה שאינה עומס אינה נשלחת שוב', async()=>{
    return await pg.evaluate(async()=>{
      let calls=0;
      __setDriveCall(async()=>{ calls++; throw new Error('no-ai-key'); });
      let msg='';
      try{ await aiAsk([{role:'user',content:'שלום'}]); }catch(e){ msg=aiErrHe(e.message); }
      return calls===1 && msg.includes('מפתח AI'); }); });

  await step('פירוק בלוקי פעולה מתשובת המודל', ()=>pg.evaluate(()=>{
    const p=aiParseActions('הנה התשובה\n```action\n{"tool":"stats","args":{}}\n```');
    return p.actions.length===1 && p.actions[0].tool==='stats' && p.text==='הנה התשובה'; }));
  await step('מדריך כולל את המקטעים החדשים', ()=>pg.evaluate(()=>{
    __set('active','guide'); route();
    const t=document.body.innerText;
    return t.includes('מרכז ההודעות') && t.includes('עוזר חכם — פאנל צד שגם מבצע'); }));
  /* המדריך מתיישן בשקט: מסך שנוסף לתוכנה ולא נכתב בו נשאר בלתי מתועד בלי
     שאיש ישים לב. הבדיקה מחזיקה את המקטעים של המסכים שאין להם תיעוד אחר. */
  await step('לכל מסך בסרגל יש מקטע במדריך', ()=>pg.evaluate(()=>{
    const titles=guideContent().sections.map(s=>s.title).join(" | ");
    return ['עירייה','הנהלה','צוות הגנים','מפת שיבוץ','דוחות','הודעות','כלים ושירותים']
      .every(x=>titles.includes(x)); }));
  await step('מדריך מתעד את מסך העירייה על כל חלקיו', ()=>pg.evaluate(()=>{
    const h=guideContent().sections.map(s=>s.html).join("");
    return ['מיפוי','המספר להשוואה','הכיוון ההפוך','למה N לא קלוטות','מאזן שורה-לשורה',
            'סמל המוסד שבקובץ אינו נכנס לשום תיק']
      .every(x=>h.includes(x)); }));
  await step('מדריך מתעד את השמירה העמידה ואת מסנן "בלי מספר זהות"', ()=>pg.evaluate(()=>{
    const h=guideContent().sections.map(s=>s.html).join("");
    return ['עריכה שלא הולכת לאיבוד','בלי מספר זהות','אינה נספרת'].every(x=>h.includes(x)); }));

  /* ---- רגרסיה: אין גלישה אופקית ברוחב טלפון ----
     באג שהיה: .stu-stage עבר ל-flex-direction:column בלי align-items:stretch,
     ואז הטבלה התנפחה לרוחב התוכן (≈1000px) וגלשה מהמסך בטלפון. */
  {
    const mob=await b.newPage({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await mob.route('**',r=>{ const u=r.request().url();
      if(u.startsWith('http://127.0.0.1:'+PORT+'/')) return r.continue(); return r.abort(); });
    await mob.goto('http://127.0.0.1:'+PORT+'/app.html'); await mob.waitForTimeout(800);
    await mob.evaluate(()=>{
      DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
      DB.gans=[0,1,2].map(i=>({id:'g'+i,ganName:'גן '+i,teacherName:'גננת '+i,age:String(3+i),active:true,
        education:'רגיל',capacity:'30',ganSymbol:String(560120+i),address:'הרב שך',building:String(i+1),phoneGan:'08-976123'+i}));
      DB.students=Array.from({length:12},(_,i)=>({id:'m'+i,year:'תשפ"ז',lastName:'משפחה'+i,firstName:'ילדה'+i,
        tz:String(325417800+i*137),age:String([3,4,5][i%3]),education:'רגיל',ganId:'g'+(i%3),placed:true,finished:false,
        period:'א',motherName:'רחל',street:'נתיבות המשפט',building:String(11+i),city:'מודיעין עילית',
        momMobile:'055-677508'+i,phone:'08-97613'+i,mobile:'055-677508'+i,email:'p'+i+'@x.com',
        absorbedMunicipality:true,docs:{},docFiles:{},programs:{},programsPaid:{},special:{},support:{},notes:'',
        createdAt:new Date().toISOString()}));
      DB.staff=[]; DB.management=[];
      __set('eduPicked',true); __set('activeEdu',null); document.body.classList.remove('locked');
      __set('active','home'); route();
    });
    await mob.waitForTimeout(300);
    const tabs=await mob.evaluate(()=>[...document.querySelectorAll('#tabs button')].map(x=>x.dataset.tab));
    const overflow=async()=>mob.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(!tabs.length){ fail++; console.log('❌ בדיקת הטלפון לא תקפה — לא נמצאו לשוניות'); }
    else {
      const bad=[];
      for(const t of tabs){
        await mob.evaluate(t=>{__set('active',t); route();},t); await mob.waitForTimeout(200);
        const o=await overflow(); if(o>1) bad.push(t+' ('+o+'px)');
      }
      await mob.evaluate(()=>{__set('active','students'); route(); openStuQuick('m1');}); await mob.waitForTimeout(260);
      const oq=await overflow(); if(oq>1) bad.push('תיק מקוצר ('+oq+'px)');
      const tw=await mob.evaluate(()=>{const e=document.getElementById('stuTable');
        return e?Math.round(e.getBoundingClientRect().width):-1;});
      if(tw>412){ bad.push('#stuTable רחב מהמסך ('+tw+'px)'); }
      if(bad.length){ fail++; console.log('❌ גלישה אופקית בטלפון: '+bad.join(' · ')); }
      else console.log('✅ אין גלישה אופקית בטלפון (כל '+tabs.length+' הלשוניות + התיק המקוצר)');
    }
    await mob.close();
  }

  /* ---- רגרסיה: "השלמת עיר" אסור שתמחק מיקומי גנים ----
     באג שהיה: הכפתור עשה g.geo=null "כדי שהמיקום יחושב מחדש", ובכך מחק
     גם מיקומים שסומנו ידנית על המפה — עבודה שאי אפשר לשחזר אוטומטית. */
  await step('"השלמת עיר" משלימה עיר בלי לגעת במיקומים', ()=>pg.evaluate(()=>{
    DB.students=[{id:'cs0',year:DB.activeYear,lastName:'כ',firstName:'ש',city:'מודיעין עלית',street:'א',building:'1',
      docs:{},docFiles:{},programs:{},programsPaid:{},special:{},support:{},finished:false,createdAt:''}];
    DB.gans=[
      {id:'cg0',ganName:'ידני',active:true,education:'רגיל',address:'א',building:'1',city:'',
       geo:{lat:31.9345,lng:35.0432,manual:true,q:'__manual__',locType:'MANUAL',tried:true}},
      {id:'cg1',ganName:'אוטומטי',active:true,education:'רגיל',address:'ב',building:'2',city:'',
       geo:{lat:31.9360,lng:35.0450,q:'ב 2, מודיעין עילית, ישראל'}}
    ];
    __set('active','gans'); route();
    const btn=document.getElementById('ganFillCity');
    if(!btn) return 'הבאנר לא הוצג';
    window.confirm=()=>true;
    btn.click();
    const a=DB.gans[0].geo, b=DB.gans[1].geo;
    if(!(a && a.manual===true && a.lat===31.9345)) return 'מיקום ידני נמחק';
    if(!(b && b.lat===31.9360)) return 'מיקום אוטומטי נמחק';
    if(DB.gans[0].city!=='מודיעין עילית' || DB.gans[1].city!=='מודיעין עילית') return 'העיר לא הושלמה';
    return true; }));

  /* ---- "שחזור מיקומי גנים בלבד" חייב לגעת אך ורק ב-geo ---- */
  await step('שחזור מיקומים: תצוגה מקדימה, וביטול לא משנה כלום', ()=>pg.evaluate(async()=>{
    DB.gans=[{id:'rg0',ganName:'א',active:true,education:'רגיל',city:'מודיעין עילית',geo:null}];
    __set('active','tools'); route();
    await new Promise(r=>setTimeout(r,300));           // viewTools מרנדר חלקים אסינכרונית
    const inp=document.getElementById('restoreGeo');
    if(!inp) return 'אין כפתור שחזור מיקומים';
    const bk={ gans:[{id:'rg0',geo:{lat:31.9345,lng:35.0432,manual:true,q:'__manual__'}}] };
    const dt=new DataTransfer(); dt.items.add(new File([JSON.stringify(bk)],'b.json',{type:'application/json'}));
    inp.files=dt.files; inp.dispatchEvent(new Event('change'));
    for(let i=0;i<40 && !document.getElementById('rgApply');i++) await new Promise(r=>setTimeout(r,50));
    if(!document.getElementById('rgApply')) return 'לא הוצגה תצוגה מקדימה';
    if(DB.gans[0].geo!==null) return 'הנתונים שונו כבר בתצוגה המקדימה';
    document.getElementById('rgCancel').click();
    await new Promise(r=>setTimeout(r,150));
    if(DB.gans[0].geo!==null) return 'ביטול שינה נתונים';
    return true; }));
  await step('שחזור מיקומים: כותב geo בלבד, לא נוגע בשאר', ()=>pg.evaluate(async()=>{
    DB.students=[{id:'rs0',year:DB.activeYear,lastName:'ת',firstName:'ח',notes:'הערה',ganId:'rg0',placed:true,
      finished:false,docs:{},docFiles:{},programs:{},programsPaid:{},special:{},support:{},createdAt:''}];
    DB.staff=[{id:'rst0',lastName:'צ',firstName:'ח',role:'גננת',active:true}];
    DB.gans=[{id:'rg0',ganName:'שם חדש',active:true,education:'רגיל',city:'מודיעין עילית',
      capacity:'30',assignCap:'36',teacherName:'גננת חדשה',address:'כתובת חדשה',campus:'קמפוס חדש',geo:null}];
    __set('active','tools'); route();
    await new Promise(r=>setTimeout(r,300));           // viewTools מרנדר חלקים אסינכרונית
    const inp=document.getElementById('restoreGeo');
    if(!inp) return 'אין כפתור שחזור מיקומים';
    // הגיבוי מכיל ערכים ישנים בכל השדות — אסור שאף אחד מהם ייכנס
    const bk={ gans:[{id:'rg0',ganName:'שם ישן',city:'עיר ישנה',capacity:'99',assignCap:'99',
      teacherName:'גננת ישנה',address:'כתובת ישנה',campus:'קמפוס ישן',
      geo:{lat:31.9345,lng:35.0432,manual:true,q:'__manual__'}}] };
    const dt=new DataTransfer(); dt.items.add(new File([JSON.stringify(bk)],'b.json',{type:'application/json'}));
    inp.files=dt.files; inp.dispatchEvent(new Event('change'));
    for(let i=0;i<40 && !document.getElementById('rgApply');i++) await new Promise(r=>setTimeout(r,50));
    const stuBefore=JSON.stringify(DB.students), staffBefore=JSON.stringify(DB.staff);
    const btn=document.getElementById('rgApply'); if(!btn) return 'לא הוצגה תצוגה מקדימה';
    btn.click();
    const g=DB.gans[0];
    if(!(g.geo && g.geo.lat===31.9345 && g.geo.manual===true)) return 'המיקום לא שוחזר';
    if(g.ganName!=='שם חדש' || g.city!=='מודיעין עילית' || g.capacity!=='30' || g.assignCap!=='36'
       || g.teacherName!=='גננת חדשה' || g.address!=='כתובת חדשה' || g.campus!=='קמפוס חדש')
      return 'שדות אחרים של הגן נדרסו מהגיבוי';
    if(JSON.stringify(DB.students)!==stuBefore) return 'תלמידות נגעו';
    if(JSON.stringify(DB.staff)!==staffBefore) return 'צוות נגע';
    return true; }));

  /* ---- מיקום ידני של גן הוא מקור אמת: מוצג על המפה ולא מדווח כ"לא מוצג" ---- */
  await step('גן שהוצב ידנית לא מדווח כחריג גיאוגרפי', ()=>pg.evaluate(()=>{
    _mapState.city='מודיעין עילית'; _mapState.edu=null; _mapState.ganIds=null; _mapState.inited=true;
    window._cityCenter={ city:'מודיעין עילית', lat:31.9320, lng:35.0400 };
    // הוצב ידנית ובלי כתובת בכרטיס — בדיוק המצב שדווח מהשטח
    const g={id:'mg0',ganName:'ידני',active:true,education:'רגיל',city:'מודיעין עילית',address:'',building:'',
      geo:{lat:31.9345,lng:35.0432,manual:true,q:'__manual__',locType:'MANUAL',tried:true}};
    if(mapGanShown(g)!==true) return 'הגן הידני לא מוצג על המפה';
    if(mapGanIssue(g)!==null) return 'הגן מוצג על המפה אך מדווח כ"לא מוצג": '+mapGanIssue(g);
    return true; }));

  await step('מיקום ידני אמין גם מחוץ לרדיוס — ואוטומטי חריג עדיין מדווח', ()=>pg.evaluate(()=>{
    _mapState.city='מודיעין עילית'; _mapState.inited=true;
    window._cityCenter={ city:'מודיעין עילית', lat:31.9320, lng:35.0400 };
    const far={lat:33.0,lng:35.5};
    const manual={id:'mg1',ganName:'ידני רחוק',active:true,education:'רגיל',city:'מודיעין עילית',
      address:'רחוב',building:'1',geo:{...far,manual:true,q:'__manual__',locType:'MANUAL',tried:true}};
    const auto={id:'mg2',ganName:'אוטומטי רחוק',active:true,education:'רגיל',city:'מודיעין עילית',
      address:'רחוב',building:'2',geo:{...far,q:'רחוב 2, מודיעין עילית, ישראל'}};
    if(mapGanIssue(manual)!==null) return 'מיקום ידני מחוץ לרדיוס דווח כשגיאה';
    if(typeof mapGanIssue(auto)!=='string') return 'איבדנו את האבחון של מיקום אוטומטי חריג';
    return true; }));

  /* ---- מרחקים אבסורדיים (123 ק"מ): מרכז העיר חייב להשתחזר מהגנים הידניים ---- */
  const proxRun = gans => pg.evaluate(async(gans)=>{
    window._cityCenter=null;                 // גאוקוד שם העיר נכשל — התרחיש שבו נוצרו המרחקים האבסורדיים
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    const s={id:'px9',year:'תשפ"ז',lastName:'שטרן',firstName:'תמר',city:'מודיעין עילית',
      street:'חפץ חיים',building:'16', geo:{lat:32.95,lng:35.30,q:'חפץ חיים 16, מודיעין עילית, ישראל'},
      finished:false,docs:{},docFiles:{},programs:{},programsPaid:{},special:{},support:{},createdAt:''};
    DB.students=[s]; DB.gans=gans;
    let host=document.getElementById('pxHost'); if(host) host.remove();
    host=document.createElement('div'); host.id='pxHost'; document.body.appendChild(host);
    host.innerHTML=proxPanelHtml(s,'px'); proxBind(host,()=>s,'px',null);
    host.querySelectorAll('.px-gan').forEach(c=>c.checked=true);
    host.querySelector('#px-go').click();
    for(let i=0;i<240;i++){ await new Promise(r=>setTimeout(r,50));
      const t=document.getElementById('px-out').textContent; if(t && !/מחשב מרחקים/.test(t)) break; }
    const res={ txt:document.getElementById('px-out').textContent, center:window._cityCenter,
      hasBtn:!!document.getElementById('px-refresh'), overflow:host.scrollWidth>host.clientWidth+1 };
    // "חישוב מחדש" חייב לנקות את מטמון התלמידה בלבד, בלי לגעת במיקומי הגנים
    const btn=document.getElementById('px-refresh');
    if(btn){
      const before=JSON.stringify(DB.gans.map(g=>g.geo));
      // נמדד לפני runPush (דחוי ב-250ms): מול Firestore מדומה הוא מרוקן את DB —
      // תופעה של סביבת הבדיקה בלבד. כאן נבדק מה שהכפתור עושה למודל שבזיכרון.
      btn.click(); await new Promise(r=>setTimeout(r,120));
      const stu=DB.students.find(x=>x.id==='px9');
      res.refresh = JSON.stringify(DB.gans.map(g=>g.geo))!==before ? 'מיקומי הגנים השתנו'
        : !stu ? 'התלמידה נעלמה'
        : (stu.geo && stu.geo.lat!=null) ? 'המטמון של התלמידה לא נוקה' : true;
    }
    return res;
  }, gans);
  const mkGan=(id,lat,lng,manual)=>({id,ganName:'גן '+id,active:true,education:'רגיל',city:'מודיעין עילית',
    address:'רחוב',building:id, geo: manual?{lat,lng,manual:true,q:'__manual__'}:{lat,lng,q:'רחוב '+id}});

  await step('מרכז העיר משוחזר מהגנים שהוצבו ידנית — ואין מרחקי מאות ק"מ', async()=>{
    const r=await proxRun([mkGan('a',31.9345,35.0432,true),mkGan('b',31.9300,35.0380,true),mkGan('c',31.9360,35.0450,true)]);
    if(!(r.center && r.center.lat!=null)) return 'מרכז העיר לא שוחזר מהגנים הידניים';
    if(/\b1\d\d\.\d\d ק"מ/.test(r.txt)) return 'עדיין מוצגים מרחקים אבסורדיים: '+r.txt.slice(0,120);
    if(!/לתקן את הרחוב|מחוץ ל|נדחתה/.test(r.txt)) return 'אין הודעה מעשית על כתובת התלמידה';
    return true; });

  await step('כשאין מרכז עיר — ההודעה מאשימה את כתובת התלמידה ומציעה חישוב מחדש', async()=>{
    const r=await proxRun([mkGan('a',31.9345,35.0432,true),mkGan('b',31.9300,35.0380,true)]);
    if(!(r.center && r.center.lat==null)) return 'התרחיש לא שוחזר (יש מרכז עיר)';
    if(!/כל.{0,3} הגנים יצאו במרחק לא סביר/.test(r.txt)) return 'אין הודעת "כל הגנים רחוקים"';
    if(!/כתובת התלמידה/.test(r.txt)) return 'ההודעה לא מפנה לכתובת התלמידה';
    if(!/מוקמו ידנית/.test(r.txt)) return 'ההודעה לא מציינת שהגנים הידניים אמינים';
    if(!r.hasBtn) return 'אין כפתור "חישוב מחדש"';
    if(r.overflow) return 'גלישה אופקית בטלפון';
    if(r.refresh!==true) return 'חישוב מחדש: '+r.refresh;
    return true; });

  /* ---- גאוקוד שגוי של שם העיר לא יקבע עוגן כשיש גנים שהוצבו ידנית ---- */
  await step('הגנים הידניים גוברים על גאוקוד שם העיר בקביעת עוגן העיר', ()=>pg.evaluate(async()=>{
    window._cityCenter=null;
    DB.gans=[1,2,3].map(i=>({id:'mc'+i,ganName:'גן '+i,active:true,education:'רגיל',city:'מודיעין עילית',
      geo:{lat:31.930+i/1000,lng:35.040+i/1000,manual:true,q:'__manual__'}}));
    const c=await mapEnsureCityCenter('מודיעין עילית');
    if(!(c && c.lat!=null)) return 'לא נקבע עוגן';
    if(c.src!=='manual') return 'העוגן לא נלקח מהגנים הידניים (src='+c.src+')';
    if(Math.abs(c.lat-31.932)>0.01) return 'העוגן רחוק מהגנים הידניים: '+c.lat;
    return true; }));

  /* הליבה: גאוקוד שמצליח אך מחזיר עיר שגויה. זה המקרה שקרה בשטח — עוגן שגוי
     מקבל את כתובת התלמידה שנפלה לידו, ומודד אותה מול הגנים האמיתיים כ-100 ק"מ. */
  await step('גאוקוד שמחזיר עיר שגויה לא גובר על הגנים הידניים', async()=>{
    await pg.route(/nominatim/, r=>r.fulfill({ status:200, contentType:'application/json',
      body: JSON.stringify([{lat:'32.8184', lon:'34.9885'}]) }));   // חיפה — כ-100 ק"מ משם
    try{
      return await pg.evaluate(async()=>{
        window._cityCenter=null;
        DB.gans=[1,2,3].map(i=>({id:'wc'+i,ganName:'גן '+i,active:true,education:'רגיל',city:'מודיעין עילית',
          geo:{lat:31.930+i/1000,lng:35.040+i/1000,manual:true,q:'__manual__'}}));
        const c=await mapEnsureCityCenter('מודיעין עילית');
        if(!(c && c.lat!=null)) return 'לא נקבע עוגן';
        if(c.lat>32) return 'העוגן נקבע לפי הגאוקוד השגוי ('+c.lat.toFixed(3)+') במקום לפי הגנים הידניים';
        // ועכשיו הבדיקה שמכל זה נובעת: כתובת שנפלה ליד העוגן השגוי חייבת להידחות
        const stu={id:'wc9',year:DB.activeYear,lastName:'א',firstName:'ב',city:'מודיעין עילית',
          street:'רחוב',building:'1',geo:{lat:32.8184,lng:34.9885,q:'רחוב 1, מודיעין עילית, ישראל'},
          finished:false,docs:{},docFiles:{},programs:{},programsPaid:{},special:{},support:{},createdAt:''};
        const r=await ensureGeo(stu,'רחוב 1, מודיעין עילית, ישראל',false,'מודיעין עילית',c);
        if(r && r.lat!=null && r.lat>32) return 'מיקום שגוי של התלמידה עדיין התקבל';
        return true; });
    } finally { await pg.unroute(/nominatim/); }
  });

  await step('בלי גנים ידניים — עדיין נופלים לגאוקוד/חציון', ()=>pg.evaluate(async()=>{
    window._cityCenter=null;
    DB.gans=[{id:'na',ganName:'א',active:true,education:'רגיל',city:'מודיעין עילית',geo:null}];
    const c=await mapEnsureCityCenter('מודיעין עילית');
    if(c && c.src==='manual') return 'נבחר מקור ידני בלי גנים ידניים';
    return true; }));

  /* ---- "פרטים טכניים" חייב להיות זמין בכל תוצאה, לא רק כשהכל רחוק ---- */
  const proxDiag = (gans, stuGeo) => pg.evaluate(async(a)=>{
    window._cityCenter=null; DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    const s={id:'dg9',year:'תשפ"ז',lastName:'ש',firstName:'ת',city:'מודיעין עילית',
      street:'חפץ חיים',building:'16', geo:a.stuGeo,
      finished:false,docs:{},docFiles:{},programs:{},programsPaid:{},special:{},support:{},createdAt:''};
    DB.students=[s]; DB.gans=a.gans;
    let host=document.getElementById('dgHost'); if(host) host.remove();
    host=document.createElement('div'); host.id='dgHost'; document.body.appendChild(host);
    host.innerHTML=proxPanelHtml(s,'dg'); proxBind(host,()=>s,'dg',null);
    host.querySelectorAll('.dg-gan').forEach(c=>c.checked=true);
    host.querySelector('#dg-go').click();
    for(let i=0;i<240;i++){ await new Promise(r=>setTimeout(r,50));
      const t=document.getElementById('dg-out').textContent; if(t && !/מחשב מרחקים/.test(t)) break; }
    const out=document.getElementById('dg-out');
    return { hasDetails:!!out.querySelector('details'), hasRefresh:!!out.querySelector('#dg-refresh'), txt:out.textContent };
  }, {gans, stuGeo});
  const dgGan=(id,lat,lng,manual)=>({id,ganName:'גן '+id,active:true,education:'רגיל',city:'מודיעין עילית',
    address:'רחוב',building:id, geo: manual?{lat,lng,manual:true,q:'__manual__'}:{lat,lng,q:'רחוב '+id}});
  const threeManual=[dgGan('a',31.9345,35.0432,true),dgGan('b',31.9300,35.0380,true),dgGan('c',31.9360,35.0450,true)];

  await step('פרטים טכניים מוצגים גם כשהבדיקה מצליחה', async()=>{
    const r=await proxDiag(threeManual, {lat:31.9330,lng:35.0410,manual:true,q:'__manual__'});
    if(!/ק"מ/.test(r.txt)) return 'הבדיקה לא הצליחה: '+r.txt.slice(0,120);
    if(!r.hasDetails) return 'אין מקטע "פרטים טכניים" בתוצאה מוצלחת';
    if(!/עוגן העיר/.test(r.txt)) return 'הפירוט לא כולל את עוגן העיר';
    return true; });

  await step('כפתור "חישוב מחדש" קיים גם כשהכתובת לא זוהתה', async()=>{
    const r=await proxDiag(threeManual, {lat:32.95,lng:35.30,q:'חפץ חיים 16, מודיעין עילית, ישראל'});
    if(/ק"מ אווירי/.test(r.txt)) return 'הכתובת השגויה התקבלה במקום להידחות';
    if(!r.hasRefresh) return 'אין כפתור "חישוב מחדש" — כישלון נשמר במטמון ואין דרך לנסות שוב';
    return true; });

  await step('פרטים טכניים מוצגים גם כשכתובת התלמידה לא זוהתה', async()=>{
    // המטמון רחוק → נדחה מול העוגן הידני, והגאוקוד מחדש נכשל (אין רשת)
    const r=await proxDiag(threeManual, {lat:32.95,lng:35.30,q:'חפץ חיים 16, מודיעין עילית, ישראל'});
    if(/ק"מ אווירי/.test(r.txt)) return 'הכתובת השגויה התקבלה במקום להידחות';
    if(!r.hasDetails) return 'אין מקטע "פרטים טכניים" כשהכתובת נדחתה';
    if(!/עוגן העיר/.test(r.txt)) return 'הפירוט לא כולל את עוגן העיר';
    return true; });

  await step('פרטים טכניים מוצגים גם כשכל הגנים רחוקים', async()=>{
    const r=await proxDiag([dgGan('a',31.9345,35.0432,true),dgGan('b',31.9300,35.0380,true)],
                           {lat:32.95,lng:35.30,q:'חפץ חיים 16, מודיעין עילית, ישראל'});
    if(!/כל.{0,3} הגנים יצאו במרחק לא סביר/.test(r.txt)) return 'לא נוצר מצב "כל הגנים רחוקים"';
    if(!r.hasDetails) return 'אין מקטע "פרטים טכניים" כשכל הגנים רחוקים';
    return true; });

  /* ---- נפילה אחורה לרחוב בלי מספר בית ---- */
  await step('geoDropHouseNo מוריד רק את מספר הבית', ()=>pg.evaluate(()=>{
    const c=[['חפץ חיים 16, מודיעין עילית, ישראל','חפץ חיים, מודיעין עילית, ישראל'],
             ['נתיבות המשפט 75, מודיעין עילית, ישראל','נתיבות המשפט, מודיעין עילית, ישראל'],
             ['חזון איש 3א, מודיעין עילית, ישראל','חזון איש, מודיעין עילית, ישראל'],
             ['חפץ חיים, מודיעין עילית, ישראל',''],          // אין מספר — אין נפילה אחורה
             ['בלי פסיק','']];
    for(const [a,b] of c){ const r=geoDropHouseNo(a); if(r!==b) return a+' → "'+r+'" במקום "'+b+'"'; }
    return true; }));

  await step('כתובת עם מספר בית שלא נמצא — נופלת למרכז הרחוב ומסומנת', async()=>{
    // הגאוקודר מחזיר תוצאה רק לשאילתה בלי מספר הבית
    await pg.route(/nominatim/, r=>{
      const u=decodeURIComponent(r.request().url());
      const found=/חפץ חיים,/.test(u) && !/חפץ חיים 16/.test(u);
      return r.fulfill({ status:200, contentType:'application/json',
        body: JSON.stringify(found?[{lat:'31.9331',lon:'35.0409'}]:[]) });
    });
    try{
      return await pg.evaluate(async()=>{
        const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
        const st={id:'rx1',geo:null};
        const r=await ensureGeo(st,'חפץ חיים 16, מודיעין עילית, ישראל',false,'מודיעין עילית',bias);
        if(!r || r.lat==null) return 'לא נמצא מיקום גם אחרי הנפילה אחורה';
        if(!st.geo.relaxed) return 'המיקום לא סומן כמרכז הרחוב';
        if(!st.geo.approx) return 'מרכז רחוב חייב להיות מסומן כמקורב';
        return true; });
    } finally { await pg.unroute(/nominatim/); }
  });

  await step('כשגם מרכז הרחוב נכשל — נרשמת סיבת הכישלון', async()=>{
    await pg.route(/nominatim/, r=>r.fulfill({ status:200, contentType:'application/json', body:'[]' }));
    try{
      return await pg.evaluate(async()=>{
        const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
        const st={id:'rx2',geo:null};
        const r=await ensureGeo(st,'חפץ חיים 16, מודיעין עילית, ישראל',false,'מודיעין עילית',bias);
        if(r) return 'התקבל מיקום למרות שהגאוקודר ריק';
        if(!st.geo.why) return 'לא נרשמה סיבת כישלון';
        if(!/גם בלי מספר בית/.test(st.geo.why)) return 'הסיבה לא מציינת שגם מרכז הרחוב נוסה: '+st.geo.why;
        return true; });
    } finally { await pg.unroute(/nominatim/); }
  });

  /* ---- מיקום ידני לתלמידה: המוצא היחיד כשכתובת לא מתגאוקדת ---- */
  await step('בורר "גן / תלמידה" קיים בכלי המיקום הידני', ()=>pg.evaluate(async()=>{
    DB.students=[{id:'pm1',year:DB.activeYear,lastName:'שטרן',firstName:'תמר',city:'מודיעין עילית',
      street:'חפץ חיים',building:'16',geo:null,
      finished:false,docs:{},docFiles:{},programs:{},programsPaid:{},special:{},support:{},createdAt:''}];
    __set('active','map'); route(); await new Promise(r=>setTimeout(r,400));
    const k=document.getElementById('place-kind'); if(!k) return 'אין בורר סוג רשומה';
    const opts=[...k.options].map(o=>o.value).sort().join(',');
    if(opts!=='gan,stu') return 'אפשרויות הבורר: '+opts;
    return true; }));

  await step('בחירת "תלמידה" ממלאת את הרשימה בתלמידות', ()=>pg.evaluate(()=>{
    const k=document.getElementById('place-kind');
    k.value='stu'; k.dispatchEvent(new Event('change'));
    const sel=document.getElementById('place-gan');
    const has=[...sel.options].some(o=>o.value==='pm1' && /שטרן/.test(o.textContent));
    if(!has) return 'התלמידה לא מופיעה ברשימה: '+[...sel.options].map(o=>o.textContent).join('|');
    if(!/⚠/.test([...sel.options].find(o=>o.value==='pm1').textContent)) return 'תלמידה בלי מיקום לא סומנה ב-⚠';
    return true; }));

  await step('"שמור מיקום" כותב geo ידני על התלמידה', ()=>pg.evaluate(()=>{
    // Leaflet מנוטרל בבדיקה — מזריקים סמן מינימלי במקומו
    window._placeKind='stu'; window._placeGanId='pm1';
    window._placeMarker={ getLatLng:()=>({lat:31.9331,lng:35.0409}) };
    try{ mapPlaceSave(); }catch(e){ return 'mapPlaceSave נפל: '+e.message; }
    const s=DB.students.find(x=>x.id==='pm1');
    if(!(s.geo && s.geo.manual===true)) return 'לא נשמר מיקום ידני על התלמידה';
    if(s.geo.lat!==31.9331 || s.geo.lng!==35.0409) return 'נשמרו קואורדינטות שגויות';
    if(DB.gans.some(g=>g.geo&&g.geo.lat===31.9331)) return 'המיקום נכתב בטעות על גן';
    return true; }));

  await step('מיקום ידני של תלמידה מנצח כל גאוקוד', ()=>pg.evaluate(async()=>{
    const s=DB.students.find(x=>x.id==='pm1');
    const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
    const r=await ensureGeo(s,'חפץ חיים 16, מודיעין עילית, ישראל',true,'מודיעין עילית',bias);
    if(!r || r.lat!==31.9331) return 'מיקום ידני של תלמידה לא כובד (force=true)';
    if(!s.geo.manual) return 'הסימון הידני אבד';
    return true; }));

  /* ---- שמות עיר חלופיים: "קרית ספר" כשהספק לא מכיר "מודיעין עילית" ---- */
  await step('סדר הניסיונות כולל מספר בית, מרכז רחוב ושם עיר חלופי', ()=>pg.evaluate(()=>{
    const c=geoQueryCandidates('חפץ חיים 16, מודיעין עילית, ישראל','מודיעין עילית');
    const qs=c.map(x=>x.q);
    if(qs[0]!=='חפץ חיים 16, מודיעין עילית, ישראל') return 'הניסיון הראשון אינו הכתובת המקורית';
    if(!qs.includes('חפץ חיים, מודיעין עילית, ישראל')) return 'חסר ניסיון בלי מספר בית';
    if(!qs.includes('חפץ חיים 16, קרית ספר, ישראל')) return 'חסר ניסיון עם השם החלופי: '+qs.join(' | ');
    if(!c.find(x=>x.alt).city) return 'לניסיון החלופי אין עיר';
    return true; }));

  await step('כתובת שנמצאת רק תחת השם החלופי — מתקבלת ומסומנת', async()=>{
    // הספק מכיר רק "קרית ספר"; על "מודיעין עילית" הוא מחזיר את מושב חפץ חיים הרחוק
    await pg.route(/nominatim/, r=>{
      const u=decodeURIComponent(r.request().url());
      if(/קרית ספר/.test(u)) return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify([{lat:'31.9331',lon:'35.0409'}])});
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify([{lat:'31.7900',lon:'34.8100'}])});   // מושב חפץ חיים
    });
    try{
      return await pg.evaluate(async()=>{
        const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
        const st={id:'ac1',geo:null};
        const r=await ensureGeo(st,'חפץ חיים 16, מודיעין עילית, ישראל',false,'מודיעין עילית',bias);
        if(!r || r.lat==null) return 'לא התקבל מיקום למרות שהשם החלופי עובד';
        if(Math.abs(r.lat-31.9331)>0.001) return 'התקבל המיקום הרחוק ולא הנכון: '+r.lat;
        if(st.geo.altCity!=='קרית ספר') return 'לא סומן שהמיקום התקבל לפי שם חלופי';
        return true; });
    } finally { await pg.unroute(/nominatim/); }
  });

  await step('כשכל ההתאמות מחוץ לעיר — נדחות ונרשמת הסיבה', async()=>{
    await pg.route(/nominatim/, r=>r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify([{lat:'31.7900',lon:'34.8100'}])}));   // תמיד המושב הרחוק
    try{
      return await pg.evaluate(async()=>{
        const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
        const st={id:'ac2',geo:null};
        const r=await ensureGeo(st,'חפץ חיים 16, מודיעין עילית, ישראל',false,'מודיעין עילית',bias);
        if(r) return 'התקבל מיקום רחוק במקום להידחות';
        if(!st.geo.outCity) return 'לא סומן outCity';
        if(!/מחוץ לרדיוס/.test(st.geo.why||'')) return 'הסיבה לא מציינת דחייה: '+st.geo.why;
        return true; });
    } finally { await pg.unroute(/nominatim/); }
  });

  /* ---- מפת רחובות מקומית מהגנים שהוצבו ידנית ---- */
  await step('פיצול כתובת לרחוב ומספר', ()=>pg.evaluate(()=>{
    const c=[['נתיבות המשפט 75',['נתיבות המשפט',75]],['רח׳ חפץ חיים 16',['חפץ חיים',16]],
             ['חזון איש 3א',['חזון איש',3]],['אבני נזר',['אבני נזר',null]]];
    for(const [a,b] of c){ const r=splitStreetNo(a);
      if(r.street!==b[0]||r.no!==b[1]) return a+' → '+JSON.stringify(r); }
    return true; }));

  await step('תלמידה ברחוב שיש בו גן מוצב — מקבלת מיקום מקורב', async()=>{
    await pg.route(/nominatim/, r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    try{
      return await pg.evaluate(async()=>{
        DB.gans=[{id:'sg1',ganName:'א',active:true,education:'רגיל',city:'מודיעין עילית',
                  address:'חפץ חיים',building:'20',geo:{lat:31.9340,lng:35.0420,manual:true,q:'__manual__'}},
                 {id:'sg2',ganName:'ב',active:true,education:'רגיל',city:'מודיעין עילית',
                  address:'חפץ חיים',building:'90',geo:{lat:31.9380,lng:35.0470,manual:true,q:'__manual__'}}];
        const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
        const st={id:'sp1',geo:null};
        const r=await ensureGeo(st,'חפץ חיים 16, מודיעין עילית, ישראל',false,'מודיעין עילית',bias);
        if(!r || r.lat==null) return 'לא התקבל מיקום מהרחוב המוכר';
        if(r.lat!==31.9340) return 'נבחר הגן הרחוק במספור (16 קרוב ל-20): '+r.lat;
        if(!st.geo.approx) return 'מיקום לפי רחוב חייב להיות מסומן כמקורב';
        if(st.geo.byStreet!=='חפץ חיים') return 'לא נרשם הרחוב שממנו נגזר';
        return true; });
    } finally { await pg.unroute(/nominatim/); }
  });

  await step('רחוב שאין בו גן מוצב — לא ממציא מיקום', async()=>{
    await pg.route(/nominatim/, r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    try{
      return await pg.evaluate(async()=>{
        const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
        const st={id:'sp2',geo:null};
        const r=await ensureGeo(st,'רחוב שלא קיים 5, מודיעין עילית, ישראל',false,'מודיעין עילית',bias);
        if(r) return 'הומצא מיקום לרחוב לא מוכר';
        return true; });
    } finally { await pg.unroute(/nominatim/); }
  });

  await step('גן בעיר אחרת לא מזהם את מפת הרחובות', async()=>{
    await pg.route(/nominatim/, r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    try{
      return await pg.evaluate(async()=>{
        DB.gans=[{id:'sg9',ganName:'רחוק',active:true,education:'רגיל',city:'ביתר עילית',
                  address:'חפץ חיים',building:'16',geo:{lat:31.6990,lng:35.1200,manual:true,q:'__manual__'}}];
        const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
        const st={id:'sp3',geo:null};
        const r=await ensureGeo(st,'חפץ חיים 16, מודיעין עילית, ישראל',false,'מודיעין עילית',bias);
        if(r) return 'נלקח גן מעיר אחרת: '+r.lat;
        return true; });
    } finally { await pg.unroute(/nominatim/); }
  });

  /* ---- סינון מדינה: מוחק יישובים שהספק אינו משייך ל-IL ---- */
  await step('שאילתת Nominatim עם תיבת עיר אינה מסננת לפי מדינה', async()=>{
    let seen=null;
    await pg.route(/nominatim/, r=>{ seen=decodeURIComponent(r.request().url());
      return r.fulfill({status:200,contentType:'application/json',body:'[]'}); });
    try{
      await pg.evaluate(async()=>{
        const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
        try{ await geocodeOnce('חפץ חיים 16, מודיעין עילית, ישראל','מודיעין עילית',bias); }catch(e){}
      });
      if(!seen) return 'לא נשלחה בקשה';
      if(/countrycodes/.test(seen)) return 'עדיין מסנן לפי מדינה: '+seen;
      if(!/bounded=1/.test(seen)) return 'אבד הגבול הגיאוגרפי (viewbox)';
      return true;
    } finally { await pg.unroute(/nominatim/); }
  });

  await step('בלי תיבת עיר — סינון המדינה נשאר כגבול היחיד', async()=>{
    let seen=null;
    await pg.route(/nominatim/, r=>{ seen=decodeURIComponent(r.request().url());
      return r.fulfill({status:200,contentType:'application/json',body:'[]'}); });
    try{
      await pg.evaluate(async()=>{ try{ await geocodeOnce('רחוב כלשהו 1','',null); }catch(e){} });
      if(!/countrycodes=il/.test(seen||'')) return 'אין גבול כלל: '+seen;
      return true;
    } finally { await pg.unroute(/nominatim/); }
  });

  await step('סיומת המדינה מוסרת בניסיון נפרד', ()=>pg.evaluate(()=>{
    if(geoStripCountry('חפץ חיים 16, מודיעין עילית, ישראל')!=='חפץ חיים 16, מודיעין עילית')
      return 'לא הוסרה הסיומת';
    if(geoStripCountry('חפץ חיים 16, מודיעין עילית')!=='') return 'הוסר משהו כשאין סיומת';
    const qs=geoQueryCandidates('חפץ חיים 16, מודיעין עילית, ישראל','מודיעין עילית').map(x=>x.q);
    if(!qs.includes('חפץ חיים 16, מודיעין עילית')) return 'אין ניסיון בלי סיומת מדינה: '+qs.join(' | ');
    return true; }));

  await step('כתובת שנמצאת רק בלי סיומת המדינה — מתקבלת', async()=>{
    await pg.route(/nominatim/, r=>{
      const u=decodeURIComponent(r.request().url());
      const ok=/q=חפץ חיים 16, מודיעין עילית(&|$)/.test(u.replace(/\+/g,' '));
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify(ok?[{lat:'31.9331',lon:'35.0409'}]:[])});
    });
    try{
      return await pg.evaluate(async()=>{
        DB.gans=[];   // בלי מפת רחובות מקומית — שהתוצאה תגיע מהגאוקודר
        const bias={ city:'מודיעין עילית', lat:31.93102, lng:35.04723, src:'manual' };
        const st={id:'nc1',geo:null};
        const r=await ensureGeo(st,'חפץ חיים 16, מודיעין עילית, ישראל',false,'מודיעין עילית',bias);
        if(!r || r.lat==null) return 'לא התקבל מיקום גם בלי סיומת המדינה';
        if(Math.abs(r.lat-31.9331)>0.001) return 'התקבל מיקום שגוי: '+r.lat;
        return true; });
    } finally { await pg.unroute(/nominatim/); }
  });

  /* ---- מרחק הליכה: כשאינו זמין, חייבת להופיע סיבה ולא רק "אווירי" ---- */
  await step('כשאין גשר — נרשמת סיבה לחוסר מרחק הליכה', ()=>pg.evaluate(async()=>{
    const g={id:'wk1',geo:{lat:31.934,lng:35.042}};
    const out=await mapWalk({lat:31.933,lng:35.041},[g]);
    if(out[0]!==null) return 'התקבל מרחק הליכה בלי גשר';
    if(!_walkWhy) return 'לא נרשמה סיבה — המשתמש רואה "אווירי" בלי הסבר';
    return true; }));

  await step('הסיבה מוצגת בתוצאות ובפרטים הטכניים', async()=>{
    const r=await proxDiag(threeManual,{lat:31.9331,lng:35.0409,manual:true,q:'__manual__'});
    if(!/ק"מ/.test(r.txt)) return 'הבדיקה לא הצליחה';
    if(!/מרחק ההליכה אינו זמין/.test(r.txt)) return 'אין הסבר מדוע מוצג מרחק אווירי';
    if(!/מרחק הליכה לא זמין/.test(r.txt)) return 'הסיבה חסרה בפרטים הטכניים';
    return true; });

  await step('קודי שגיאה של הגשר מתורגמים להנחיה מעשית', ()=>pg.evaluate(()=>{
    const c=[['bad-response:200:OK',/אינה JSON/],['unknown-action',/לפרסם אותו מחדש/],
             ['REQUEST_DENIED',/Distance Matrix/],['no-geo-key',/אין מפתח/],
             ['network',/חיבור/],['OVER_QUERY_LIMIT',/מכסת/]];
    for(const [code,re] of c){ const t=bridgeErrHe(code);
      if(!re.test(t)) return code+' → "'+t+'"'; 
      if(t===code) return code+' לא תורגם'; }
    if(/גרסה ישנה/.test(bridgeErrHe('bad-response:200:OK'))) return 'bad-response עדיין מאשים בגרסה ישנה';
    return true; }));

  await step('גרסת הגשר החיה קובעת אם "שליחה למייל" נתמכת', async()=>await pg.evaluate(async()=>{
    __forceDriveReady();
    // גשר ישן — אינו מדווח גרסה כלל
    __setDriveCall(async a=> a==='ping' ? { ok:true, rootId:'r', rootLink:'https://drive/x' } : { ok:true });
    await drivePing(); const oldBridge = bridgeHasMailDoc();
    // גשר מעודכן
    __setDriveCall(async a=> a==='ping' ? { ok:true, rootId:'r', rootLink:'https://drive/x', version:'2026-08-25' } : { ok:true });
    await drivePing(); const newBridge = bridgeHasMailDoc();
    return oldBridge===false && newBridge===true; }));
  await step('כשל mailDoc מציג הנחיית פריסה מדויקת עם הגרסה החיה', async()=>await pg.evaluate(async()=>{
    __forceDriveReady();
    __setDriveCall(async a=>{ if(a==='ping') return { ok:true, rootId:'r', rootLink:'https://drive/x', version:'2026-01-01' };
      throw new Error('unknown-action'); });
    await shareReportDoc({ title:'בדיקה', subtitle:'', headers:['a'], rows:[['x']] });
    const inp=document.querySelector('#sd-to'); inp.value='a@b.com';
    document.querySelector('#sd-send').click();
    await new Promise(r=>setTimeout(r,2500));
    const t=document.querySelector('#sd-msg').textContent;
    shareDocClose();
    if(!t.includes('mailDoc')) return 'אין אזכור ל-mailDoc: '+t.slice(0,120);
    if(!t.includes('2026-01-01')) return 'לא מוצגת גרסת הגשר החיה: '+t.slice(0,120);
    if(!t.includes('New version')) return 'חסרה הנחיית הפריסה: '+t.slice(0,120);
    return true; }));

  /* ---- Distance Matrix מוגבל ל-25 יעדים בבקשה ---- */
  await step('בקשת מרחקי הליכה מפוצלת למנות של 25 לכל היותר', async()=>{
    const sizes=await pg.evaluate(async()=>{
      const seen=[];
      window.__forceDriveReady(); window._geoGoogle=true;
      window.__setDriveCall(async(action,payload)=>{
        if(action!=='walk') throw new Error('unexpected-action:'+action);
        seen.push(payload.dests.length);
        return { ok:true, results: payload.dests.map(()=>({ m:100, sec:60 })) };
      });
      const gans=[]; for(let i=0;i<60;i++) gans.push({id:'ck'+i,geo:{lat:31.93+i/10000,lng:35.04+i/10000}});
      const out=await mapWalk({lat:31.9310,lng:35.0472}, gans);
      return { sizes:seen, filled:out.filter(Boolean).length };
    });
    if(!sizes.sizes.length) return 'לא נשלחה בקשת walk כלל';
    if(sizes.sizes.some(n=>n>25)) return 'מנה חרגה מ-25: '+sizes.sizes.join(',');
    if(sizes.sizes.reduce((a,b)=>a+b,0)!==60) return 'לא כל היעדים נשלחו: '+sizes.sizes.join(',');
    if(sizes.filled!==60) return 'לא כל התוצאות שובצו חזרה: '+sizes.filled;
    return true; });

  await step('תשובה שאינה JSON נשמרת עם התוכן שהוחזר', ()=>pg.evaluate(()=>{
    const t=bridgeErrHe('bad-response:200:OK');
    if(/גרסה ישנה/.test(t)) return 'עדיין מאשים בגרסה ישנה: '+t;
    if(!/OK/.test(t)) return 'התוכן שהוחזר לא נשמר: '+t;
    return true; }));

  console.log('============================================');
  console.log(fail? ('תוצאה: '+fail+' נכשלו') : 'תוצאה: כל בדיקות הדפדפן עברו ✅');
  await b.close(); server.close();
  process.exit(fail?1:0);
})();
