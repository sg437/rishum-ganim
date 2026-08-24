/* ============================================================================
   בדיקת "שומר העיר" בגאוקוד — ensureGeo
   ----------------------------------------------------------------------------
   באג שהיה: בדיקת הקרבה מתוך התיק קראה ל-ensureGeo עם bias=null, ולכן
   (א) הגאוקודר לא קיבל רמז לעיר, ו-(ב) הבדיקה שדוחה תוצאה מחוץ לרדיוס העיר
   לא רצה. רחוב באותו שם בעיר אחרת התקבל בשקט, והוצגו מרחקים של 123 ק"מ בין
   שתי כתובות באותה עיר. בנוסף, המיקום השגוי נשמר במסד והוחזר מהמטמון.

   הבדיקה שולפת את ensureGeo האמיתי מ-index.html ומריצה אותו עם גאוקודר מדומה.
   הרצה:  node tests/geo-city-guard.test.cjs
   ============================================================================ */
const fs=require('fs'), path=require('path'), vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m,i=0,code=null;
while((m=re.exec(html))){ i++; if(i===2) code=m[1]; }
if(!code) throw new Error('לא נמצא הסקריפט הראשי');

function grab(name){
  const a=code.indexOf('\nfunction '+name+'(');
  if(a<0) throw new Error('לא נמצאה הפונקציה: '+name);
  const e=code.indexOf('\n}', a);
  return code.slice(a+1, e+2);
}
function grabAsync(name){
  const a=code.indexOf('\nasync function '+name+'(');
  if(a<0) throw new Error('לא נמצאה הפונקציה: '+name);
  const e=code.indexOf('\n}', a);
  return code.slice(a+1, e+2);
}

function grabConst(name){
  const a=code.indexOf('\nconst '+name+' = {');
  if(a<0) throw new Error('לא נמצא הקבוע: '+name);
  const e=code.indexOf('\n};', a);
  return code.slice(a+1, e+3);
}

const ctx={ console, MAP_CITY_RADIUS_KM:10, geocodeOnce:null, _geoWhy:"" };
vm.createContext(ctx);
vm.runInContext([grab('haversineKm'), grab('geoNearCity'), grabAsync('ensureGeo'),
                 grabConst('CITY_ALIASES'), grabConst('CITY_ALT_NAMES'), grab('normCityName'),
                 grab('geoDropHouseNo'), grab('geoSwapCity'), grab('geoQueryCandidates')].join('\n'), ctx);

const MODIIN={lat:31.9330,lng:35.0400};      // מרכז מודיעין עילית
const NEAR  ={lat:31.9380,lng:35.0455};      // רחוב באותה עיר (~0.7 ק"מ)
const FAR   ={lat:31.4200,lng:34.5900};      // רחוב באותו שם בעיר אחרת (~70 ק"מ)

let fail=0;
const ok=(c,msg)=>{ if(!c){fail++;console.log('❌ '+msg);} else console.log('✅ '+msg); };

(async()=>{
  /* 1. ללא הטיה — תוצאה רחוקה מתקבלת (זו בדיוק ההתנהגות שגרמה לבאג) */
  ctx.geocodeOnce=async()=>({lat:FAR.lat,lng:FAR.lng,source:'stub'});
  let ent={};
  let r=await ctx.ensureGeo(ent,'חפץ חיים 16, מודיעין עילית, ישראל',false,'מודיעין עילית',null);
  ok(r && r.lat===FAR.lat, 'ללא הטיה — תוצאה מחוץ לעיר מתקבלת (מדגים את הבאג)');

  /* 2. עם הטיה — אותה תוצאה רחוקה נדחית ומסומנת outCity */
  ent={};
  r=await ctx.ensureGeo(ent,'חפץ חיים 16, מודיעין עילית, ישראל',false,'מודיעין עילית',MODIIN);
  ok(r===null, 'עם הטיה — תוצאה מחוץ לעיר נדחית');
  ok(ent.geo && ent.geo.outCity===true && ent.geo.lat===null, 'הרשומה מסומנת outCity ובלי קואורדינטות');

  /* 3. עם הטיה — תוצאה בתוך העיר מתקבלת כרגיל */
  ctx.geocodeOnce=async()=>({lat:NEAR.lat,lng:NEAR.lng,source:'stub'});
  ent={};
  r=await ctx.ensureGeo(ent,'נתיבות המשפט 75, מודיעין עילית, ישראל',false,'מודיעין עילית',MODIIN);
  ok(r && r.lat===NEAR.lat, 'תוצאה בתוך העיר מתקבלת');
  ok(ctx.haversineKm(r,MODIIN)<10, 'המרחק ממרכז העיר סביר');

  /* 4. מטמון מורעל — מיקום שגוי שנשמר בעבר נזרק ומחושב מחדש */
  const q='חפץ חיים 16, מודיעין עילית, ישראל';
  ent={ geo:{ lat:FAR.lat, lng:FAR.lng, q, source:'old' } };   // כפי שנשמר במסד לפני התיקון
  ctx.geocodeOnce=async()=>({lat:NEAR.lat,lng:NEAR.lng,source:'stub'});
  r=await ctx.ensureGeo(ent,q,false,'מודיעין עילית',MODIIN);
  ok(r && r.lat===NEAR.lat, 'מטמון מורעל נזרק ומחושב מחדש');

  /* 5. מטמון תקין — מוחזר בלי לגאוקד שוב */
  let called=0; ctx.geocodeOnce=async()=>{called++;return {lat:NEAR.lat,lng:NEAR.lng};};
  ent={ geo:{ lat:NEAR.lat, lng:NEAR.lng, q, source:'cache' } };
  r=await ctx.ensureGeo(ent,q,false,'מודיעין עילית',MODIIN);
  ok(r && called===0, 'מטמון תקין מוחזר בלי גאוקוד חוזר');

  /* 6. מיקום ידני — מכובד תמיד, גם אם הוא מחוץ לרדיוס */
  called=0;
  ent={ geo:{ lat:FAR.lat, lng:FAR.lng, manual:true, q:'__manual__', locType:'MANUAL', tried:true } };
  r=await ctx.ensureGeo(ent,q,false,'מודיעין עילית',MODIIN);
  ok(r && r.manual===true && called===0, 'מיקום ידני נשמר ולא נדרס');

  /* 7. עיר הגן קודמת לעיר הראשית (ganCity) */
  ctx.DB={ students:[{city:'מודיעין עלית'},{city:'מודיעין עלית'}] };
  vm.runInContext([grab('geoDefaultCity'), grab('mainCityName'), grab('ganCity')].join('\n'), ctx);
  ok(ctx.mainCityName()==='מודיעין עילית', 'העיר הראשית נגזרת מהתלמידות ומנורמלת');
  ok(ctx.ganCity({city:'בני ברק'})==='בני ברק', 'גן עם עיר משלו — העיר שלו קובעת');
  ok(ctx.ganCity({city:''})==='מודיעין עילית', 'גן בלי עיר — נופל לעיר הראשית');
  ok(ctx.ganCity({city:'מודיעין עלית'})==='מודיעין עילית', 'עיר הגן עצמה מנורמלת');

  /* 8. נרמול שם עיר — הכתיב שבתיק מפיל את נעילת העיר בגאוקודר */
  ok(ctx.normCityName('מודיעין עלית')==='מודיעין עילית', 'מודיעין עלית → מודיעין עילית');
  ok(ctx.normCityName('ביתר עלית')==='ביתר עילית', 'ביתר עלית → ביתר עילית');
  ok(ctx.normCityName('קרית ספר')==='מודיעין עילית', 'קרית ספר → מודיעין עילית');
  ok(ctx.normCityName('מודיעין עילית')==='מודיעין עילית', 'כתיב תקין נשאר כמו שהוא');
  ok(ctx.normCityName('  מודיעין   עלית  ')==='מודיעין עילית', 'רווחים כפולים מנוקים');
  ok(ctx.normCityName('ירושלים')==='ירושלים', 'עיר אחרת לא מושפעת');
  ok(ctx.normCityName('עלית')==='עילית', '"עלית" כמילה עצמאית מתוקנת');
  ok(ctx.normCityName('')==='', 'מחרוזת ריקה נשארת ריקה');

  console.log('============================================');
  console.log(fail? ('תוצאה: '+fail+' נכשלו') : 'תוצאה: כל הבדיקות עברו ✅');
  console.log('============================================');
  process.exit(fail?1:0);
})();
