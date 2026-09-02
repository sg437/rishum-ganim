/* ============================================================================
   בדיקת דפדפן — ריבוי ערים (Playwright + Chromium)
   ----------------------------------------------------------------------------
   טוענת את index.html האמיתי עם Firebase מדומה (בלי רשת), ומוודאת את שכבת
   הערים: המרשם המרכזי, בחירת העיר, ההרשאה לפי עיר (משתמש/ת של מודיעין עילית
   אינו/ה רואה ירושלים; המרכז רואה הכל; ותיק/ה שאינו/ה במרשם — עיר הבית לפי
   רשימת המורשים שלה), נתיבי הענן לפי עיר (app מול cities/<id>/app), הבידוד
   של עריכות-ממתינות בין ערים, מגדר/רישיון בכרטיס הגן ופאנל המרשם בהגדרות.
   וכן: המרכזי (management.html) אינו טוען את עיצוב תוכנת הערים.
   הרצה:  NODE_PATH=$(npm root) node tests/multi-city.test.cjs
   ============================================================================ */
const fs=require('fs'), path=require('path');
let chromium;
try{ ({chromium}=require('playwright')); }
catch(e){ console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית).'); process.exit(0); }
const ROOT=path.join(__dirname,'..');
const TMP=fs.mkdtempSync(path.join(require('os').tmpdir(),'rg-city-'));
let html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
html=html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/,'');
html=html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g,'./fbstub.js');
html=html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','./noop.js');
const expose=`
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='CITY')CITY=v; else if(k==='ORG')ORG=v; else if(k==='currentUser')currentUser=v; else if(k==='orgLoaded')orgLoaded=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; else if(k==='db')db=v; };
window.__get=k=> k==='active'?active : k==='CITY'?CITY : k==='ORG'?ORG : k==='DB'?DB : k==='currentUser'?currentUser : undefined;
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.defineProperty(window,'CITY',{get:()=>CITY,set:v=>{CITY=v},configurable:true});
Object.defineProperty(window,'ORG',{get:()=>ORG,set:v=>{ORG=v},configurable:true});
Object.defineProperty(window,'_pending',{get:()=>_pending,configurable:true});
Object.defineProperty(window,'currentUser',{get:()=>currentUser,set:v=>{currentUser=v},configurable:true});
window.__resetCity=()=>{ _cityResolved=false; };
Object.assign(window,{ switchCity, HOME_CITY, orgCities, cityById, cityIsLegacy, cityRole, cityAccess, myCities, isHQ, isAdmin, myEditScope, emailAllowed, cityRestPath, cityRestBase, cityIdFrom, normOrg, onOrgReady, enterCity, renderCityPick, renderOrgPanel, route, openGan, makeGan, ganGender, GENDERS, closeModal, _pendingRestoreOnce, PENDING_LS_KEY, stopDataSync, saveOrg, cityBridgeArgs, defaultSubtitle, appSubtitle, mainCityName, TABS, SETTINGS_SECTIONS, settingsNavHtml, knownEmails });
window.__ready=true;
`;
const endIdx=html.lastIndexOf('</script>');
html=html.slice(0,endIdx)+expose+html.slice(endIdx);
fs.writeFileSync(path.join(TMP,'app.html'),html);
fs.writeFileSync(path.join(TMP,'noop.js'),'window.L=window.L||{};');
/* Firebase מדומה — רושם את הנתיבים שנבנים כדי לוודא שהעיר הנכונה נכתבת */
fs.writeFileSync(path.join(TMP,'fbstub.js'),`
const noop=()=>{}; const P=()=>Promise.resolve();
window.__paths=[]; window.__writes=[];
export const initializeApp=()=>({name:'stub'});
export const getAuth=()=>({currentUser:null});
export const onAuthStateChanged=(a,cb)=>{ window.__authCb=cb; setTimeout(()=>cb(null),0); return noop; };
export const signInWithEmailAndPassword=P, sendPasswordResetEmail=P, signInWithPopup=P;
export const signOut=()=>{ window.__signedOut=(window.__signedOut||0)+1; return Promise.resolve(); };
export class GoogleAuthProvider{ setCustomParameters(){} }
export const initializeFirestore=()=>({stub:true});
export const persistentLocalCache=()=>({}), persistentMultipleTabManager=()=>({});
export const doc=(db,...segs)=>{ const p=segs.join('/'); window.__paths.push(p); return {path:p}; };
export const collection=(db,...segs)=>{ const p=segs.join('/'); window.__paths.push(p); return {path:p, coll:true}; };
export const setDoc=(ref,data)=>{ window.__writes.push({path:ref.path,data}); return Promise.resolve(); };
export const deleteDoc=P, terminate=P, clearIndexedDbPersistence=P, disableNetwork=P, enableNetwork=P;
export const onSnapshot=(ref,opts,cb,err)=>{ window.__snaps=window.__snaps||[]; window.__snaps.push({path:ref.path, cb:typeof opts==='function'?opts:cb}); return noop; };
export const writeBatch=()=>({set:noop,delete:noop,commit:P});
export const runTransaction=P;
export const initializeAppCheck=()=>({}); export class ReCaptchaV3Provider{}
`);
/* המרכזי — בלי Firebase (הרשת חסומה): רק בודקים שהעיצוב של תוכנת הערים לא נטען */
let mgmt=fs.readFileSync(path.join(ROOT,'management.html'),'utf8');
mgmt=mgmt.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/,'');
fs.writeFileSync(path.join(TMP,'management.html'),mgmt);
fs.writeFileSync(path.join(TMP,'ui-lab.css'),'html.ui-lab body{outline:9px solid red}');
fs.writeFileSync(path.join(TMP,'ui-lab.js'),'window.__uiLabLoaded=true;');

const PORT=8737;
const server=require('http').createServer((req,res)=>{
  const f=path.join(TMP, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''));
  try{ const body=fs.readFileSync(f);
    const ct = f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css':'text/plain';
    res.writeHead(200,{'Content-Type':ct}); res.end(body);
  }catch(e){ res.writeHead(404); res.end('nf'); }
});
(async()=>{
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  const b=await chromium.launch({ executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
  const pg=await b.newPage();
  const errors=[];
  pg.on('pageerror',e=>errors.push('pageerror: '+e.message));
  const BENIGN=/Failed to load resource|net::ERR_/;
  pg.on('console',m=>{ if(m.type()==='error' && !BENIGN.test(m.text())) errors.push('console: '+m.text()); });
  await pg.route('**',r=>{ const u=r.request().url(); if(u.startsWith('http://127.0.0.1:'+PORT+'/')) return r.continue(); return r.abort(); });
  await pg.goto('http://127.0.0.1:'+PORT+'/app.html');
  await pg.waitForTimeout(700);
  const ready=await pg.evaluate(()=>!!window.__ready);
  if(!ready){ console.log('❌ האפליקציה לא נטענה'); errors.forEach(e=>console.log('   '+e)); await b.close(); server.close(); process.exit(1); }

  let fail=0;
  const step=async(name,fn)=>{
    const before=errors.length; let r;
    try{ r=await fn(); }catch(e){ r='EX: '+e.message; }
    const newErr=errors.slice(before);
    const ok = r===true && !newErr.length;
    if(!ok){ fail++; console.log('❌ '+name+(r!==true?(' → '+r):'')+(newErr.length?('\n   '+newErr.join('\n   ')):'')); }
    else console.log('✅ '+name);
  };

  /* ---- המרשם ---- */
  const ORG_SAMPLE={
    cities:[ {id:'jerusalem',name:'ירושלים',region:'ירושלים',active:true}, {id:'ashdod',name:'אשדוד',region:'דרום',active:true}, {id:'old-city',name:'עיר מושהית',active:false} ],
    users:{
      'hq@example.com':{ name:'מרכז', hq:true, cities:{} },
      'modiin@example.com':{ name:'רכזת מודיעין', hq:false, cities:{ 'modiin-illit':'edit' } },
      'multi@example.com':{ name:'מנהל שתי ערים', hq:false, cities:{ 'modiin-illit':'admin', 'jerusalem':'view' } },
      'legacy-list@example.com':{ name:'צורה ישנה', hq:false, cities:['ashdod'] },
      'nowhere@example.com':{ name:'בלי עיר', hq:false, cities:{} }
    }
  };
  await step('עיר הבית תמיד קיימת ברשימת הערים, גם כשהמרשם ריק', ()=>pg.evaluate(()=>{
    ORG={cities:[],users:{}};
    const c=orgCities(); return c.length===1 && c[0].id===HOME_CITY.id && cityIsLegacy(c[0]) && c[0].name==='מודיעין עילית';
  }));
  await step('normOrg מנקה מיילים ל-lowercase ומסנן ערים בלי מזהה', ()=>pg.evaluate(()=>{
    const o=normOrg({ cities:[{id:'x',name:'X'},{name:'בלי מזהה'}], users:{ 'A@B.com':{hq:true}, bad:'str' } });
    return o.cities.length===1 && !!o.users['a@b.com'] && !o.users.bad;
  }));
  await step('משתמש/ת של מודיעין עילית: רואה רק את מודיעין עילית, לא את ירושלים', ()=>pg.evaluate((o)=>{
    ORG=normOrg(o); currentUser={email:'modiin@example.com'};
    const mine=myCities().map(c=>c.id);
    return JSON.stringify(mine)==='["modiin-illit"]' && cityAccess('modiin-illit')===true && cityAccess('jerusalem')===false && cityAccess('ashdod')===false && !isHQ();
  }, ORG_SAMPLE));
  await step('משתמש/ת מרכז: רואה את כל הערים הפעילות (לא מושהות) והוא/היא מנהל/ת בכל עיר', ()=>pg.evaluate(()=>{
    currentUser={email:'HQ@example.com'};
    const mine=myCities().map(c=>c.id);
    return isHQ() && mine.length===3 && mine.includes('modiin-illit') && mine.includes('jerusalem') && mine.includes('ashdod') && !mine.includes('old-city') && cityAccess('jerusalem') && cityAccess('old-city') && isAdmin();
  }));
  await step('בעלי המערכת — תמיד מרכז, גם כשאינם במרשם', ()=>pg.evaluate(()=>{
    currentUser={email:'sg@taharat.org'}; return isHQ() && myCities().length===3 && cityAccess('ashdod');
  }));
  await step('משתמש/ת עם כמה ערים: מנהל/ת במודיעין, צופה בירושלים, בלי אשדוד', ()=>pg.evaluate(()=>{
    currentUser={email:'multi@example.com'};
    const mine=myCities().map(c=>c.id).sort();
    CITY=cityById('modiin-illit'); const admA=isAdmin(), scA=myEditScope();
    CITY=cityById('jerusalem');    const admJ=isAdmin(), scJ=myEditScope();
    return JSON.stringify(mine)==='["jerusalem","modiin-illit"]' && cityRole('modiin-illit')==='admin' && cityRole('jerusalem')==='view' && cityRole('ashdod')==='' && admA && scA==='' && !admJ && scJ==='צופה';
  }));
  await step('צורה ישנה של המרשם (רשימת מזהים) = עריכה', ()=>pg.evaluate(()=>{
    currentUser={email:'legacy-list@example.com'}; return cityRole('ashdod')==='edit' && cityAccess('ashdod') && !cityAccess('modiin-illit');
  }));
  await step('משתמש/ת שבמרשם בלי אף עיר — אין גישה לשום עיר (גם לא לעיר הבית)', ()=>pg.evaluate(()=>{
    currentUser={email:'nowhere@example.com'}; DB.settings.allowedEmails=['nowhere@example.com'];
    const r = myCities().length===0 && !cityAccess('modiin-illit') && !emailAllowed('nowhere@example.com');
    DB.settings.allowedEmails=[]; return r;
  }));
  await step('משתמש/ת ותיק/ה שאינו/ה במרשם — עיר הבית לפי רשימת המורשים של העיר, ולא ערים אחרות', ()=>pg.evaluate(()=>{
    currentUser={email:'old@example.com'};
    DB.settings.allowedEmails=['old@example.com'];
    CITY=cityById('modiin-illit');
    const a = myCities().map(c=>c.id).join()==='modiin-illit' && cityAccess('modiin-illit') && emailAllowed('old@example.com') && !cityAccess('jerusalem');
    DB.settings.allowedEmails=[];
    const b = !cityAccess('modiin-illit') && !emailAllowed('old@example.com');
    return a && b;
  }));

  /* ---- נתיבי הענן ---- */
  await step('עיר הבית כותבת לאוסף app; עיר אחרת ל-cities/<id>/app (גם ב-REST)', ()=>pg.evaluate(()=>{
    CITY=cityById('modiin-illit');
    const a = cityRestPath()==='app' && cityRestBase().endsWith('/documents/app');
    CITY=cityById('jerusalem');
    const b = cityRestPath()==='cities/jerusalem/app' && cityRestBase().endsWith('/documents/cities/jerusalem/app');
    return a && b;
  }));
  await step('הסנכרון של עיר נוספת מאזין ל-cities/<id>/app והנוכחות נכתבת שם', async()=>{
    return await pg.evaluate(async()=>{
      currentUser={email:'hq@example.com'}; window.__set('db',{stub:true});
      window.__paths.length=0; window.__snaps=[];
      stopDataSync(); CITY=cityById('ashdod');
      enterCity(cityById('ashdod'));
      await new Promise(r=>setTimeout(r,50));
      const snap=(window.__snaps||[]).some(s=>s.path==='cities/ashdod/app');
      const pres=window.__writes.some(w=>w.path.startsWith('cities/ashdod/app/presence_'));
      const none=window.__paths.filter(p=>p==='app'||p.startsWith('app/')).length===0;
      stopDataSync();
      return snap && pres && none && CITY.id==='ashdod';
    });
  });
  await step('חזרה לעיר הבית — מאזינים לאוסף app', async()=>{
    return await pg.evaluate(async()=>{
      window.__paths.length=0; window.__snaps=[];
      enterCity(cityById('modiin-illit'));
      await new Promise(r=>setTimeout(r,50));
      const ok=(window.__snaps||[]).some(s=>s.path==='app') && !window.__paths.some(p=>p.startsWith('cities/'));
      return ok && localStorage.getItem('rg-city')==='modiin-illit';
    });
  });
  await step('שמירת המרשם — רק מרכז, ולמסמך org/meta', async()=>{
    return await pg.evaluate(async()=>{
      currentUser={email:'modiin@example.com'};
      let denied=false; try{ await saveOrg(); }catch(e){ denied=/not-hq/.test(e.message); }
      currentUser={email:'hq@example.com'}; window.__writes.length=0;
      await saveOrg();
      const w=window.__writes.find(x=>x.path==='org/meta');
      return denied && !!w && Array.isArray(w.data.cities) && w.data.cities.some(c=>c.id==='modiin-illit') && w.data.updatedBy==='hq@example.com';
    });
  });
  await step('הגשר מקבל את העיר בכל קריאה (cityId/cityName)', ()=>pg.evaluate(()=>{
    CITY=cityById('jerusalem'); const a=cityBridgeArgs();
    CITY=cityById('modiin-illit'); const b=cityBridgeArgs();
    return a.cityId==='jerusalem' && a.cityName==='ירושלים' && a.cityLegacy===false && b.cityId==='modiin-illit' && b.cityLegacy===true;
  }));
  await step('כותרת המשנה נגזרת מהעיר (עיר הבית נשארת כפי שהייתה)', ()=>pg.evaluate(()=>{
    CITY=cityById('jerusalem'); const j=defaultSubtitle();
    CITY=cityById('modiin-illit'); const m=defaultSubtitle();
    return j==='רשת הגנים ירושלים' && m==='רשת הגנים מודיעין עילית' && mainCityName()==='מודיעין עילית';
  }));
  await step('מזהה עיר נגזר משם עברי', ()=>pg.evaluate(()=> cityIdFrom('ביתר עילית')==='bytr-aylyt' && cityIdFrom('Beitar Illit!')==='beitar-illit' && cityIdFrom('')===''));

  /* ---- בחירת עיר בכניסה ---- */
  await step('כניסה עם כמה ערים ובלי העדפה — מסך בחירת עיר, ובחירה מתחילה סנכרון לעיר', async()=>{
    return await pg.evaluate(async()=>{
      stopDataSync(); CITY=null; localStorage.removeItem('rg-city');
      currentUser={email:'multi@example.com'}; window.__set('orgLoaded',true); window.__resetCity();
      window.__snaps=[];
      onOrgReady();
      const btns=[...document.querySelectorAll('#cp-list [data-city]')].map(b=>b.dataset.city).sort();
      if(JSON.stringify(btns)!=='["jerusalem","modiin-illit"]') return 'picker: '+JSON.stringify(btns);
      document.querySelector('#cp-list [data-city="jerusalem"]').click();
      await new Promise(r=>setTimeout(r,50));
      const ok = CITY && CITY.id==='jerusalem' && (window.__snaps||[]).some(s=>s.path==='cities/jerusalem/app') && localStorage.getItem('rg-city')==='jerusalem';
      stopDataSync();
      return ok || ('city='+(CITY&&CITY.id));
    });
  });
  await step('כניסה עם עיר אחת בלבד — בלי מסך בחירה, ישר לעיר', async()=>{
    return await pg.evaluate(async()=>{
      stopDataSync(); CITY=null; localStorage.removeItem('rg-city');
      currentUser={email:'modiin@example.com'}; window.__resetCity(); window.__snaps=[];
      document.getElementById('view').innerHTML='';
      onOrgReady();
      await new Promise(r=>setTimeout(r,50));
      const ok = !document.querySelector('#cp-list') && CITY && CITY.id==='modiin-illit' && (window.__snaps||[]).some(s=>s.path==='app');
      stopDataSync(); return ok || ('city='+(CITY&&CITY.id));
    });
  });
  await step('משתמש/ת במרשם בלי עיר — מסך "אין עיר משויכת"', ()=>pg.evaluate(()=>{
    stopDataSync(); CITY=null; currentUser={email:'nowhere@example.com'}; window.__resetCity();
    onOrgReady();
    return !!document.getElementById('nc-out') && document.getElementById('view').textContent.includes('אין עיר משויכת') && CITY===null;
  }));
  await step('החלפת עיר חסומה כשיש עריכה שטרם נשמרה, ועוברת כשאין', async()=>{
    return await pg.evaluate(async()=>{
      stopDataSync(); currentUser={email:'hq@example.com'}; CITY=cityById('modiin-illit');
      _pending.set('stu:x',{coll:'stu',id:'x',j:null,prev:null});
      switchCity('jerusalem');
      const blocked = CITY.id==='modiin-illit';
      _pending.clear();
      switchCity('jerusalem');
      await new Promise(r=>setTimeout(r,30));
      const moved = CITY.id==='jerusalem';
      switchCity('nope');
      const still = CITY.id==='jerusalem';
      stopDataSync(); CITY=cityById('modiin-illit');
      return blocked && moved && still;
    });
  });
  await step('עריכות-ממתינות של עיר אחרת אינן משוחזרות לעיר הזאת', ()=>pg.evaluate(()=>{
    _pending.clear();
    localStorage.setItem(PENDING_LS_KEY, JSON.stringify({ v:1, owner:'hq@example.com', city:'jerusalem', ts:Date.now(), items:[{coll:'stu',id:'z',j:'{}',prev:null}] }));
    CITY=cityById('modiin-illit');
    // איפוס דגל "כבר נטען פעם אחת" אינו חשוף — לכן בודקים את ההיגיון דרך קריאה ראשונה בלבד
    const r=_pendingRestoreOnce();
    localStorage.removeItem(PENDING_LS_KEY);
    return r===false && _pending.size===0;
  }));

  /* ---- בורר העיר בתפריט והשבב ---- */
  await step('בורר העיר מוצג רק כשיש יותר מעיר אחת', ()=>pg.evaluate(()=>{
    currentUser={email:'modiin@example.com'}; CITY=cityById('modiin-illit'); renderCityPick();
    const one = document.getElementById('drawerCitySec').style.display==='none' && document.getElementById('cityChip').textContent.includes('מודיעין עילית');
    currentUser={email:'hq@example.com'}; renderCityPick();
    const sel=document.getElementById('citySelect');
    const many = document.getElementById('drawerCitySec').style.display!=='none' && sel.options.length===3;
    return one && many;
  }));

  /* ---- הגדרות: פאנל המרשם ---- */
  await step('פאנל "ערים ומשתמשים (מרכזי)" — קיים למרכז ונעלם למשתמש/ת עיר', ()=>pg.evaluate(()=>{
    currentUser={email:'hq@example.com'}; CITY=cityById('modiin-illit'); document.body.classList.remove('locked');
    window.__set('active','settings'); route();
    const hqHas = !!document.querySelector('[data-set="cities"]') && !!document.getElementById('org-box') && settingsNavHtml().includes('data-setjump="cities"');
    const rows=[...document.querySelectorAll('#org-box table')][0];
    const citiesListed = rows && rows.textContent.includes('ירושלים') && rows.textContent.includes('אשדוד') && rows.textContent.includes('עיר הבית');
    currentUser={email:'modiin@example.com'}; route();
    const cityUserHas = !!document.querySelector('[data-set="cities"]') || settingsNavHtml().includes('data-setjump="cities"');
    return hqHas && citiesListed && !cityUserHas;
  }));
  await step('הוספת עיר מהפאנל — נשמרת למרשם עם מזהה תקני', async()=>{
    return await pg.evaluate(async()=>{
      currentUser={email:'hq@example.com'}; route();
      document.getElementById('org-city-name').value='בית שמש';
      document.getElementById('org-city-name').dispatchEvent(new Event('input'));
      window.__writes.length=0;
      document.getElementById('org-city-add').click();
      await new Promise(r=>setTimeout(r,30));
      const w=window.__writes.find(x=>x.path==='org/meta');
      const c=w && w.data.cities.find(x=>x.name==='בית שמש');
      return !!c && c.id==='byt-shmsh' && c.active===true && cityById('byt-shmsh')!==null;
    });
  });
  await step('שיוך משתמש/ת חדש/ה לעיר עם תפקיד', async()=>{
    return await pg.evaluate(async()=>{
      document.getElementById('org-user-email').value='new@example.com';
      document.getElementById('org-user-city').value='jerusalem';
      document.getElementById('org-user-role').value='view';
      window.__writes.length=0;
      document.getElementById('org-user-add').click();
      await new Promise(r=>setTimeout(r,30));
      const w=window.__writes.find(x=>x.path==='org/meta');
      return !!w && w.data.users['new@example.com'] && w.data.users['new@example.com'].cities.jerusalem==='view' && cityRole('jerusalem','new@example.com')==='view';
    });
  });

  /* ---- מגדר ורישיון בגן ---- */
  await step('כרטיס הגן: מגדר ורישיון נשמרים; התלמיד/ה יורש/ת מגדר מהגן', async()=>{
    return await pg.evaluate(async()=>{
      DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז']; DB.gans=[]; DB.students=[];
      const g=makeGan(); g.ganName='גן הבנים';
      openGan(g);
      document.getElementById('g-gender').value='בנים';
      document.getElementById('g-licenseAges').value='3-4';
      document.getElementById('g-licenseCap').value='35 ילדים';
      document.getElementById('saveGan').click();
      await new Promise(r=>setTimeout(r,30));
      const saved=DB.gans.find(x=>x.ganName==='גן הבנים');
      return !!saved && saved.gender==='בנים' && saved.licenseAges==='3-4' && saved.licenseCap==='35' && ganGender(saved.id)==='בנים' && GENDERS.length===2 && 'gender' in makeGan();
    });
  });

  /* ---- המרכזי: הפרדת עיצוב ---- */
  const pg2=await b.newPage();
  const err2=[];
  pg2.on('pageerror',e=>err2.push('pageerror: '+e.message));
  await pg2.route('**',r=>{ const u=r.request().url(); if(u.startsWith('http://127.0.0.1:'+PORT+'/')) return r.continue(); return r.abort(); });
  await pg2.goto('http://127.0.0.1:'+PORT+'/management.html?ui=new');
  await pg2.waitForTimeout(600);
  await step('המרכזי אינו טוען את עיצוב תוכנת הערים (ui-lab) גם עם ?ui=new', async()=>{
    const r=await pg2.evaluate(()=>({ cls:document.documentElement.classList.contains('ui-lab'), lab:!!window.__uiLabLoaded, css:[...document.styleSheets].some(s=>(s.href||'').includes('ui-lab')), gate:!!document.getElementById('gate'), skin:!!document.querySelector('.skin-switch') }));
    return (!r.cls && !r.lab && !r.css && r.gate && !r.skin) || JSON.stringify(r);
  });
  await step('המרכזי: בלי Firebase השער מוצג עם הסבר, וההדמיה עדיין רצה', async()=>{
    const r=await pg2.evaluate(()=>({ gateShown:!document.getElementById('gate').hidden, err:document.getElementById('gateErr').textContent, kpis:document.querySelectorAll('#homeTicker .tk').length, hasPerms:!!document.getElementById('orgAdmin') }));
    return (r.gateShown && /המודול החי/.test(r.err) && r.kpis>=5 && r.hasPerms) || JSON.stringify(r);
  });
  await step('המרכזי: "כניסה להדמיה" מסירה את השער', async()=>{
    await pg2.click('#gateDemo'); await pg2.waitForTimeout(100);
    return await pg2.evaluate(()=>document.getElementById('gate').hidden===true);
  });
  /* ---- המרכזי במצב חי: מדמים את האירועים שהמודול החי משדר ---- */
  await step('המרכזי: כניסה מוחקת את כל ההדמיה — פידים, ערים מומצאות, מסכי הדמיה', async()=>{
    const r=await pg2.evaluate(()=>{
      document.dispatchEvent(new CustomEvent('central:auth',{detail:{state:'in',email:'hq@example.com'}}));
      const feed=document.querySelectorAll('#feed .ev').length, reg=document.querySelectorAll('#regFeed .ev').length;
      const hiddenNav=[...document.querySelectorAll('#drawerNav .navitem')].filter(b=>b.hidden).map(b=>b.dataset.view).sort();
      const visibleNav=[...document.querySelectorAll('#drawerNav .navitem')].filter(b=>!b.hidden).map(b=>b.dataset.view);
      return { feed, reg, hiddenNav, visibleNav, ticker:document.getElementById('homeTicker').textContent, cityRows:document.querySelectorAll('#cityTable tbody tr.clickable').length, foot:document.getElementById('drFoot').textContent };
    });
    const okHidden=JSON.stringify(r.hiddenNav)===JSON.stringify(['billing','comm','crm','docs','hours','plan','portal','spec']);
    return (r.feed===0 && r.reg===0 && okHidden && r.visibleNav.includes('cities') && r.visibleNav.includes('perms') && /טוען/.test(r.ticker) && r.cityRows===0 && /hq@example.com/.test(r.foot)) || JSON.stringify(r);
  });
  await step('המרכזי: נתונים חיים מעיר מוצגים בתוכו — בלי קישורים החוצה, עם מונים אמיתיים', async()=>{
    const r=await pg2.evaluate(()=>{
      const city={ id:'modiin-illit', name:'מודיעין עילית', region:'מרכז', legacy:true, absorption:'local', coordinator:'צ. שפירא', phone:'', active:true, year:'תשפ"ז', years:['תשפ"ז'],
        gans:[ { id:'g1', name:'גן הדקל', sym:'123', age:'3', edu:'reg', gender:'בנות', campus:'מרכז', region:'מרכז', cap:30, enrolled:2, placed:1, on:true, teacher:'שרה לוי', licenseCap:1, licenseAges:'3', roster:[{r:'גננת',n:'שרה לוי'}], prog:{tzaharon:1,hanuka:0,nisan:0,sofshana:0}, students:[{name:'ילדה א',age:'3',placed:true,period:'א',muni:true},{name:'ילדה ב',age:'3',placed:false,period:'ב',muni:false}] } ],
        gan:1, spc:0, students:2, special:0, placed:1, unplaced:1, unplacedList:[{name:'ילדה ב',city:'מודיעין עילית',cityId:'modiin-illit',age:'3',edu:'reg',gan:'גן הדקל',period:'ב'}],
        muni:1, notMuni:1, todayNew:0, periods:{'א':1,'ב':1,'ג':0,'סופי':0}, byGender:{'בנות':1,'בנים':0}, licenseIssues:1,
        staffList:[{id:'s1',name:'שרה לוי',role:'גננת',tz:'',city:'מודיעין עילית',gan:'גן הדקל',on:true}], staff:1, presence:[{email:'x@y.com',name:'צ. שפירא',ts:Date.now()}],
        admins:[], allowed:[], brand:{}, docs:5, loaded:true, error:'', lastUpdate:Date.now(), live:true };
      document.dispatchEvent(new CustomEvent('central:data',{detail:{ cities:[city], errors:[], org:{cities:[{id:'modiin-illit',name:'מודיעין עילית',legacy:true}],users:{'hq@example.com':{name:'לאה',hq:true,cities:{}}}}, user:{email:'hq@example.com',name:'לאה'}, hq:true }}));
      document.querySelector('[data-view="cities"]').click();
      const detail=document.getElementById('cityDetail').textContent;
      document.querySelector('[data-view="registration"]').click();
      const regRows=document.querySelectorAll('#regForms tbody tr').length, regTxt=document.getElementById('regForms').textContent;
      document.querySelector('[data-view="place"]').click();
      const un=document.getElementById('plUnplaced').textContent;
      document.querySelector('[data-view="perms"]').click();
      const perms=document.getElementById('orgAdmin').textContent;
      return { ticker:document.getElementById('homeTicker').textContent, kpi:document.getElementById('kpiRow').textContent, detail, regRows, regTxt, un, perms,
               links:document.querySelectorAll('a[href*="index.html"]').length, cityRows:document.querySelectorAll('#cityTable tbody tr.clickable').length, ab:document.getElementById('abLiveTxt').textContent };
    });
    const ok = r.cityRows===1 && /תלמידים רשומים/.test(r.kpi) && /מודיעין עילית/.test(r.detail) && /גן הדקל/.test(r.detail) && /רישיון/.test(r.detail)
      && r.regRows===1 && /קליטה דיגיטלית/.test(r.regTxt) && /ילדה ב/.test(r.un) && /hq@example.com/.test(r.perms) && r.links===0 && /נתונים חיים · 1 ערים/.test(r.ab);
    return ok || JSON.stringify({cityRows:r.cityRows, regRows:r.regRows, links:r.links, ab:r.ab, kpi:r.kpi.slice(0,60), detail:r.detail.slice(0,80), un:r.un.slice(0,40)});
  });
  await step('המרכזי: תקלת גישה לעיר מוצגת במפורש (ולא נשארת שקטה)', async()=>{
    const r=await pg2.evaluate(()=>{
      document.dispatchEvent(new CustomEvent('central:data',{detail:{ cities:[{ id:'ashdod', name:'אשדוד', region:'', legacy:false, absorption:'local', coordinator:'', phone:'', active:true, year:'', years:[], gans:[], gan:0, spc:0, students:0, special:0, placed:0, unplaced:0, unplacedList:[], muni:0, notMuni:0, todayNew:0, periods:{}, byGender:{}, licenseIssues:0, staffList:[], staff:0, presence:[], admins:[], allowed:[], brand:{}, docs:0, loaded:false, error:'אין הרשאה (permission-denied)', lastUpdate:0, live:true }], errors:[{id:'ashdod',name:'אשדוד',msg:'אין הרשאה (permission-denied)'}], org:{cities:[],users:{}}, user:{email:'hq@example.com'}, hq:true }}));
      return document.getElementById('liveErrors').textContent;
    });
    return /אשדוד/.test(r) && /permission-denied/.test(r) || r;
  });
  if(err2.length){ fail++; console.log('❌ שגיאות במרכזי:\n   '+err2.join('\n   ')); }

  await b.close(); server.close();
  if(fail){ console.log('\n'+fail+' בדיקות נכשלו'); process.exit(1); }
  console.log('\nכל בדיקות ריבוי הערים עברו ✓');
})().catch(e=>{ console.error(e); process.exit(1); });
