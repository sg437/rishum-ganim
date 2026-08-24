/* ============================================================================
   בדיקות לשדרוגים החדשים — רף שיבוץ · שיבוץ אוטומטי לפי קרבה · הודעות
   ----------------------------------------------------------------------------
   הבדיקה שולפת את הפונקציות האמיתיות מתוך index.html (בלי להעתיק אותן),
   מריצה אותן בהקשר מדומה עם נתוני בדיקה, ומוודאת את ההתנהגות:
     • רף שיבוץ: סדר העדיפויות (רף הגן → ברירת מחדל לפי חינוך → קיבולת),
       ספירת המשובצות בפועל, וחסימת שיבוץ מעבר לרף.
     • שיבוץ אוטומטי: שיבוץ לגן הקרוב, שמירת אחיות יחד, כיבוד הרף,
       והתאמת חינוך.
     • הודעות: מיזוג שדות, נרמול מספרים לוואטסאפ/SMS.
     • איתור לעוזר החכם: גן ותלמידה לפי שם / ת"ז.
   אין כאן שום גישה לרשת — סימולציה טהורה ב-Node.
   הרצה:  node tests/assign-and-messages.test.cjs
   ============================================================================ */

const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const m=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let code=null,x,i=0;
while((x=m.exec(html))){ i++; if(i===2) code=x[1]; }
// חותכים את קטעי הפונקציות הדרושים בלבד ומריצים אותם בהקשר מדומה
function grab(name){
  const a=code.indexOf('\nfunction '+name+'(');
  if(a<0) throw new Error('not found: '+name);
  const e=code.indexOf('\n}', a);           // סוגר בעמודה 0 — כל ההצהרות ברמה העליונה
  if(e<0) throw new Error('no end: '+name);
  return code.slice(a+1, e+2);
}
const names=['capState','ganAssignCap','ganAssignCapSource','ganAssignedCount','ganAssignRoom',
  'canAssignStudent','assignGate','assignCapDefaults','eduLabel','ganById','ganName','studentsOfYear',
  'haversineKm','ganAges','ageFits','sibKey','addrKey','nameKey','autoAssignPlan','msgMerge','waNumber',
  'waHref','smsHref','isMobileNum','telHref','aiFindGan','aiFindStudent'];
let src=names.map(grab).join('\n');
const ctx={ console, DB:null, esc:s=>String(s??''), toast:()=>{}, activeEdu:null,
  eduScope:l=>l, save:()=>{}, canEditRec:()=>true };
vm.createContext(ctx);
vm.runInContext(src, ctx);

/* --- נתוני בדיקה --- */
const gans=[
  { id:'g1', ganName:'גן א', active:true, education:'רגיל', age:'4', capacity:'30', assignCap:'3',
    geo:{lat:31.93, lng:35.04} },
  { id:'g2', ganName:'גן ב', active:true, education:'רגיל', age:'4', capacity:'30', assignCap:'',
    geo:{lat:31.94, lng:35.06} },
  { id:'g3', ganName:'גן ג', active:true, education:'ח"מ', age:'4', assignCap:'2', geo:{lat:31.95, lng:35.08} }
];
const mk=(id,ln,lat,lng,gan,placed,edu)=>({ id, year:'תשפ"ז', firstName:'ילדה'+id, lastName:ln, age:'4',
  education:edu||'רגיל', ganId:gan||'', placed:placed!==false, finished:false, street:'רח '+ln, building:'1', city:'עיר',
  geo:{lat,lng}, createdAt:'2026-01-0'+id });
ctx.DB={ activeYear:'תשפ"ז', gans, students:[], settings:{ assignCaps:{ 'רגיל':'', 'ח"מ':'', useCapacity:false } }, staff:[], management:[] };

let fail=0; const ok=(c,msg)=>{ if(!c){ fail++; console.log('❌ '+msg); } else console.log('✅ '+msg); };

/* רף שיבוץ */
ok(ctx.ganAssignCap(gans[0])===3, 'רף של הגן גובר (3)');
ok(ctx.ganAssignCap(gans[1])===0, 'ללא רף וללא ברירת מחדל → ללא הגבלה');
ctx.DB.settings.assignCaps={ 'רגיל':'36', 'ח"מ':'12', useCapacity:false };
ok(ctx.ganAssignCap(gans[1])===36, 'ברירת מחדל לפי חינוך (36)');
ok(ctx.ganAssignCap(gans[2])===2, 'רף של הגן גובר על ברירת המחדל של ח"מ');
ctx.DB.settings.assignCaps={ useCapacity:true };
ok(ctx.ganAssignCap(gans[1])===30, 'נפילה לקיבולת כשמופעל');

/* ספירה וחסימה */
ctx.DB.settings.assignCaps={ 'רגיל':'', 'ח"מ':'', useCapacity:false };
ctx.DB.students=[ mk(1,'כהן',31.930,35.041,'g1'), mk(2,'לוי',31.931,35.042,'g1'),
                  mk(3,'פרץ',31.932,35.043,'g1'), mk(4,'דוד',31.933,35.044,'g1', false) ];
ok(ctx.ganAssignedCount('g1')===3, 'נספרות רק המשובצות סופית (3 מתוך 4)');
ok(ctx.ganAssignRoom(gans[0])===0, 'אין מקום פנוי כשהגיעו לרף');
const gate=ctx.canAssignStudent(gans[0], mk(9,'חדשה',31.93,35.04));
ok(gate.ok===false && /מלא/.test(gate.msg), 'שיבוץ נוסף נחסם עם הודעה');
ok(ctx.canAssignStudent(gans[0], ctx.DB.students[0]).ok===true, 'תלמידה שכבר משובצת שם אינה נחסמת מעצמה');

/* שיבוץ אוטומטי לפי קרבה */
ctx.DB.students=[
  mk(11,'קרובה-לא',31.9300,35.0400,''),   // ליד גן א
  mk(12,'קרובה-לב',31.9400,35.0600,''),   // ליד גן ב
  mk(13,'אחות',    31.9400,35.0601,''),   // ליד גן ב
];
ctx.DB.students[2].lastName='קרובה-לב'; ctx.DB.students[2].street='רח קרובה-לב'; // אותה משפחה+כתובת
ctx.DB.students[1].building='1'; ctx.DB.students[2].building='1';
let plan=ctx.autoAssignPlan(ctx.DB.students.slice(), gans.filter(g=>g.education==='רגיל'), { siblings:true, respectCap:true, matchAge:true });
ok(plan.plan.length===3, 'שלוש תלמידות שובצו');
const byId=Object.fromEntries(plan.plan.map(p=>[p.s.id,p.g.id]));
ok(byId[11]==='g1', 'התלמידה הקרובה לגן א שובצה לגן א');
ok(byId[12]==='g2' && byId[13]==='g2', 'האחיות שובצו יחד לגן הקרוב');

/* כיבוד רף בשיבוץ אוטומטי */
const tight=[Object.assign({},gans[0],{assignCap:'1'})];
plan=ctx.autoAssignPlan(ctx.DB.students.slice(), tight, { siblings:false, respectCap:true, matchAge:true });
ok(plan.plan.length===1 && plan.skipped.length===2, 'רף 1 → שובצה אחת, שתיים דולגו');
ok(/רף השיבוץ/.test(plan.skipped[0].why), 'הסיבה לדילוג מוסברת');

/* התאמת חינוך */
plan=ctx.autoAssignPlan([mk(20,'חמ',31.95,35.08,'', true,'ח"מ')], gans.filter(g=>g.education==='רגיל'), { matchAge:true });
ok(plan.plan.length===0 && plan.skipped.length===1, 'תלמידת ח"מ לא שובצה לגן רגיל');

/* מיזוג הודעות */
ok(ctx.msgMerge('שלום {{שם}}, גן {{גן}}', {'שם':'שרה','גן':'הדקל'})==='שלום שרה, גן הדקל', 'מיזוג שדות');
ok(ctx.msgMerge('שלום {{לא קיים}}!',{})==='שלום !', 'שדה לא מוגדר מנוקה');

/* טלפונים */
ok(ctx.waNumber('050-123-4567')==='972501234567', 'נרמול נייד לוואטסאפ');
ok(ctx.waNumber('+972501234567')==='972501234567', 'מספר בינלאומי נשמר');
ok(ctx.isMobileNum('0501234567')===true && ctx.isMobileNum('08-9765432')===false, 'זיהוי נייד מול קו נייח');
ok(ctx.smsHref('050-1234567','שלום').indexOf('sms:0501234567')===0, 'קישור SMS');

/* איתור לעוזר */
ok(ctx.aiFindGan('גן ב').id==='g2', 'איתור גן לפי שם');
ok(ctx.aiFindGan('ב').id==='g2', 'איתור גן לפי הכלה');
ctx.DB.students=[ mk(1,'כהן',31.93,35.04,'g1') ]; ctx.DB.students[0].firstName='שרה'; ctx.DB.students[0].tz='123456789';
ok(ctx.aiFindStudent({name:'כהן שרה'}).id===1, 'איתור תלמידה לפי שם מלא');
ok(ctx.aiFindStudent({tz:'123456789'}).id===1, 'איתור תלמידה לפי ת"ז');

console.log('============================================');
console.log(fail? ('תוצאה: '+fail+' נכשלו') : 'תוצאה: כל הבדיקות עברו ✅');
console.log('============================================');
process.exit(fail?1:0);
