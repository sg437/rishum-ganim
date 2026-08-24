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
// הקוד רץ כמודול (scope נפרד) — חושפים לבדיקה את מה שנדרש
const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; };
window.__get=k=> k==='active'?active : k==='DB'?DB : undefined;
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.defineProperty(window,'stuFilter',{get:()=>stuFilter,set:v=>{stuFilter=v},configurable:true});
Object.assign(window,{ TABS, route, closeModal, openStudentById, openAutoAssign, _mapState, openStuQuick, renderStuTable,
  msgState, msgBuild, msgApplyTemplate, msgManualPanel, msgMerge, AI_TOOLS, aiParseActions, aiOpen, aiClose,
  ganAssignCap, ganAssignedCount, autoAssignPlan, proxPanelHtml, phoneCell });
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
  pg.on('console',m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
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
  await step('טבלת התלמידות: תא זהות עם ראשי תיבות, חיוג ו-🧭', ()=>pg.evaluate(()=>{
    __set('active','students'); route();
    return !!document.querySelector('.stu-prox')
        && !!document.querySelector('td a[href^="tel:"]')
        && !!document.querySelector('.idcell .ini')
        && !!document.querySelector('.docchips .docchip'); }));
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
  await step('פירוק בלוקי פעולה מתשובת המודל', ()=>pg.evaluate(()=>{
    const p=aiParseActions('הנה התשובה\n```action\n{"tool":"stats","args":{}}\n```');
    return p.actions.length===1 && p.actions[0].tool==='stats' && p.text==='הנה התשובה'; }));
  await step('מדריך כולל את המקטעים החדשים', ()=>pg.evaluate(()=>{
    __set('active','guide'); route();
    const t=document.body.innerText;
    return t.includes('מרכז ההודעות') && t.includes('עוזר חכם — פאנל צד שגם מבצע'); }));

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

  console.log('============================================');
  console.log(fail? ('תוצאה: '+fail+' נכשלו') : 'תוצאה: כל בדיקות הדפדפן עברו ✅');
  await b.close(); server.close();
  process.exit(fail?1:0);
})();
