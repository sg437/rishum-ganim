/* ============================================================================
   רשימת העירייה — עדכון לפי ת"ז: בדיקת דפדפן
   ----------------------------------------------------------------------------
     1. מיפוי עמודות — כותרת מוכרת מזוהה ומסומנת לבד, כותרת זרה נשארת כבויה.
     2. עמודה שלא סומנה אינה נקלטת, גם כשהכותרת שלה מוכרת.
     3. השלמת הפרטים החסרים בתיק (כולל שם משפחה) — ומה שקיים אינו נדרס.
     4. טלפון שכבר מופיע בשדה אחר של אותה ילדה לא נכתב שוב.
     5. ת"ז שאינה בתוכנה — נפתח לה תיק חדש, בלי שיבוץ לגן לפי הסמל.
     6. כיבוי "פתיחת תיק חדש" — הת"ז מדווחת ולא נפתח תיק.
     7. סוג החינוך של ההעלאה נקבע לתיקים החדשים.
     8. סיכום לפי סמל מוסד + רשימת מי שבסמל אחר בעירייה ואצלנו.
     8ב. מצב "השוואה בלבד" — סיכום הסמלים בלי לגעת בנתונים.
     8ג. הורדות: אצלנו+בעירייה · רק אצלנו · שיתוף.
     9. רשימת ת"ז נטו (בלי כותרות) ממשיכה לעבוד — סימון "קלוט" בלבד.
    10. אותו מקטע בדיוק עובד גם בעיצוב החדש (חלון "עדכון לפי מ.ז.").
    11. קובץ xlsx אמיתי נקרא כטבלה — ולא נשפך כג'יבריש לתיבה.
    12. ת"ז שאיבדה אפס מוביל באקסל עדיין מתאימה לתיק שבתוכנה.
    13. קובץ בינארי שאינו גיליון נעצר בהודעה, בלי לזהם את התיבה.
    14. קובץ xls ישן (BIFF8 אמיתי) נקרא כטבלה.
    15. מחרוזת שנחתכת בין רשומות CONTINUE נקראת שלמה.
    16. שתי עמודות דוא"ל בקובץ מתמזגות לשדה אחד — הראשון שאינו ריק.
    17. xls בפורמט BIFF5 (אקסל 95) — עברית בדף קוד 1255, בלי טבלת מחרוזות.
    18. זרם הגיליון מאותר לפי תוכן גם כששמו אינו "Workbook".
    19. קובץ OLE בלי גיליון — ההודעה מונה אילו זרמים כן נמצאו.
    20. קובץ אקסל מוצפן — מזוהה ככזה, ונפתח חלון הסבר במקום הודעת שגיאה.

   הרצה:  NODE_PATH=$(npm root -g) node tests/muni-vlookup.test.cjs
   ============================================================================ */

const fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('⏭️  דילוג: הבדיקה דורשת Playwright.'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const PORT = 8759;
const TMP  = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-muni-'));

function buildApp() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/, '');
  html = html.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-[a-z-]+\.js/g, '/__stub/fbstub.js');
  html = html.replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', '/__stub/noop.js');
  const expose = `
window.__set=(k,v)=>{ if(k==='active')active=v; else if(k==='eduPicked')eduPicked=v; else if(k==='activeEdu')activeEdu=v; else if(k==='currentUser')currentUser=v; else if(k==='db')db=v; };
Object.defineProperty(window,'DB',{get:()=>DB,set:v=>{DB=v},configurable:true});
Object.assign(window,{ route, navToTab, openBulkImport, closeModal, parseMuniInput, muniDetectColumns, phoneKey, tzKey, xlsxToRows, xlsToRows, biffToRows, biffStrReader, readFileSmart });
window.__ready=true;
`;
  const i = html.lastIndexOf('</script>');
  return html.slice(0, i) + expose + html.slice(i);
}
fs.writeFileSync(path.join(TMP, 'noop.js'), 'window.L={map(){return{setView(){return this},remove(){},on(){},off(){}}},tileLayer(){return{addTo(){}}},layerGroup(){return{addTo(){return this},clearLayers(){}}}};');
fs.writeFileSync(path.join(TMP, 'fbstub.js'), `
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
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
               '.js':'text/javascript; charset=utf-8', '.woff2':'font/woff2', '.png':'image/png' };
const server = require('http').createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let body, ext;
  if (url === '/app.html') { body = Buffer.from(buildApp()); ext = '.html'; }
  else {
    const f = url.startsWith('/__stub/') ? path.join(TMP, url.slice(8)) : path.join(ROOT, url.replace(/^\/+/, ''));
    ext = path.extname(f);
    try { body = fs.readFileSync(f); } catch (e) { res.writeHead(404); return res.end('nf'); }
  }
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(body);
});

/* שני גנים עם סמלי מוסד, וארבע תלמידות במצבי מילוי שונים:
   s1 — תיק כמעט ריק, בגן 111111
   s2 — כבר יש לה שם אם וטלפון בית; הטלפון הזה הוא הנייד של האב בקובץ
   s3 — בגן 222222 (בעירייה היא תופיע ב-111111 — אי-התאמת סמל)
   s4 — לא בקובץ כלל (נספרת רק בסיכום הסמלים) */
const SEED = `(() => {
  DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
  DB.gans=[
    {id:'g1',ganName:'גן הדקל',ganSymbol:'111111',internalSymbol:'A1',campus:'קמפוס מרכז',education:'רגיל',age:'4',active:true},
    {id:'g2',ganName:'גן הרימון',ganSymbol:'222222',internalSymbol:'A2',campus:'קמפוס מרכז',education:'רגיל',age:'4',active:true}];
  const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
    docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
    dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
    street:'', building:'', city:'', absorbedMunicipality:false }, o);
  DB.students=[
    mk({id:'s1',tz:'300000001',firstName:'רחל',lastName:'כהן',ganId:'g1'}),
    mk({id:'s2',tz:'300000002',firstName:'שרה',lastName:'לוי',ganId:'g1',motherName:'מרים קיימת',phone:'0522222222',absorbedMunicipality:true}),
    mk({id:'s3',tz:'300000003',firstName:'לאה',lastName:'',ganId:'g2'}),
    mk({id:'s4',tz:'300000004',firstName:'חנה',lastName:'דוד',ganId:'g1'}),
    mk({id:'s5',tz:'012345678',firstName:'מרים',lastName:'גולד',ganId:'g2'})];
  DB.staff=[]; DB.management=[]; DB.assignments={}; DB.tzGroups={}; DB.municipality={};
  DB.settings={ admins:['admin@test.org'] };
  __set('currentUser',{ email:'admin@test.org', uid:'u1' });
  __set('db', null); __set('eduPicked',true); __set('activeEdu',null);
  document.body.classList.remove('locked');
  return 'ok';
})()`;

/* קובץ העירייה כפי שהוא מגיע — עם עמודות שאינן מעניינות אותנו כלל
   ("מספר תיק", "סטטוס תשלום"), שאמורות להישאר לא מסומנות. */
const FILE = [
  'מספר תיק,מספר זהות,שם משפחה,שם פרטי,תאריך לידה,שם האם,שם האב,טלפון בית,נייד אב,נייד אם,דוא"ל,רחוב,מספר בניין,סמל מוסד,סטטוס תשלום',
  '9001,300000001,כהן,רחל,01/09/2021,ברכה,דוד,03-1111111,050-1111111,052-1111111,rachel@example.com,הרב קוק,12,111111,שולם',
  '9002,300000002,לוי,שרה,15/03/2021,מרים חדשה,אהרן,03-2222222,0522222222,053-2222222,sara@example.com,יפו,7,111111,שולם',
  '9003,300000003,פרץ,לאה,20/05/2021,אסתר,משה,03-3333333,050-3333333,052-3333333,leah@example.com,בן יהודה,3,111111,חוב',
  '9004,300000009,אדומי,מלכה,10/10/2021,פנינה,יצחק,03-9999999,050-9999999,052-9999999,malka@example.com,הנביאים,44,222222,שולם'
].join('\n');


/* קובץ xls אמיתי בפורמט BIFF8 (נוצר בכלי חיצוני, לא על ידי התוכנה), עם
   עברית, מחרוזות משותפות, מספרים ו-MULRK — הפורמט שהעירייה שולחת. */
const XLS_B64 = [
  '0M8R4KGxGuEAAAAAAAAAAAAAAAAAAAAAPgADAP7/CQAGAAAAAAAAAAAAAAABAAAACQAAAAAAAAAAEAAA/v///wAAAAD+////AAAA',
  'AAgAAAD/////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '//////////////////////////////////////////////////////////////////////////////////8JCBAAAAYFALsNzAcA',
  'AAAABgAAAOEAAgCwBMEAAgAAAOIAAABcAHAATm9uZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg',
  'ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEIAAgCwBGEBAgAA',
  'AD0BAgABAJwAAgAOABkAAgAAABIAAgAAAGMAAgAAABMAAgAAAK8BAgAAALwBAgAAAEAAAgAAAI0AAgAAAD0AEgDgAVoAzz9OKjgA',
  'AAAAAAEAWAIiAAIAAAAOAAIAAQC3AQIAAADaAAIAAAAxABUAyAAAAP9/kAEAAAAAAQAFAEFyaWFsMQAVAMgAAAD/f5ABAAAAAAEA',
  'BQBBcmlhbDEAFQDIAAAA/3+QAQAAAAABAAUAQXJpYWwxABUAyAAAAP9/kAEAAAAAAQAFAEFyaWFsMQAVAMgAAAD/f5ABAAAAAAEA',
  'BQBBcmlhbDEAFQDIAAAA/3+QAQAAAAABAAUAQXJpYWwxABUAyAAAAP9/kAEAAAAAAQAFAEFyaWFsHgQMAKQABwAAR2VuZXJhbOAA',
  'FAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAG',
  'AKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA',
  '9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8g',
  'AAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0',
  'AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAA',
  'AAAAAADAIOAAFAAGAKQAAQAgAAD4AAAAAAAAAADAIOAAFAAHAKQAAQAgAAD4AAAAAAAAAADAIJMCBAAAgAD/YAECAAEAhQAiAAMF',
  'AAAAAA0B6AXpBdkF3gXqBSAA1AXiBdkF6AXZBdkF1AX8AEoBFwAAABcAAAAIAAHeBeEF5AXoBSAA6gXZBecFCQAB3gXhBeQF6AUg',
  'ANYF1AXVBeoFCAAB6QXdBSAA3gXpBeQF1wXUBQcAAekF3QUgAOQF6AXYBdkFCgAB6gXQBegF2QXaBSAA3AXZBdMF1AUGAAHpBd0F',
  'IADUBdAF3QUHAAHgBdkF2QXTBSAA0AXdBQgAAeEF3gXcBSAA3gXVBeEF0wUDAAHbBdQF3wUDAAHoBdcF3AUKAAAwMS8wOS8yMDIx',
  'BAAB0QXoBdsF1AULAAAwNTItMTExMTExMQQAAdIF1QXcBdMFBAAB3gXoBdkF3QUKAAAxNS8wMy8yMDIxBAAB1gXUBdEF1AULAAAw',
  'NTQtNTU1NTU1NQMAAeQF6AXlBQMAAdwF0AXUBQoAADIwLzA1LzIwMjEEAAHQBeEF6gXoBQsAADA1Mi0zMzMzMzMzCgAAAAkIEAAA',
  'BhAAuw3MBwAAAAAGAAAADQACAAEADAACAGQADwACAAEAEQACAAAAEAAIAPyp8dJNYlA/XwACAAAAgAAIAAAAAAABAAAAJQIEAAAA',
  '/wCBAAIAAQwAAg4AAAAAAAQAAAAAAAgAAAAqAAIAAAArAAIAAACCAAIAAQAbAAIAAAAaAAIAAAAUAAUAAgAAJlAVAAUAAgAAJkaD',
  'AAIAAQCEAAIAAAAmAAgAMzMzMzMz0z8nAAgAMzMzMzMz0z8oAAgAhetRuB6F4z8pAAgArkfhehSu1z+hACIACQBkAAEAAQABAIMA',
  'LAEsAZqZmZmZmbk/mpmZmZmZuT8BABIAAgAAAN0AAgAAABkAAgAAAGMAAgAAABMAAgAAAAgCEAAAAAAACAD/AAAAAAAAAQ8A/QAK',
  'AAAAAAARAAAAAAD9AAoAAAABABEAAQAAAP0ACgAAAAIAEQACAAAA/QAKAAAAAwARAAMAAAD9AAoAAAAEABEABAAAAP0ACgAAAAUA',
  'EQAFAAAA/QAKAAAABgARAAYAAAD9AAoAAAAHABEABwAAAAgCEAABAAAACAD/AAAAAAAAAQ8AvQASAAEAAAARAKaMAAARAAaMhkcB',
  'AP0ACgABAAIAEQAIAAAA/QAKAAEAAwARAAkAAAD9AAoAAQAEABEACgAAAP0ACgABAAUAEQALAAAA/QAKAAEABgARAAwAAAB+AgoA',
  'AQAHABEAHsgGAAgCEAACAAAACAD/AAAAAAAAAQ8AvQASAAIAAAARAKqMAAARADqF8QIBAP0ACgACAAIAEQANAAAA/QAKAAIAAwAR',
  'AA4AAAD9AAoAAgAEABEADwAAAP0ACgACAAUAEQAQAAAA/QAKAAIABgARABEAAAB+AgoAAgAHABEAOpANAAgCEAADAAAACAD/AAAA',
  'AAAAAQ8AvQASAAMAAAARAK6MAAARAA6MhkcBAP0ACgADAAIAEQASAAAA/QAKAAMAAwARABMAAAD9AAoAAwAEABEAFAAAAP0ACgAD',
  'AAUAEQAVAAAA/QAKAAMABgARABYAAAB+AgoAAwAHABEAHsgGAD4CEgC2AgAAAABAAAAAAAAAAAAAAAAKAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAP7////9/////v//////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '//////////////////////////9SAG8AbwB0ACAARQBuAHQAcgB5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAFgAFAf//////////AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP7///8AAAAAAAAAAFcA',
  'bwByAGsAYgBvAG8AawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAIB////////////',
  '////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH///////////////8AAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAD+////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAf///////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP7///8A',
  'AAAAAAAAAA==',
].join('');


/* מיכל OLE שנבנה מחוץ לתוכנה, ובו זרם BIFF5 ששמו "Gilayon" ולא
   "Workbook" — כדי לוודא שהגיליון מאותר לפי תוכן ולא לפי שם. */
const NAMED_XLS_B64 = [
  '0M8R4KGxGuEAAAAAAAAAAAAAAAAAAAAAAAA+AP7/CQAGAAAAAAAAAAAAAAABAAAACQAAAAAAAAAAEAAA/v///wAAAAD+////AAAA',
  'AAAAAAD/////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '///////////////////////////////////////////////////////////////////////////////////9////AgAAAAMAAAAE',
  'AAAABQAAAAYAAAAHAAAACAAAAP7////+////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '////////////////////////////////////////////////////////////////////////////////////////////////////',
  '/////////////////////////////////////////////////////////////////wkICAAABQUAAAAAAEIAAgDnBIUAFAAuAAAA',
  'AAAN+Pnp7vog5PLp+Onp5AoAAAAJCAgAAAUQAAAAAAAEAhAAAAAAAAAACAD57SDu+fTn5AQCCwABAAAAAAADAOvk734CCgABAAEA',
  'AAAGjIZHCgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAABSAG8AbwB0ACAARQBuAHQAcgB5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAFgAFAf///////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP7///8AAAAAAAAAAEcA',
  'aQBsAGEAeQBvAG4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAIB////////////',
  '////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAA==',
].join('');

let fail = 0;
const ok  = m => console.log('  ✅ ' + m);
const bad = (m, d) => { fail++; console.log('  ❌ ' + m); (d||[]).forEach(x => console.log('       ' + x)); };
const stu = (p, tz) => p.evaluate(t => { const s = DB.students.find(x => x.tz === t); return s ? JSON.parse(JSON.stringify(s)) : null; }, tz);

/* מילוי התיבה והרצת המיפוי מחדש */
async function load(p, text) {
  await p.evaluate(t => { const ta = document.querySelector('#muni-text'); ta.value = t; }, text);
  await p.evaluate(() => document.querySelector('#muni-detect').click());
  await p.waitForTimeout(200);
}
const mapRows = p => p.evaluate(() => [...document.querySelectorAll('#muni-map tbody tr')].map(tr => ({
  header: tr.children[1].textContent.trim(),
  on:     tr.querySelector('.muni-col-on').checked,
  field:  tr.querySelector('.muni-col-field').value })));
const stats = p => p.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#muni-result .stat')].map(c =>
    [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));
const run = async p => { await p.evaluate(() => document.querySelector('#muni-run').click()); await p.waitForTimeout(400); };

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:' + PORT + '/app.html', { waitUntil: 'load' });
  await p.waitForTimeout(1100);
  await p.evaluate(SEED);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(400);

  console.log('\n1. מיפוי עמודות');
  await load(p, FILE);
  const cols = await mapRows(p);
  cols.length === 15 ? ok('15 עמודות בטבלת המיפוי') : bad('מספר העמודות שגוי: ' + cols.length);
  const byHead = Object.fromEntries(cols.map(c => [c.header, c]));
  (byHead['מספר זהות'] && byHead['מספר זהות'].field === 'tz' && byHead['מספר זהות'].on)
    ? ok('"מספר זהות" זוהה ומסומן') : bad('עמודת הת"ז לא זוהתה', [JSON.stringify(byHead['מספר זהות'])]);
  (byHead['נייד אב'].field === 'dadMobile' && byHead['נייד אם'].field === 'momMobile')
    ? ok('נייד אב / נייד אם הופרדו נכון') : bad('הפרדת הניידים נכשלה');
  const opts = await p.evaluate(() => [...document.querySelector('#muni-map .muni-col-field').options].map(o => o.textContent.trim()));
  (opts.indexOf('שם משפחה') > opts.indexOf('שם האב') && opts.indexOf('שם האב') > opts.indexOf('שם האם'))
    ? ok('"שם משפחה" יושב אחרי שמות ההורים') : bad('סדר השדות שגוי', [JSON.stringify(opts)]);
  (!byHead['מספר תיק'].on && byHead['מספר תיק'].field === ''
   && !byHead['סטטוס תשלום'].on && byHead['סטטוס תשלום'].field === '')
    ? ok('עמודות זרות נשארו כבויות') : bad('עמודה זרה סומנה בטעות');

  console.log('\n2. עמודה שלא סומנה אינה נקלטת');
  /* מכבים את "דוא"ל" ידנית — היא מוכרת, אבל המשתמש לא רוצה אותה */
  await p.evaluate(() => {
    const tr = [...document.querySelectorAll('#muni-map tbody tr')].find(x => x.children[1].textContent.trim() === 'דוא"ל');
    tr.querySelector('.muni-col-on').checked = false;
  });
  await run(p);
  const s1 = await stu(p, '300000001');
  s1.email === '' ? ok('דוא"ל לא נקלט — העמודה לא סומנה') : bad('הדוא"ל נקלט למרות שלא סומן: ' + s1.email);

  console.log('\n3. השלמת פרטים חסרים');
  (s1.dob === '2021-09-01' && s1.motherName === 'ברכה' && s1.fatherName === 'דוד'
   && s1.street === 'הרב קוק' && s1.building === '12')
    ? ok('תאריך לידה · שם אם · שם אב · רחוב · בניין הושלמו')
    : bad('ההשלמה חלקית', [JSON.stringify({dob:s1.dob,mom:s1.motherName,dad:s1.fatherName,st:s1.street,bl:s1.building})]);
  (s1.phone === '03-1111111' && s1.dadMobile === '050-1111111' && s1.momMobile === '052-1111111')
    ? ok('שלושת הטלפונים נכנסו לשדות הנכונים')
    : bad('הטלפונים שגויים', [JSON.stringify({p:s1.phone,d:s1.dadMobile,m:s1.momMobile})]);
  s1.absorbedMunicipality ? ok('סומנה קלוט בעירייה') : bad('לא סומנה קלוט');

  const s3 = await stu(p, '300000003');
  s3.lastName === 'פרץ' ? ok('שם משפחה חסר הושלם מהרשימה') : bad('שם המשפחה לא הושלם: ' + s3.lastName);
  const s1keep = await stu(p, '300000001');
  s1keep.lastName === 'כהן' ? ok('שם משפחה קיים נשאר כשהיה') : bad('שם המשפחה נדרס: ' + s1keep.lastName);

  const s2 = await stu(p, '300000002');
  (s2.motherName === 'מרים קיימת' && s2.phone === '0522222222')
    ? ok('ערכים קיימים בתוכנה לא נדרסו')
    : bad('ערך קיים נדרס', [JSON.stringify({mom:s2.motherName,phone:s2.phone})]);

  console.log('\n4. טלפון שכבר מופיע בשדה אחר');
  /* בקובץ 0522222222 הוא נייד האב; אצלנו הוא כבר יושב בטלפון הבית */
  s2.dadMobile === '' ? ok('נייד האב לא נכתב — המספר כבר קיים בטלפון הבית')
                      : bad('המספר נכתב פעמיים: ' + s2.dadMobile);
  s2.momMobile === '053-2222222' ? ok('נייד האם — מספר חדש — כן נכתב') : bad('נייד האם לא נכתב: ' + s2.momMobile);
  const st1 = await stats(p);
  st1['טלפונים שדולגו (כבר קיימים)'] === 1 ? ok('הסיכום מדווח על טלפון אחד שדולג')
                                            : bad('מונה הדילוג שגוי: ' + st1['טלפונים שדולגו (כבר קיימים)']);

  console.log('\n5. ת"ז חדשה — נפתח תיק ומדווחת בנפרד');
  st1['תיקים חדשים שנפתחו'] === 1 ? ok('נפתח תיק חדש אחד') : bad('מונה התיקים החדשים שגוי: ' + st1['תיקים חדשים שנפתחו']);
  st1['תיקים שעודכנו בהם פרטים'] === 3 ? ok('3 תיקים קיימים עודכנו') : bad('מונה העדכון שגוי: ' + st1['תיקים שעודכנו בהם פרטים']);
  const s9 = await stu(p, '300000009');
  (s9 && s9.firstName === 'מלכה' && s9.lastName === 'אדומי' && s9.dob === '2021-10-10'
   && s9.absorbedMunicipality && s9.registeredByUs === false)
    ? ok('התיק החדש נפתח עם הפרטים מהקובץ') : bad('התיק החדש חסר', [JSON.stringify(s9)]);
  const newList = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-new'); if (!b) return null;
    const tbl = b.parentElement.querySelector('tbody');
    return [...tbl.querySelectorAll('tr')].map(tr => tr.children[1].textContent.trim()); });
  (newList && newList.length === 1 && newList[0] === '300000009')
    ? ok('הרשימה הנפרדת של החדשות מוצגת') : bad('רשימת החדשות שגויה', [JSON.stringify(newList)]);
  s9.ganId === '' ? ok('התיק החדש לא שובץ לגן — הסמל אינו משבץ') : bad('שובץ בטעות לגן ' + s9.ganId);
  const noAssignBox = await p.evaluate(() => !!document.querySelector('#muni-assign'));
  !noAssignBox ? ok('אין בכלל אפשרות לשבץ לפי סמל מהעירייה') : bad('נשארה אפשרות שיבוץ לפי סמל');

  console.log('\n6. כיבוי "פתיחת תיק חדש"');
  await p.evaluate(() => { DB.students = DB.students.filter(s => s.tz !== '300000009'); });
  await p.evaluate(() => { document.querySelector('#muni-create').checked = false; });
  await run(p);
  const gone = await stu(p, '300000009');
  !gone ? ok('לא נפתח תיק כשהסימון כבוי') : bad('נפתח תיק למרות שהסימון כבוי');
  const nfShown = await p.evaluate(() => !!document.querySelector('#muni-dl-nf'));
  nfShown ? ok('הת"ז שלא נמצאה מדווחת עם כפתור הורדה') : bad('הדיווח על הלא-נמצאות חסר');

  console.log('\n7. סוג החינוך של ההעלאה');
  await p.evaluate(() => { document.querySelector('#muni-create').checked = true;
    document.querySelector('#muni-edu').value = 'ח"מ'; });
  await run(p);
  const s9b = await stu(p, '300000009');
  s9b && s9b.education === 'ח"מ' ? ok('התיק החדש נפתח בחינוך מיוחד, לפי הבורר')
                                 : bad('סוג החינוך שגוי: ' + (s9b && s9b.education));

  console.log('\n8. סיכום לפי סמל מוסד');
  const sym = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-sym'); if (!b) return null;
    return [...b.parentElement.querySelectorAll('tbody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim())); });
  const row111 = sym && sym.find(r => r[0] === '111111');
  const row222 = sym && sym.find(r => r[0] === '222222');
  (row111 && row111[1] === 'גן הדקל' && row111[2] === '3' && row111[3] === '3')
    ? ok('סמל 111111: 3 בתוכנה · 3 בעירייה') : bad('שורת 111111 שגויה', [JSON.stringify(row111)]);
  /* בתוכנה: לאה ומרים, שתיהן בגן הרימון. בעירייה: מלכה בלבד. */
  (row222 && row222[2] === '2' && row222[3] === '1' && row222[4] === '+1')
    ? ok('סמל 222222: 2 בתוכנה · 1 בעירייה · הפרש +1') : bad('שורת 222222 שגויה', [JSON.stringify(row222)]);
  const diff = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-diff'); if (!b) return null;
    return [...b.closest('div[style]').parentElement.querySelectorAll('tbody tr')].map(tr =>
      [...tr.children].map(td => td.textContent.trim())); });
  (diff && diff.length === 1 && diff[0][1] === '300000003' && diff[0][2] === '222222' && diff[0][4] === '111111')
    ? ok('לאה פרץ: אצלנו 222222, בעירייה 111111') : bad('רשימת ההפרשים שגויה', [JSON.stringify(diff)]);
  const dlBtns = await p.evaluate(() => ['muni-dl-diff','muni-dl-diff-ours','muni-share-diff','muni-dl-sym','muni-share-sym']
    .filter(id => !!document.querySelector('#' + id)));
  dlBtns.length === 5 ? ok('הורדה מלאה · הורדה "רק אצלנו" · שיתוף — לשתי הטבלאות')
                      : bad('חסרים כפתורי הורדה/שיתוף', [JSON.stringify(dlBtns)]);

  console.log('\n8ב. מצב "השוואה בלבד"');
  const snap = () => p.evaluate(() => JSON.stringify(DB.students.map(s =>
    [s.tz, s.ganId, s.motherName, s.phone, s.absorbedMunicipality]).sort()));
  const beforeCmp = await snap();
  await p.evaluate(() => { const m = document.querySelector('#muni-mode'); m.value = 'compare'; m.dispatchEvent(new Event('change')); });
  const hidden = await p.evaluate(() => ({
    edu: document.querySelector('#muni-edu-wrap').style.display,
    create: document.querySelector('#muni-create-wrap').style.display,
    btn: document.querySelector('#muni-run').textContent.trim() }));
  (hidden.edu === 'none' && hidden.create === 'none' && /סיכום לפי סמל/.test(hidden.btn))
    ? ok('בהשוואה: בורר החינוך ופתיחת התיקים יורדים, והכפתור משתנה')
    : bad('הפקדים לא הוסתרו', [JSON.stringify(hidden)]);
  /* קובץ ובו ת"ז + סמל בלבד — בדיוק מה שנדרש להשוואה */
  await load(p, ['מספר זהות,סמל מוסד', '300000001,111111', '300000003,111111', '300000004,222222'].join('\n'));
  await run(p);
  const afterCmp = await snap();
  afterCmp === beforeCmp ? ok('שום דבר בתוכנה לא השתנה') : bad('ההשוואה שינתה נתונים');
  const cmpSym = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-sym'); if (!b) return null;
    return [...b.parentElement.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())); });
  const c111 = cmpSym && cmpSym.find(r => r[0] === '111111');
  (c111 && c111[1] === 'גן הדקל' && c111[2] === '3' && c111[3] === '2')
    ? ok('סמל 111111: 3 בתוכנה · 2 בעירייה') : bad('סיכום ההשוואה שגוי', [JSON.stringify(cmpSym)]);
  const cmpDiff = await p.evaluate(() => {
    const b = document.querySelector('#muni-dl-diff'); if (!b) return null;
    return [...b.closest('div[style]').parentElement.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())); });
  /* לאה: אצלנו 222222, בעירייה 111111 · חנה: אצלנו 111111, בעירייה 222222 */
  (cmpDiff && cmpDiff.length === 2)
    ? ok('שתי אי-התאמות סמל אותרו') : bad('רשימת ההפרשים בהשוואה שגויה', [JSON.stringify(cmpDiff)]);
  await p.evaluate(() => { const m = document.querySelector('#muni-mode'); m.value = 'update'; m.dispatchEvent(new Event('change')); });

  console.log('\n9. רשימת ת"ז נטו — בלי כותרות');
  await load(p, '300000001\n300000003');
  await run(p);
  const st2 = await stats(p);
  (st2['ברשימת העירייה'] === 2 && st2['תיקים שעודכנו בהם פרטים'] === 0)
    ? ok('רשימה נטו מסמנת בלי להשלים פרטים') : bad('רשימה נטו נכשלה', [JSON.stringify(st2)]);

  console.log('\n10. אותו מקטע בעיצוב החדש');
  const p2 = await ctx.newPage();
  const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
  await p2.goto('http://127.0.0.1:' + PORT + '/app.html?ui=new', { waitUntil: 'load' });
  await p2.waitForTimeout(1200);
  await p2.evaluate(SEED);
  await p2.evaluate(() => navToTab('students'));
  await p2.waitForTimeout(500);
  await p2.evaluate(() => openBulkImport());
  await p2.waitForTimeout(400);
  const inLab = await p2.evaluate(() => !!document.querySelector('#modal #muni-map') && !!document.querySelector('#modal #muni-run'));
  inLab ? ok('המקטע יושב בחלון "עדכון לפי מ.ז." של העיצוב החדש') : bad('המקטע לא נמצא בעיצוב החדש');
  if (inLab) {
    await p2.evaluate(t => { document.querySelector('#modal #muni-text').value = t; }, FILE);
    await p2.evaluate(() => document.querySelector('#modal #muni-detect').click());
    await p2.waitForTimeout(200);
    await p2.evaluate(() => document.querySelector('#modal #muni-run').click());
    await p2.waitForTimeout(400);
    const labS1 = await stu(p2, '300000001');
    (labS1.motherName === 'ברכה' && labS1.email === 'rachel@example.com')
      ? ok('ההשלמה עובדת גם בעיצוב החדש') : bad('ההשלמה נכשלה בעיצוב החדש', [JSON.stringify(labS1)]);
  }
  errs2.length ? bad('שגיאות בעמוד העיצוב החדש', errs2) : ok('אין שגיאות JavaScript בעיצוב החדש');

  console.log('\n11. קובץ xlsx אמיתי');
  /* בונים xlsx מינימלי בזיכרון (ZIP + XML) ומזינים אותו ל-readFileSmart
     כמו שהדפדפן מזין קובץ שנבחר. הת"ז של מרים נשמרת כמספר — ולכן היא
     מגיעה בלי האפס המוביל, בדיוק כמו באקסל אמיתי. */
  const XROWS = [
    ['מספר תיק','מספר זהות','שם משפחה','שם פרטי','שם האם','נייד אם','סמל מוסד'],
    ['9001','300000001','כהן','רחל','ברכה','052-1111111','111111'],
    ['9005','12345678','גולד','מרים','זהבה','054-5555555','222222'],
  ];
  await p.evaluate(() => { DB.students.forEach(s => { s.motherName=''; s.momMobile=''; s.absorbedMunicipality=false; }); });
  const xlsxText = await p.evaluate(async rows => {
    /* --- בניית xlsx: ZIP בלי דחיסה (method 0), עם CRC32 אמיתי --- */
    const enc = new TextEncoder();
    const tbl = (() => { const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = tbl[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const col = i => { let s = '', n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };
    const strings = []; const sidx = new Map();
    const sheetRows = rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
      const ref = col(ci) + (ri + 1);
      if (/^\d+$/.test(v)) return '<c r="' + ref + '"><v>' + v + '</v></c>';   // מספר — כך אקסל מאבד אפס מוביל
      if (!sidx.has(v)) { sidx.set(v, strings.length); strings.push(v); }
      return '<c r="' + ref + '" t="s"><v>' + sidx.get(v) + '</v></c>';
    }).join('') + '</row>').join('');
    const files = {
      '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
      'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="רשימת העירייה" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/sharedStrings.xml': '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + strings.length + '" uniqueCount="' + strings.length + '">' + strings.map(t => '<si><t>' + esc(t) + '</t></si>').join('') + '</sst>',
      'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + sheetRows + '</sheetData></worksheet>',
    };
    const locals = [], central = []; let off = 0;
    for (const name of Object.keys(files)) {
      const nb = enc.encode(name), db = enc.encode(files[name]), crc = crc32(db);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, db.length, true); lh.setUint32(22, db.length, true);
      lh.setUint16(26, nb.length, true);
      locals.push(new Uint8Array(lh.buffer), nb, db);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(6, 20, true); ch.setUint16(10, 0, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, db.length, true); ch.setUint32(24, db.length, true);
      ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + db.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true);
    eo.setUint16(8, Object.keys(files).length, true); eo.setUint16(10, Object.keys(files).length, true);
    eo.setUint32(12, cdSize, true); eo.setUint32(16, off, true);
    const blob = new Blob([...locals, ...central, new Uint8Array(eo.buffer)]);
    const file = new File([blob], 'muni.xlsx');
    return await new Promise(res => readFileSmart(file, txt => res(txt)));
  }, XROWS);
  /\uFFFD|PK/.test(xlsxText.slice(0, 40))
    ? bad('ה-xlsx עדיין נקרא כטקסט', [JSON.stringify(xlsxText.slice(0, 60))])
    : ok('ה-xlsx נקרא כטבלה, לא כג׳יבריש');
  xlsxText.split(/\r?\n/)[0] === 'מספר תיק,מספר זהות,שם משפחה,שם פרטי,שם האם,נייד אם,סמל מוסד'
    ? ok('שורת הכותרות נקראה מהגיליון') : bad('הכותרות שגויות', [xlsxText.split(/\r?\n/)[0]]);

  await load(p, xlsxText);
  const xcols = await mapRows(p);
  (xcols.length === 7 && xcols.filter(c => c.on).length === 6 && !xcols[0].on)
    ? ok('6 מתוך 7 עמודות זוהו; "מספר תיק" נשאר כבוי') : bad('המיפוי מה-xlsx שגוי', [JSON.stringify(xcols)]);
  await run(p);

  console.log('\n12. ת"ז שאיבדה אפס מוביל');
  const s5 = await stu(p, '012345678');
  (s5 && s5.motherName === 'זהבה' && s5.momMobile === '054-5555555' && s5.absorbedMunicipality)
    ? ok('"12345678" שבקובץ התאים ל-"012345678" שבתוכנה') : bad('ההתאמה לפי אפס מוביל נכשלה', [JSON.stringify(s5)]);
  const xst = await stats(p);
  xst['תיקים חדשים שנפתחו'] === 0 ? ok('לא נפתח תיק כפול למרים') : bad('נפתח תיק כפול', [JSON.stringify(xst)]);

  console.log('\n13. קובץ בינארי שאינו גיליון');
  const beforeTxt = await p.evaluate(() => document.querySelector('#muni-text').value);
  const kept = await p.evaluate(async () => {
    const f = new File([new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 1, 2, 3])], 'old.xls');
    let called = false;
    readFileSmart(f, () => { called = true; document.querySelector('#muni-text').value = 'זוהם'; });
    await new Promise(r => setTimeout(r, 300));
    return { called, text: document.querySelector('#muni-text').value };
  });
  (!kept.called && kept.text === beforeTxt)
    ? ok('קובץ פגום נעצר בהודעה, והתיבה לא זוהמה') : bad('הקובץ הבינארי נכנס לתיבה', [JSON.stringify(kept.called)]);

  console.log('\n14. קובץ xls ישן (BIFF8)');
  const xlsRes = await p.evaluate(async b64 => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const file = new File([u8], 'muni.xls');
    const text = await new Promise(res => { readFileSmart(file, t => res(t)); setTimeout(() => res(null), 3000); });
    const grid = xlsToRows(u8.buffer.slice(0));
    return { text, sheet: grid.sheetName, rows: grid.rows };
  }, XLS_B64);
  xlsRes.text ? ok('ה-xls נקרא ולא נחסם') : bad('ה-xls לא נקרא כלל');
  xlsRes.sheet === 'רשימת העירייה' ? ok('שם הגיליון בעברית נקרא נכון') : bad('שם הגיליון שגוי: ' + xlsRes.sheet);
  JSON.stringify(xlsRes.rows[0]) === JSON.stringify(['מספר תיק','מספר זהות','שם משפחה','שם פרטי','תאריך לידה','שם האם','נייד אם','סמל מוסד'])
    ? ok('שורת הכותרות נקראה מהגיליון') : bad('הכותרות שגויות', [JSON.stringify(xlsRes.rows[0])]);
  JSON.stringify(xlsRes.rows[1]) === JSON.stringify(['9001','300000001','כהן','רחל','01/09/2021','ברכה','052-1111111','111111'])
    ? ok('שורת נתונים מלאה — מחרוזות ומספרים') : bad('שורת הנתונים שגויה', [JSON.stringify(xlsRes.rows[1])]);
  (xlsRes.text || '').split(/\r?\n/).length === 4 ? ok('הומר ל-CSV בן 4 שורות') : bad('ההמרה ל-CSV שגויה');

  /* אותו קובץ, דרך המסך — כולל ת"ז שאיבדה אפס מוביל (12345678) */
  await p.evaluate(() => { DB.students.forEach(s => { s.motherName=''; s.momMobile=''; }); });
  await load(p, xlsRes.text);
  await run(p);
  const s5x = await stu(p, '012345678');
  (s5x && s5x.motherName === 'זהבה') ? ok('העדכון מהקובץ הישן הגיע לתיק') : bad('העדכון מה-xls לא נכנס', [JSON.stringify(s5x)]);

  console.log('\n15. מחרוזת חצויה בין רשומות CONTINUE');
  /* SST גדול נחתך לרשומות, ומחרוזת אחת נמשכת מעבר לגבול — ושם גם צורת
     הקידוד יכולה להשתנות. זו נקודת השבירה הקלאסית בקריאת xls. */
  const split = await p.evaluate(() => {
    const wide = s => { const a = []; for (const ch of s) a.push(ch.charCodeAt(0) & 0xFF, ch.charCodeAt(0) >> 8); return a; };
    const nar  = s => [...s].map(c => c.charCodeAt(0));
    /* א. עברית שנחתכת באמצע — שני החלקים בקידוד שני בייטים */
    const heb = biffStrReader([
      new Uint8Array([12, 0, 0x01, ...wide('שלוםעולם')]),   // cch=12, נגמר הבלוק אחרי 8 תווים
      new Uint8Array([0x01, ...wide('המשך')])               // grbit חדש, עדיין שני בייטים
    ]).str();
    /* ב. שינוי קידוד באמצע: הראש עברי (שני בייטים), הזנב לטיני (בייט אחד) */
    const mixed = biffStrReader([
      new Uint8Array([7, 0, 0x01, ...wide('שלום')]),
      new Uint8Array([0x00, ...nar('abc')])
    ]).str();
    return { heb, mixed };
  });
  split.heb === 'שלוםעולםהמשך'
    ? ok('מחרוזת עברית חצויה חוברה שלמה') : bad('חיבור ה-CONTINUE שגוי', [JSON.stringify(split.heb)]);
  split.mixed === 'שלוםabc'
    ? ok('שינוי קידוד באמצע המחרוזת טופל נכון') : bad('שינוי הקידוד שגוי', [JSON.stringify(split.mixed)]);

  console.log('\n16. שתי עמודות דוא"ל מתמזגות');
  /* כמו בקובץ העירייה: שתי עמודות דוא"ל. אצל רחל השנייה מלאה והראשונה
     ריקה; אצל לאה שתיהן מלאות — ואז גוברת הראשונה. */
  await p.evaluate(() => { DB.students.forEach(s => { s.email = ''; }); });
  const TWO_MAILS = [
    'מספר זהות,דוא"ל,מייל',
    '300000001,,rachel@example.com',
    '300000003,first@example.com,second@example.com',
  ].join('\n');
  await load(p, TWO_MAILS);
  const mailCols = await mapRows(p);
  (mailCols.length === 3 && mailCols[1].field === 'email' && mailCols[1].on
                         && mailCols[2].field === 'email' && mailCols[2].on)
    ? ok('שתי העמודות זוהו כדוא"ל ושתיהן מסומנות') : bad('הזיהוי הכפול נכשל', [JSON.stringify(mailCols)]);
  const mergeNote = await p.evaluate(() => (document.querySelector('#muni-merge-note') || {}).textContent || '');
  /2 עמודות מתמזגות/.test(mergeNote) ? ok('המסך מודיע שהעמודות מתמזגות') : bad('אין חיווי מיזוג', [mergeNote]);
  await run(p);
  const m1 = await stu(p, '300000001'), m3 = await stu(p, '300000003');
  m1.email === 'rachel@example.com' ? ok('עמודה ריקה דולגה — נלקח הערך מהשנייה')
                                    : bad('המיזוג לא לקח את הערך הקיים: ' + m1.email);
  m3.email === 'first@example.com' ? ok('כששתיהן מלאות — גוברת הראשונה')
                                   : bad('סדר העדיפות שגוי: ' + m3.email);

  console.log('\n17. xls בפורמט BIFF5 (אקסל 95)');
  /* מערכות ותיקות מייצאות עדיין BIFF5: אין בו טבלת מחרוזות, המחרוזות הן
     בייטים בדף קוד 1255, ורשומת שם הגיליון בנויה אחרת מ-BIFF8. קוראים
     אותו כ-BIFF8 — וחורגים מגבולות הנתונים. כאן נבנה זרם רשומות BIFF5
     ביד ונקרא, בלי לבנות מיכל OLE שלם. */
  const b5 = await p.evaluate(() => {
    const HEB = 'אבגדהוזחטיךכלםמןנסעףפץצקרשת';   // ברצף מ-0xE0 בדף קוד 1255
    const cp = s => [...s].map(c => { const i = HEB.indexOf(c); return i >= 0 ? 0xE0 + i : c.charCodeAt(0); });
    const parts = [];
    const R = (t, d) => parts.push(t & 0xFF, t >> 8, d.length & 0xFF, d.length >> 8, ...d);
    const u16 = v => [v & 0xFF, (v >> 8) & 0xFF];
    const u32 = v => [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF];
    R(0x0809, [...u16(0x0500), ...u16(5), ...u16(0), ...u16(0)]);      // BOF, גרסה 0x0500
    R(0x0042, u16(1255));                                              // CODEPAGE
    const nm = cp('רשימת העירייה'), at = parts.length;
    R(0x0085, [...u32(0), ...u16(0), nm.length, ...nm]);               // BOUNDSHEET
    R(0x000A, []);
    const start = parts.length;
    for (let k = 0; k < 4; k++) parts[at + 4 + k] = u32(start)[k];
    R(0x0809, [...u16(0x0500), ...u16(0x0010), ...u16(0), ...u16(0)]);
    const a = cp('שם משפחה'); R(0x0204, [...u16(0), ...u16(0), ...u16(0), ...u16(a.length), ...a]);
    const b = cp('כהן');      R(0x0204, [...u16(1), ...u16(0), ...u16(0), ...u16(b.length), ...b]);
    R(0x027E, [...u16(1), ...u16(1), ...u16(0), ...u32(((300000001 << 2) | 2) >>> 0)]);
    R(0x000A, []);
    const r = biffToRows(new Uint8Array(parts));
    return { biff: r.biff, sheet: r.sheetName, rows: r.rows };
  });
  b5.biff === 5 ? ok('הגרסה זוהתה כ-BIFF5') : bad('זיהוי הגרסה שגוי: BIFF' + b5.biff);
  b5.sheet === 'רשימת העירייה' ? ok('שם גיליון בעברית פוענח מדף קוד 1255') : bad('שם הגיליון שגוי: ' + b5.sheet);
  JSON.stringify(b5.rows) === JSON.stringify([['שם משפחה'], ['כהן', '300000001']])
    ? ok('מחרוזות ומספרים נקראו נכון') : bad('התאים שגויים', [JSON.stringify(b5.rows)]);

  /* פורמטים שאי אפשר לקרוא — הודעה שאומרת למה, ולא כשל אילם */
  const why = await p.evaluate(() => {
    const out = {};
    const mk = arr => new Uint8Array(arr);
    const u16 = v => [v & 0xFF, (v >> 8) & 0xFF];
    try { biffToRows(mk([0x09, 0x00, 0x04, 0x00, ...u16(0x0200), ...u16(5)])); }   // BIFF2
    catch (e) { out.old = e.message; }
    try { biffToRows(mk([0x09, 0x08, 0x08, 0x00, ...u16(0x0600), ...u16(5), ...u16(0), ...u16(0),
                         0x2F, 0x00, 0x02, 0x00, 0, 0])); }                        // FILEPASS
    catch (e) { out.locked = e.message; }
    return out;
  });
  /אקסל 4/.test(why.old || '') ? ok('פורמט עתיק מדווח בשמו') : bad('הודעת הפורמט הישן חסרה', [why.old]);
  /סיסמה/.test(why.locked || '') ? ok('קובץ מוגן בסיסמה מדווח ככזה') : bad('הודעת ההגנה חסרה', [why.locked]);

  console.log('\n18. זרם ששמו אינו Workbook');
  const named = await p.evaluate(b64 => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const r = xlsToRows(u8.buffer.slice(0));
    return { biff: r.biff, sheet: r.sheetName, rows: r.rows };
  }, NAMED_XLS_B64);
  named.biff === 5 ? ok('הזרם אותר ופוענח כ-BIFF5') : bad('הזרם לא אותר', [JSON.stringify(named)]);
  named.sheet === 'רשימת העירייה' ? ok('שם הגיליון נקרא') : bad('שם הגיליון שגוי: ' + named.sheet);
  JSON.stringify(named.rows) === JSON.stringify([['שם משפחה'], ['כהן', '300000001']])
    ? ok('התאים נקראו נכון') : bad('התאים שגויים', [JSON.stringify(named.rows)]);

  console.log('\n19. קובץ OLE בלי גיליון');
  /* אותו מיכל, כשחתימת ה-BOF של הזרם מקולקלת — כלומר אין בו חוברת אקסל */
  const noSheet = await p.evaluate(b64 => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    u8[1024] = 0x11; u8[1025] = 0x22;              // תחילת הזרם — כבר לא BOF
    try { xlsToRows(u8.buffer.slice(0)); return 'נקרא בטעות'; }
    catch (e) { return e.message; }
  }, NAMED_XLS_B64);
  /אין גיליון בקובץ/.test(noSheet) ? ok('ההודעה אומרת שאין גיליון') : bad('הודעה שגויה', [noSheet]);
  /Gilayon/.test(noSheet) ? ok('ההודעה מונה את הזרמים שנמצאו') : bad('הזרמים לא נמנו', [noSheet]);

  console.log('\n20. קובץ אקסל מוצפן');
  /* אותו מיכל, כששם הזרם הוא EncryptedPackage והתוכן אינו BIFF — כלומר
     קובץ אקסל שהוצפן בסיסמה או בהגנת מסמכים. */
  const enc = await p.evaluate(b64 => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    u8[1024] = 0x11; u8[1025] = 0x22;                    // התוכן כבר לא נראה כחוברת אקסל
    const E = 5120 + 128;                                 // רשומת הספרייה של הזרם
    const nm = 'EncryptedPackage';
    for (let i = 0; i < 64; i++) u8[E + i] = 0;
    for (let i = 0; i < nm.length; i++) { u8[E + 2 * i] = nm.charCodeAt(i); u8[E + 2 * i + 1] = 0; }
    u8[E + 64] = (nm.length + 1) * 2; u8[E + 65] = 0;     // אורך השם כולל הסיום
    let thrown = '';
    try { xlsToRows(u8.buffer.slice(0)); } catch (e) { thrown = e.message; }
    /* המסלול המלא: readFileSmart אמור לפתוח את חלון ההסבר */
    return new Promise(res => {
      const f = new File([u8], 'muni.xls');
      let called = false;
      readFileSmart(f, () => { called = true; });
      setTimeout(() => res({ thrown, called, modal: (document.querySelector('#modal') || {}).textContent || '' }), 400);
    });
  }, NAMED_XLS_B64);
  enc.thrown === 'ENCRYPTED' ? ok('ההצפנה זוהתה') : bad('ההצפנה לא זוהתה', [enc.thrown]);
  !enc.called ? ok('לא הוזרם תוכן מוצפן לתיבת הטקסט') : bad('תוכן מוצפן נכנס לתיבה');
  /מוגן בהצפנה/.test(enc.modal) ? ok('נפתח חלון הסבר') : bad('חלון ההסבר לא נפתח', [enc.modal.slice(0, 80)]);
  /שמירה בשם/.test(enc.modal) ? ok('החלון מסביר איך להסיר את ההגנה') : bad('אין הוראות בחלון');
  await p.evaluate(() => closeModal());

  console.log('\n21. מאזן הקלוטות — סיימו ועזבו · שורות בלי ת"ז · תיקים בלי ת"ז');
  /* התרחיש שדווח מהשטח: בקובץ העירייה 871 קלוטות ובתוכנה 861, בלי הסבר לפער.
     שלושת המקורות לפער נבדקים כאן יחד — מי שסיימה אצלנו (מוסתרת במסך התלמידות),
     שורה בקובץ בלי ת"ז (נשמטה בשקט), ותיק אצלנו בלי ת"ז (אינו ניתן להתאמה
     ולכן שורת העירייה פותחת לו כפילות). */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'a1',tz:'300000001',firstName:'רחל',lastName:'כהן',ganId:'g1'}),
      mk({id:'a2',tz:'300000002',firstName:'שרה',lastName:'לוי',ganId:'g1',finished:true}),
      mk({id:'a3',tz:'',firstName:'דבורה',lastName:'מזרחי',ganId:'g1'})];
    DB.municipality={};
    return 'ok';
  })()`);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(300);
  await load(p, [
    'מספר זהות,שם משפחה,שם פרטי,סמל מוסד',
    '300000001,כהן,רחל,111111',
    '300000002,לוי,שרה,111111',
    ',מזרחי,דבורה,111111',
    '300000007,חדשה,מלכה,111111'
  ].join('\n'));
  await run(p);
  const st21 = await stats(p);
  const html21 = await p.evaluate(() => document.querySelector('#muni-result').innerHTML);

  st21['סיימו ועזבו אצלנו'] === 1
    ? ok('חלון חדש: "סיימו ועזבו אצלנו" סופר את מי שברשימה וכבר עזבה')
    : bad('ספירת "סיימו ועזבו" שגויה', [JSON.stringify(st21)]);
  /1 מהקלוטות בעירייה מסומנות אצלנו/.test(html21)
    ? ok('מוצגת רשימת הקלוטות שסיימו, עם הורדה')
    : bad('חסר הפירוט של מי שסיימה');

  st21['ברשימת העירייה'] === 3
    ? ok('שורה בלי ת"ז אינה נספרת כמספר זהות') : bad('ספירת הרשימה שגויה', [JSON.stringify(st21)]);
  /1 שורות בקובץ העירייה בלי מספר זהות/.test(html21)
    ? ok('שורה בקובץ בלי ת"ז מדווחת (ולא נשמטת בשקט)') : bad('השורה בלי ת"ז לא דווחה');
  /שורה 4/.test(html21)
    ? ok('מספר השורה בקובץ מוצג לאיתור מהיר') : bad('מספר השורה חסר');

  /1 תיקים אצלנו בשנה זו בלי מספר זהות/.test(html21)
    ? ok('אזהרה: תיק אצלנו בלי ת"ז — מקור הכפילויות') : bad('אין אזהרה על תיק בלי ת"ז');
  /פותחת תיק חדש כפול/.test(html21)
    ? ok('האזהרה מסבירה למה נפתחות כפילויות') : bad('ההסבר על הכפילות חסר');
  /מאזן הקובץ/.test(html21)
    ? ok('מוצג מאזן שמסביר כל שורה בקובץ') : bad('אין שורת מאזן');

  /* תיק חדש שנפתח מרשימת הקלוטות — חייב להופיע כקלוט, ורק לא משובץ */
  const nu = await stu(p, '300000007');
  (nu && nu.absorbedMunicipality === true)
    ? ok('תיק חדש מרשימת הקלוטות מסומן "קלוט בעירייה"') : bad('התיק החדש אינו מסומן קלוט');
  (nu && nu.placed === false)
    ? ok('...ואינו משובץ') : bad('התיק החדש נפתח כמשובץ');
  /* מי שסיימה — עדיין מסומנת קלוט, כדי שהמספר מול העירייה יהיה נכון */
  const fin = await stu(p, '300000002');
  (fin && fin.absorbedMunicipality === true && fin.finished === true)
    ? ok('מי שסיימה סומנה קלוט ונשארה "סיימה"') : bad('הסימון על מי שסיימה שגוי', [JSON.stringify(fin)]);

  console.log('\n22. מסנן "בלי מספר זהות" במסך התלמידות');
  await p.evaluate(() => navToTab('students'));
  await p.waitForTimeout(300);
  const hasOpt = await p.evaluate(() => {
    const t = document.querySelector('#stuFilterToggle'); if (t) t.click();
    return new Promise(r => setTimeout(() => {
      const sel = document.querySelector('#f-flag');
      r(sel ? [...sel.options].some(o => o.value === 'noTz') : false);
    }, 300));
  });
  hasOpt ? ok('האפשרות קיימת במסנן "מאפיין"') : bad('המסנן לא נוסף');
  const only = await p.evaluate(() => {
    const sel = document.querySelector('#f-flag'); sel.value = 'noTz';
    sel.dispatchEvent(new Event('change'));
    return new Promise(r => setTimeout(() => {
      const names = [...document.querySelectorAll('#stuTable tbody tr td:nth-child(2)')].map(x => x.textContent.trim());
      r(names);
    }, 300));
  });
  (only.length === 1 && /מזרחי/.test(only[0]))
    ? ok('הסינון מציג רק את התיק שאין לו ת"ז') : bad('הסינון שגוי', [JSON.stringify(only)]);

  console.log('\n23. "לא קלוט בעירייה" אינו סופר את מי שסיימה ועזבה');
  /* תיק שעזב אינו עבודה שממתינה. משבצת "לא קלוט" שמונה עוזבות שולחת לטפל
     במי שכבר איננה — ולכן אף משבצת אינה סופרת אותן, גם כשהסינון מציג אותן. */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'b1',tz:'300000001',firstName:'א',lastName:'קלוטה',ganId:'g1',absorbedMunicipality:true}),
      mk({id:'b2',tz:'300000002',firstName:'ב',lastName:'לאקלוטה',ganId:'g1'}),
      mk({id:'b3',tz:'300000003',firstName:'ג',lastName:'עזבהלאקלוטה',ganId:'g1',finished:true}),
      mk({id:'b4',tz:'300000004',firstName:'ד',lastName:'עזבהקלוטה',ganId:'g1',absorbedMunicipality:true,finished:true})];
    DB.municipality={};
    return 'ok';
  })()`);
  await p.evaluate(() => navToTab('students'));
  await p.waitForTimeout(400);
  /* מנקים את הסינון שנשאר ממקטע 22, אחרת הטבלה עדיין מסוננת ל"בלי ת\"ז" */
  await p.evaluate(() => {
    const t = document.querySelector('#stuFilterToggle');
    if (t && document.querySelector('#stuFilterPanel').hasAttribute('hidden')) t.click();
    const c = document.querySelector('#f-clear'); if (c) c.click();
  });
  await p.waitForTimeout(400);
  const tiles = () => p.evaluate(() => ({
    t: Object.fromEntries([...document.querySelectorAll('#stuSummary .stat')].map(c =>
         [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])),
    rows: document.querySelectorAll('#stuTable tbody tr').length,
    note: (document.querySelector('#stuSummary .hint') || {}).textContent || '' }));
  const setStatus = async v => {
    await p.evaluate(val => {
      const t = document.querySelector('#stuFilterToggle');
      if (t && document.querySelector('#stuFilterPanel').hasAttribute('hidden')) t.click();
      const sel = document.querySelector('#f-status');
      if (sel) { sel.value = val; sel.dispatchEvent(new Event('change')); }
    }, v);
    await p.waitForTimeout(300);
  };

  let v = await tiles();
  (v.t['לא קלוט'] === 1 && v.t['רשומות'] === 2 && v.rows === 2)
    ? ok('ברירת מחדל — רק הפעילות נספרות ומוצגות') : bad('ברירת המחדל השתנתה', [JSON.stringify(v)]);
  !v.note ? ok('אין הערה מיותרת כשאין עוזבות בתצוגה') : bad('הופיעה הערה מיותרת', [v.note]);

  await setStatus('all');
  v = await tiles();
  v.rows === 4 ? ok('סינון "הכל" — הטבלה מציגה גם את העוזבות') : bad('הטבלה לא הציגה את העוזבות', [JSON.stringify(v)]);
  v.t['לא קלוט'] === 1
    ? ok('"לא קלוט" נשאר 1 — העוזבת הלא-קלוטה אינה נספרת')
    : bad('"לא קלוט" ספר עוזבת', [JSON.stringify(v.t)]);
  v.t['קלוט בעירייה'] === 1 ? ok('"קלוט בעירייה" גם הוא סופר רק פעילות') : bad('"קלוט" ספר עוזבת');
  v.t['רשומות'] === 2 ? ok('"רשומות" סופר רק פעילות') : bad('"רשומות" ספר עוזבות');
  /בטבלה מוצגות גם/.test(v.note) && /2/.test(v.note)
    ? ok('הערה מסבירה שההפרש בין הטבלה למשבצות הוא העוזבות') : bad('אין הערה מסבירה', [v.note]);

  await setStatus('finished');
  v = await tiles();
  (v.rows === 2 && v.t['לא קלוט'] === 0 && v.t['רשומות'] === 0)
    ? ok('סינון "שסיימו" — נגישות לחיפוש, אך אינן נספרות באף משבצת')
    : bad('העוזבות נספרו בסינון "שסיימו"', [JSON.stringify(v)]);
  await setStatus('active');

  console.log('\n24. למה "סה״כ פחות מספר הקובץ" אינו מספר הלא-קלוטות');
  /* התרחיש שדווח: 917 תלמידות בחינוך רגיל, 70 לא קלוטות, ובקובץ 871 קלוטות —
     "היה צריך לצאת 46". החיסור אינו תקף: המסך מסנן לסוג חינוך אחד ומסתיר את
     מי שסיימה, והקובץ כולל את כולם יחד. כאן נבדק שהתוכנה אומרת את זה במפורש.
     בתרחיש: 6 בקובץ — 3 רגיל פעילות, 2 ח"מ פעילות, 1 שסיימה. */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'c1',tz:'300000001',firstName:'א',lastName:'רגילה',ganId:'g1'}),
      mk({id:'c2',tz:'300000002',firstName:'ב',lastName:'רגילה',ganId:'g1'}),
      mk({id:'c3',tz:'300000003',firstName:'ג',lastName:'רגילה',ganId:'g1'}),
      mk({id:'c4',tz:'300000004',firstName:'ד',lastName:'מיוחדת',education:'ח"מ'}),
      mk({id:'c5',tz:'300000005',firstName:'ה',lastName:'מיוחדת',education:'ח"מ'}),
      mk({id:'c6',tz:'300000006',firstName:'ו',lastName:'עזבה',ganId:'g1',finished:true}),
      mk({id:'c7',tz:'300000007',firstName:'ז',lastName:'לאבקובץ',ganId:'g1'})];
    DB.municipality={};
    return 'ok';
  })()`);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(300);
  await load(p, [
    'מספר זהות,שם משפחה,שם פרטי,סמל מוסד',
    '300000001,רגילה,א,111111', '300000002,רגילה,ב,111111', '300000003,רגילה,ג,111111',
    '300000004,מיוחדת,ד,111111', '300000005,מיוחדת,ה,111111', '300000006,עזבה,ו,111111'
  ].join('\n'));
  await run(p);
  const w = await p.evaluate(() => document.querySelector('#muni-result').textContent.replace(/\s+/g, ' '));
  /איפה נמצאות 6 הקלוטות שבקובץ/.test(w)
    ? ok('מוצגת טבלת "איפה נמצאות הקלוטות שבקובץ"') : bad('אין טבלת פילוח');
  /חינוך רגיל — פעילות3כן/.test(w) ? ok('חינוך רגיל — 3') : bad('פילוח "רגיל" שגוי', [w.slice(0, 400)]);
  /חינוך ח"מ — פעילות2כן/.test(w) ? ok('חינוך מיוחד — 2') : bad('פילוח ח"מ שגוי', [w.slice(0, 400)]);
  /סיימו ועזבו אצלנו1לא — אינן נספרות/.test(w) ? ok('סיימו ועזבו — 1') : bad('פילוח העוזבות שגוי');
  /= 6 מתוך 6/.test(w) ? ok('הפילוח סוגר את החשבון — 6 מתוך 6') : bad('החשבון אינו נסגר', [w.slice(0, 600)]);
  /יהיה 5/.test(w) ? ok('נאמר שב"הכל" ייספרו 5 קלוטות') : bad('חסר המספר להשוואה');
  /מסך התלמידות מציג סוג חינוך אחד בכל פעם/.test(w)
    ? ok('מוסבר במפורש למה החיסור הישיר אינו תקף') : bad('אין הסבר על החיסור');

  console.log('\n25. שורת ההשוואה במסך התלמידות עצמו');
  await p.evaluate(() => { __set('activeEdu', 'רגיל'); navToTab('students'); });
  await p.waitForTimeout(400);
  const note = await p.evaluate(() => {
    const h = [...document.querySelectorAll('#stuSummary .hint')].map(x => x.textContent.replace(/\s+/g, ' '));
    const t = Object.fromEntries([...document.querySelectorAll('#stuSummary .stat')].map(c =>
      [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)]));
    return { h, t };
  });
  /* בחינוך רגיל פעילות: c1,c2,c3 (קלוטות) + c7 (לא קלוטה) = 4 */
  (note.t['רשומות'] === 4 && note.t['לא קלוט'] === 1)
    ? ok('המשבצות מציגות חינוך רגיל בלבד') : bad('המשבצות שגויות', [JSON.stringify(note.t)]);
  const line = note.h.join(' | ');
  /בכל סוגי החינוך/.test(line)
    ? ok('שורת השוואה: המספרים בכל סוגי החינוך') : bad('אין שורת השוואה', [line]);
  /6 תלמידות/.test(line) ? ok('סה"כ בשנה בכל החינוכים — 6 פעילות') : bad('סה"כ שגוי', [line]);
  /5 קלוטות/.test(line) ? ok('5 קלוטות — המספר שמושווה לקובץ') : bad('מספר הקלוטות שגוי', [line]);
  /1 לא קלוטות/.test(line) ? ok('1 לא קלוטה — ולא 70 מדומים') : bad('מספר הלא-קלוטות שגוי', [line]);
  await p.evaluate(() => { __set('activeEdu', null); });

  console.log('\n26. "למה N לא קלוטות" — פירוק הפער מול הרשימה השמורה');
  /* שחזור החשבון שדווח מהשטח, בקנה מידה קטן: 7 לא-קלוטות שהן
     2 בלי ת"ז + 3 שברשימה ולא סומנו (החריגה) + 2 שאינן ברשימה כלל.
     הבדיקה מוודאת שהפירוק סוגר בדיוק, שהחריגה מזוהה, ושהתיקון עובד. */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'d0',tz:'300000010',firstName:'קלוטה',lastName:'תקינה',ganId:'g1',absorbedMunicipality:true}),
      mk({id:'d1',tz:'',firstName:'א',lastName:'בליתז',ganId:'g1'}),
      mk({id:'d2',tz:'',firstName:'ב',lastName:'בליתז',ganId:'g1'}),
      mk({id:'d3',tz:'300000001',firstName:'ג',lastName:'ברשימה',ganId:'g1'}),
      mk({id:'d4',tz:'300000002',firstName:'ד',lastName:'ברשימה',ganId:'g1'}),
      mk({id:'d5',tz:'300000003',firstName:'ה',lastName:'ברשימה',ganId:'g1'}),
      mk({id:'d6',tz:'300000098',firstName:'ו',lastName:'לאברשימה',ganId:'g1'}),
      mk({id:'d7',tz:'300000099',firstName:'ז',lastName:'לאברשימה',ganId:'g1'})];
    /* הרשימה השמורה מההעלאה האחרונה — כוללת את d3/d4/d5 שלא סומנו */
    DB.municipality={'תשפ"ז':['300000010','300000001','300000002','300000003']};
    return 'ok';
  })()`);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(400);
  const btnTxt = await p.evaluate(() => {
    const b = document.querySelector('#muni-why'); return b ? b.textContent.trim() : '';
  });
  /למה 7 לא קלוטות/.test(btnTxt)
    ? ok('הכפתור נושא את המספר האמיתי שמטריד (7)') : bad('תווית הכפתור שגויה', [btnTxt]);

  await p.evaluate(() => document.querySelector('#muni-why').click());
  await p.waitForTimeout(400);
  const g = await p.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#muni-result .stat')].map(c =>
      [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));
  const gTxt = await p.evaluate(() => document.querySelector('#muni-result').textContent.replace(/\s+/g, ' '));

  g['בלי ת"ז'] === 2 ? ok('בלי ת"ז — 2') : bad('ספירת "בלי ת\"ז" שגויה', [JSON.stringify(g)]);
  g['ברשימה ולא מסומנות'] === 3
    ? ok('ברשימה ולא מסומנות — 3 (החריגה האמיתית)') : bad('החריגה לא זוהתה', [JSON.stringify(g)]);
  g['אינן ברשימה'] === 2 ? ok('אינן ברשימה — 2') : bad('ספירת "אינן ברשימה" שגויה', [JSON.stringify(g)]);
  /2 \+ 3 \+ 2 = 7/.test(gTxt) ? ok('הפירוק סוגר בדיוק: 2+3+2=7') : bad('הפירוק אינו סוגר', [gTxt.slice(0, 300)]);
  /300000001/.test(gTxt) && /300000003/.test(gTxt)
    ? ok('החריגות מפורטות בשמן ובת"ז') : bad('אין פירוט של החריגות');

  /* התיקון בלחיצה */
  p.once('dialog', d => d.accept());
  await p.evaluate(() => document.querySelector('#muni-fix').click());
  await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({
    marked: ['300000001','300000002','300000003'].map(t =>
      !!(DB.students.find(x => x.tz === t) || {}).absorbedMunicipality),
    untouched: !!(DB.students.find(x => x.tz === '300000098') || {}).absorbedMunicipality }));
  after.marked.every(Boolean) ? ok('הכפתור סימן את שלושת התיקים') : bad('הסימון לא בוצע', [JSON.stringify(after)]);
  !after.untouched ? ok('מי שאינה ברשימה לא נגעו בה') : bad('סומנה בטעות מי שאינה ברשימה');
  const g2 = await p.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#muni-result .stat')].map(c =>
      [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));
  g2['ברשימה ולא מסומנות'] === 0
    ? ok('אחרי התיקון — אין יותר חריגות') : bad('נשארו חריגות', [JSON.stringify(g2)]);

  console.log('\n27. ייצוא לפי מאפיין — "בלי מספר זהות"');
  /* אותן 8 תלמידות ממקטע 26 (מהן 2 בלי ת"ז), אחרי שהתיקון סימן שלוש כקלוטות.
     המטרה: להוציא לאקסל בדיוק את מי שאין לה ת"ז, כדי להשלים אותן ולסגור את
     הפער. המסנן חייב להיות אותו STU_FLAGS של המסך — לא עותק שיכול לסטות. */
  await p.evaluate(() => { __set('activeEdu', null); navToTab('students'); });
  await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#exportStu').click());
  await p.waitForTimeout(400);

  const flagOpts = await p.evaluate(() => {
    const sel = document.querySelector('#x-flag');
    return sel ? [...sel.options].map(o => o.value) : null;
  });
  (flagOpts && flagOpts.includes('noTz'))
    ? ok('נוסף מסנן "מאפיין" לחלון הייצוא, עם "בלי מספר זהות"') : bad('אין מסנן מאפיין בייצוא', [JSON.stringify(flagOpts)]);
  const sameAsScreen = await p.evaluate(() => {
    const a = [...document.querySelector('#x-flag').options].map(o => o.value).filter(Boolean).sort();
    return JSON.stringify(a);
  });
  const screenOpts = await p.evaluate(() => {
    /* אותה רשימה בדיוק כמו במסך התלמידות — שתיהן נגזרות מ-STU_FLAGS */
    return JSON.stringify(['campEndYear','campHanukkah','campNisan','insurancePaid','insuranceUnpaid','noTz','retention','retentionNext','tzaharon'].sort());
  });
  sameAsScreen === screenOpts
    ? ok('אותן אפשרויות בדיוק כמו במסך התלמידות') : bad('הרשימות נבדלו', [sameAsScreen, screenOpts]);

  const res = await p.evaluate(() => {
    document.querySelector('#x-flag').value = 'noTz';
    document.querySelector('#x-preview').click();
    return new Promise(r => setTimeout(() => {
      const rows = [...document.querySelectorAll('#x-out tbody tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim());
      r({ n: rows.length, rows, hint: (document.querySelector('#x-out .hint') || {}).textContent || '' });
    }, 350));
  });
  res.n === 2 ? ok('הייצוא מסונן ל-2 התיקים שאין להם ת"ז') : bad('מספר השורות שגוי', [JSON.stringify(res)]);
  res.rows.every(r => /בליתז/.test(r))
    ? ok('אלה בדיוק התיקים הנכונים') : bad('סוננו תיקים שגויים', [JSON.stringify(res.rows)]);

  /* וללא המסנן — כל התיקים חוזרים, כלומר המסנן אינו "דביק" */
  const all = await p.evaluate(() => {
    document.querySelector('#x-flag').value = '';
    document.querySelector('#x-preview').click();
    return new Promise(r => setTimeout(() =>
      r(document.querySelectorAll('#x-out tbody tr').length), 350));
  });
  all === 8 ? ok('ביטול המסנן מחזיר את כל 8 התיקים') : bad('הביטול לא עבד', [String(all)]);
  await p.evaluate(() => closeModal());

  console.log('\n28. מאזן מלא במצב השוואה — בלי לגעת בנתונים');
  /* שחזור מוקטן של המצב בשטח: הקובץ נראה כאילו יש בו 8 קלוטות, אבל בפועל
     6 ת"ז שונות (שורה כפולה + שורה בלי ת"ז). בתוכנה: 3 רגיל, 1 ח"מ,
     1 שסיימה, 1 שאינה בתוכנה. המאזן חייב להראות את כל אלה ולסגור. */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'e1',tz:'300000001',firstName:'א',lastName:'רגילה',ganId:'g1'}),
      mk({id:'e2',tz:'300000002',firstName:'ב',lastName:'רגילה',ganId:'g1'}),
      mk({id:'e3',tz:'300000003',firstName:'ג',lastName:'רגילה',ganId:'g1'}),
      mk({id:'e4',tz:'300000004',firstName:'ד',lastName:'מיוחדת',education:'ח"מ'}),
      mk({id:'e5',tz:'300000005',firstName:'ה',lastName:'עזבה',ganId:'g1',finished:true})];
    DB.municipality={};
    return 'ok';
  })()`);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(300);
  await load(p, [
    'מספר זהות,שם משפחה,שם פרטי,סמל מוסד',
    '300000001,רגילה,א,111111',
    '300000002,רגילה,ב,111111',
    '300000003,רגילה,ג,111111',
    '300000003,רגילה,ג,111111',      /* שורה כפולה */
    '300000004,מיוחדת,ד,111111',
    '300000005,עזבה,ה,111111',
    '300000077,חיצונית,ו,111111',    /* אינה בתוכנה */
    ',בליתז,ז,111111'                /* שורה בלי ת"ז */
  ].join('\n'));
  /* מצב השוואה — קריאה בלבד */
  await p.evaluate(() => { const m = document.querySelector('#muni-mode'); m.value = 'compare'; m.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(250);
  const absBefore = await p.evaluate(() => DB.students.filter(x => x.absorbedMunicipality).length);
  await run(p);
  const absAfter = await p.evaluate(() => DB.students.filter(x => x.absorbedMunicipality).length);
  const bal = await p.evaluate(() => document.querySelector('#muni-result').textContent.replace(/\s+/g, ' '));

  (absBefore === 0 && absAfter === 0) ? ok('מצב השוואה לא שינה שום נתון') : bad('נתונים שונו במצב השוואה', [absBefore + '→' + absAfter]);
  /מאזן מלא — איפה נמצאת כל שורה בקובץ/.test(bal) ? ok('מוצג המאזן המלא') : bad('אין מאזן מלא', [bal.slice(0, 300)]);
  /חינוך רגיל — פעילות3/.test(bal) ? ok('חינוך רגיל — 3') : bad('פילוח רגיל שגוי', [bal.slice(0, 500)]);
  /חינוך ח"מ — פעילות1/.test(bal) ? ok('חינוך מיוחד — 1') : bad('פילוח ח"מ שגוי', [bal.slice(0, 500)]);
  /סיימו ועזבו אצלנו1/.test(bal) ? ok('סיימו ועזבו — 1') : bad('פילוח עוזבות שגוי');
  /אינן בתוכנה כלל1/.test(bal) ? ok('אינה בתוכנה — 1') : bad('פילוח "אינן בתוכנה" שגוי');
  /סה״כ מספרי זהות שונים6תואם/.test(bal)
    ? ok('הסכום סוגר: 3+1+1+1 = 6 ת"ז שונות') : bad('הסכום אינו סוגר', [bal.slice(0, 800)]);
  /שורות כפולות \(אותה ת"ז\)1/.test(bal) ? ok('שורה כפולה זוהתה ונספרה בנפרד') : bad('הכפולה לא דווחה');
  /שורות בלי ת"ז1/.test(bal) ? ok('שורה בלי ת"ז זוהתה ונספרה בנפרד') : bad('השורה בלי ת"ז לא דווחה');
  /סה״כ שורות בקובץ8/.test(bal)
    ? ok('סה״כ שורות בקובץ = 8 — בדיוק מה שנספר באקסל') : bad('ספירת השורות שגויה', [bal.slice(0, 800)]);
  /ההפרש הוא שורות כפולות או שורות בלי ת"ז/.test(bal)
    ? ok('מוסבר למה הספירה באקסל גדולה מהספירה בתוכנה') : bad('אין ההסבר על ההפרש');

  console.log('\n29. הבדיקה אינה מתעלמת מחריגות בחינוך השני (רגרסיה)');
  /* הבאג: הבדיקה רצה דרך eduScope, ולכן כשבמסך נבחר "חינוך רגיל" היא לא
     הסתכלה כלל על חינוך מיוחד — והחזירה "0 חריגות" בזמן שהחריגות ישבו שם.
     תשובה מרגיעה ושגויה, שהיא הגרועה מכולן. רשימת העירייה אינה מפרידה לפי
     חינוך, ולכן גם הבדיקה לא צריכה. */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'f1',tz:'300000001',firstName:'א',lastName:'רגילהקלוטה',ganId:'g1',absorbedMunicipality:true}),
      /* שלוש חריגות — ברשימה, לא מסומנות, וכולן בחינוך מיוחד */
      mk({id:'f2',tz:'300000002',firstName:'ב',lastName:'מיוחדתחריגה',education:'ח"מ'}),
      mk({id:'f3',tz:'300000003',firstName:'ג',lastName:'מיוחדתחריגה',education:'ח"מ'}),
      mk({id:'f4',tz:'300000004',firstName:'ד',lastName:'מיוחדתחריגה',education:'ח"מ'})];
    DB.municipality={'תשפ"ז':['300000001','300000002','300000003','300000004']};
    __set('activeEdu','רגיל');           /* המסך מציג חינוך רגיל בלבד */
    return 'ok';
  })()`);
  /* מעבר דרך מסך אחר — כדי לכפות בנייה מחדש של מקטע העירייה עם הנתונים החדשים */
  await p.evaluate(() => navToTab('students'));
  await p.waitForTimeout(250);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(450);
  await p.evaluate(() => { const m = document.querySelector('#muni-mode'); if (m) { m.value = 'update'; m.dispatchEvent(new Event('change')); } });
  await p.waitForTimeout(200);
  const lbl = await p.evaluate(() => (document.querySelector('#muni-why') || {}).textContent || '');
  /למה 3 לא קלוטות\? \(כל החינוך\)/.test(lbl)
    ? ok('הכפתור סופר את כל סוגי החינוך, ומצהיר על כך') : bad('תווית הכפתור עדיין מסוננת', [lbl]);

  await p.evaluate(() => document.querySelector('#muni-why').click());
  await p.waitForTimeout(400);
  const d = await p.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#muni-result .stat')].map(c =>
      [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));
  const dTxt = await p.evaluate(() => document.querySelector('#muni-result').textContent.replace(/\s+/g, ' '));

  d['ברשימה ולא מסומנות'] === 3
    ? ok('שלוש החריגות שבחינוך מיוחד נמצאו — למרות שהמסך על "רגיל"')
    : bad('החריגות פוספסו — הבאג חזר', [JSON.stringify(d)]);
  /ח"מ: 3/.test(dTxt) ? ok('מצוין באיזה חינוך הן יושבות') : bad('אין פילוח חינוך', [dTxt.slice(0, 400)]);
  /במסך התלמידות, בחינוך רגיל, מוצגות מתוכן 0/.test(dTxt)
    ? ok('נאמר במפורש שבמסך הנוכחי לא רואים אף אחת מהן')
    : bad('אין הבהרה על הפער מול המסך', [dTxt.slice(0, 500)]);
  /300000002/.test(dTxt) && /300000004/.test(dTxt)
    ? ok('החריגות מפורטות בת"ז') : bad('אין פירוט');

  /* התיקון חוצה חינוכים גם הוא */
  p.once('dialog', dlg => dlg.accept());
  await p.evaluate(() => document.querySelector('#muni-fix').click());
  await p.waitForTimeout(500);
  const fixed = await p.evaluate(() => ['300000002','300000003','300000004']
    .map(t => !!(DB.students.find(x => x.tz === t) || {}).absorbedMunicipality));
  fixed.every(Boolean) ? ok('התיקון סימן גם את מי שבחינוך מיוחד') : bad('התיקון פספס', [JSON.stringify(fixed)]);
  await p.evaluate(() => { __set('activeEdu', null); });

  console.log('\n30. מאזן שורה-לשורה: "בתוכנה ולא מסומנת" נספרת ומיוצאת');
  /* המחלוקת שנשארה היא על מספרים, ולכן התשובה חייבת להיות ברמת השורה ולא
     ברמת הסיכום: לכל ת"ז בקובץ — מה בדיוק מצבה אצלנו, בקובץ שאפשר לפתוח
     באקסל ולסנן. כאן: 5 ת"ז בקובץ — 1 קלוטה, 1 קלוטה שסיימה, 2 שאינן
     מסומנות (החשודות), 1 שאינה בתוכנה. */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'h1',tz:'300000001',firstName:'א',lastName:'קלוטה',ganId:'g1',absorbedMunicipality:true}),
      mk({id:'h2',tz:'300000002',firstName:'ב',lastName:'קלוטהעזבה',ganId:'g1',absorbedMunicipality:true,finished:true}),
      mk({id:'h3',tz:'300000003',firstName:'ג',lastName:'לאמסומנת',ganId:'g1'}),
      mk({id:'h4',tz:'300000004',firstName:'ד',lastName:'לאמסומנתחמ',education:'ח"מ'})];
    DB.municipality={};
    return 'ok';
  })()`);
  await p.evaluate(() => navToTab('students'));
  await p.waitForTimeout(250);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(450);
  await load(p, [
    'מספר זהות,שם משפחה,שם פרטי,סמל מוסד',
    '300000001,קלוטה,א,111111',
    '300000002,קלוטהעזבה,ב,111111',
    '300000003,לאמסומנת,ג,111111',
    '300000004,לאמסומנתחמ,ד,111111',
    '300000055,חיצונית,ה,111111'
  ].join('\n'));
  await p.evaluate(() => { const m = document.querySelector('#muni-mode'); m.value = 'compare'; m.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(250);
  await run(p);
  const au = await p.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#muni-result .stat')].map(c =>
      [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));
  au['בתוכנה ולא מסומנות'] === 2
    ? ok('"בתוכנה ולא מסומנות" = 2 — כולל את זו שבחינוך מיוחד')
    : bad('הספירה שגויה', [JSON.stringify(au)]);
  const still = await p.evaluate(() => DB.students.filter(x => x.absorbedMunicipality).length);
  still === 2 ? ok('מצב השוואה עדיין לא שינה דבר') : bad('נתונים שונו', [String(still)]);

  /* הקובץ עצמו — נלכד דרך יירוט ההורדה */
  const csv = await p.evaluate(() => new Promise(r => {
    const orig = URL.createObjectURL;
    URL.createObjectURL = b => { b.text().then(t => { URL.createObjectURL = orig; r(t); }); return 'blob:x'; };
    document.querySelector('#muni-dl-audit').click();
    setTimeout(() => { URL.createObjectURL = orig; r(''); }, 1500);
  }));
  const lines = csv.replace(/^﻿/, '').trim().split(/\r?\n/);
  lines.length === 6 ? ok('הקובץ מכיל כותרת + שורה לכל אחת מ-5 הת"ז') : bad('מספר שורות שגוי', [String(lines.length), csv.slice(0, 200)]);
  /מצב/.test(lines[0]) ? ok('יש עמודת "מצב" לסינון באקסל') : bad('אין עמודת מצב', [lines[0]]);
  (csv.match(/בתוכנה — אינה מסומנת קלוטה/g) || []).length === 2
    ? ok('שתי השורות הלא-מסומנות מסומנות ככאלה בקובץ') : bad('סימון המצב שגוי', [csv]);
  /סיימה ועזבה — מחוץ לחשבון/.test(csv)
    ? ok('מי שסיימה מקבלת מצב נפרד, ומסומנת כמחוץ לחשבון') : bad('אין מצב נפרד למי שסיימה', [csv]);
  /300000055.*אינה בתוכנה כלל/.test(csv)
    ? ok('מי שאינה בתוכנה מופיעה אף היא, כדי שהסכום ייסגר') : bad('חסרה מי שאינה בתוכנה');
  /* csvCell עוטף מרכאות בעברית ככפולות — לכן מחפשים את הצורה שבקובץ עצמו */
  /ח""מ|ח"מ/.test(csv) ? ok('עמודת החינוך מאפשרת לפצל רגיל מול ח"מ באקסל')
    : bad('אין עמודת חינוך', [csv.split(/\r?\n/).slice(0,6).join(' | ')]);

  console.log('\n31. מי שעזבה יוצאת מהחשבון — משני צדדיו');
  /* המצב שדווח מהשטח בהקטנה: בקובץ 2 ת"ז של מי שעזבה, ואצלנו יש עוד עוזבת
     שאינה בקובץ כלל. אם העוזבות נספרות בצד הקובץ אך לא בצד המסך — ההפרש
     נראה כמו רשומות חסרות, וזו בדיוק הטעות שהחזיקה את החקירה תקועה.
     בקובץ: 5 ת"ז — 2 קלוטות פעילות, 2 עוזבות, 1 שאינה בתוכנה.
     אצלנו בנוסף: עוזבת שאינה בקובץ, ופעילה לא-מסומנת שאינה בקובץ. */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'k1',tz:'300000001',firstName:'א',lastName:'פעילהקלוטה',ganId:'g1',absorbedMunicipality:true}),
      mk({id:'k2',tz:'300000002',firstName:'ב',lastName:'פעילהקלוטה',ganId:'g1',absorbedMunicipality:true}),
      mk({id:'k3',tz:'300000003',firstName:'ג',lastName:'עזבהבקובץ',ganId:'g1',absorbedMunicipality:true,finished:true}),
      mk({id:'k4',tz:'300000004',firstName:'ד',lastName:'עזבהבקובץ',ganId:'g1',absorbedMunicipality:true,finished:true}),
      mk({id:'k5',tz:'300000005',firstName:'ה',lastName:'עזבהלאבקובץ',ganId:'g1',finished:true}),
      mk({id:'k6',tz:'300000006',firstName:'ו',lastName:'פעילהלאבקובץ',ganId:'g1'})];
    DB.municipality={};
    return 'ok';
  })()`);
  await p.evaluate(() => navToTab('students'));
  await p.waitForTimeout(250);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(450);
  await load(p, [
    'מספר זהות,שם משפחה,שם פרטי,סמל מוסד',
    '300000001,פעילהקלוטה,א,111111',
    '300000002,פעילהקלוטה,ב,111111',
    '300000003,עזבהבקובץ,ג,111111',
    '300000004,עזבהבקובץ,ד,111111',
    '300000077,חיצונית,ה,111111'
  ].join('\n'));
  await p.evaluate(() => { const m = document.querySelector('#muni-mode'); m.value = 'compare'; m.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(250);
  await run(p);
  const sc = await p.evaluate(() => document.querySelector('#muni-result').textContent.replace(/\s+/g, ' '));

  /מספרי זהות בקובץ5/.test(sc) ? ok('5 ת"ז בקובץ') : bad('ספירת הקובץ שגויה', [sc.slice(0, 400)]);
  /מהן — סיימו ועזבו אצלנו−2/.test(sc)
    ? ok('2 עוזבות מנוכות מצד הקובץ') : bad('העוזבות לא נוכו', [sc.slice(0, 600)]);
  /נשארות בחשבון3/.test(sc) ? ok('המספר להשוואה הוא 3 — ולא 5') : bad('המספר להשוואה שגוי', [sc.slice(0, 600)]);
  /מסומנות קלוטות אצלנו, פעילות.*2/.test(sc) ? ok('2 מסומנות ופעילות') : bad('ספירת המסומנות שגויה');
  /אינן בתוכנה כלל1/.test(sc) ? ok('1 אינה בתוכנה') : bad('ספירת "אינן בתוכנה" שגויה');
  /סה״כ3 ✓/.test(sc) ? ok('החשבון נסגר: 2 + 0 + 1 = 3 ✓') : bad('החשבון אינו נסגר', [sc.slice(0, 800)]);
  /העוזבת שאצלנו ואינה בקובץ אינה מוזכרת כלל בחשבון — היא לא בשני הצדדים */
  !/300000005/.test(sc) ? ok('עוזבת שאינה בקובץ אינה נכנסת לחשבון כלל') : bad('עוזבת חיצונית נכנסה לחשבון');

  /* עמודת "בחשבון" בקובץ ההורדה */
  const csv2 = await p.evaluate(() => new Promise(r => {
    const orig = URL.createObjectURL;
    URL.createObjectURL = b => { b.text().then(t => { URL.createObjectURL = orig; r(t); }); return 'blob:x'; };
    document.querySelector('#muni-dl-audit').click();
    setTimeout(() => { URL.createObjectURL = orig; r(''); }, 1500);
  }));
  /בחשבון/.test(csv2.split(/\r?\n/)[0]) ? ok('נוספה עמודת "בחשבון" לקובץ') : bad('אין עמודת בחשבון', [csv2.split(/\r?\n/)[0]]);
  (csv2.match(/סיימה ועזבה — מחוץ לחשבון/g) || []).length === 2
    ? ok('שתי העוזבות מסומנות "מחוץ לחשבון"') : bad('סימון העוזבות שגוי', [csv2]);
  (csv2.match(/,לא,/g) || []).length === 2
    ? ok('ערך "לא" בעמודת בחשבון — לסינון מהיר באקסל') : bad('ערך העמודה שגוי', [csv2]);

  console.log('\n32. הכיוון ההפוך — מסומנות אצלנו ואינן ברשימה');
  /* המצב שדווח: בתוכנה 847 קלוטות בחינוך רגיל, ובקובץ רק 843 — העודף אצלנו.
     הסיבה בקוד: absorbedMunicipality נכתב רק כ-true ואינו מתנקה לעולם, ולכן
     מי שסומנה בהעלאה קודמת נשארת מסומנת גם אחרי שירדה מהרשימה. עד עכשיו לא
     הייתה שום דרך לאתר אותן.
     כאן: 4 מסומנות — 2 ברשימה, 2 שאינן (אחת מהן בחינוך מיוחד). */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'m1',tz:'300000001',firstName:'א',lastName:'ברשימה',ganId:'g1',absorbedMunicipality:true}),
      mk({id:'m2',tz:'300000002',firstName:'ב',lastName:'ברשימה',ganId:'g1',absorbedMunicipality:true}),
      mk({id:'m3',tz:'300000031',firstName:'ג',lastName:'מסומנתעודפת',ganId:'g1',absorbedMunicipality:true}),
      mk({id:'m4',tz:'300000032',firstName:'ד',lastName:'מסומנתעודפתחמ',education:'ח"מ',absorbedMunicipality:true}),
      mk({id:'m5',tz:'300000005',firstName:'ה',lastName:'לאמסומנת',ganId:'g1'})];
    /* הרשימה השמורה — רק שתי הראשונות */
    DB.municipality={'תשפ"ז':['300000001','300000002']};
    __set('activeEdu','רגיל');
    return 'ok';
  })()`);
  await p.evaluate(() => navToTab('students'));
  await p.waitForTimeout(250);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(450);
  await p.evaluate(() => document.querySelector('#muni-why').click());
  await p.waitForTimeout(400);
  const rv = await p.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#muni-result .stat')].map(c =>
      [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));
  const rvTxt = await p.evaluate(() => document.querySelector('#muni-result').textContent.replace(/\s+/g, ' '));

  rv['מסומנות קלוטות (פעילות)'] === 4 ? ok('4 מסומנות קלוטות') : bad('ספירת המסומנות שגויה', [JSON.stringify(rv)]);
  rv['מסומנות ואינן ברשימה'] === 2
    ? ok('2 מסומנות ואינן ברשימה — כולל את זו שבחינוך מיוחד')
    : bad('הכיוון ההפוך לא זוהה', [JSON.stringify(rv)]);
  /300000031/.test(rvTxt) && /300000032/.test(rvTxt)
    ? ok('שתיהן מפורטות בת"ז') : bad('אין פירוט של העודפות');
  /הסימון "קלוט" אינו מתנקה מעצמו/.test(rvTxt)
    ? ok('מוסבר למה זה קורה') : bad('אין הסבר על מקור הבעיה');

  /* הסרת הסימון — רק מהעודפות */
  p.once('dialog', dlg => dlg.accept());
  await p.evaluate(() => document.querySelector('#muni-unmark').click());
  await p.waitForTimeout(500);
  const unmState = await p.evaluate(() => ({
    kept: ['300000001','300000002'].map(t => !!(DB.students.find(x => x.tz === t) || {}).absorbedMunicipality),
    cleared: ['300000031','300000032'].map(t => !!(DB.students.find(x => x.tz === t) || {}).absorbedMunicipality) }));
  unmState.kept.every(Boolean) ? ok('מי שברשימה נשארה מסומנת') : bad('הוסר סימון ממי שברשימה', [JSON.stringify(unmState)]);
  unmState.cleared.every(v => v === false) ? ok('הסימון הוסר משתי העודפות, בשני החינוכים') : bad('הסימון לא הוסר', [JSON.stringify(unmState)]);
  const rv2 = await p.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#muni-result .stat')].map(c =>
      [c.querySelector('.k').textContent.trim(), parseInt(c.querySelector('.v').textContent, 10)])));
  rv2['מסומנות ואינן ברשימה'] === 0 ? ok('אחרי הניקוי — שני הצדדים תואמים') : bad('נשארו עודפות', [JSON.stringify(rv2)]);
  await p.evaluate(() => { __set('activeEdu', null); });

  console.log('\n33. הזרימה לעתיד: העלאה אחת — וכל התמונה על המסך');
  /* הבדיקה שסוגרת את כל מה שנבנה: אחרי העלאה רגילה אחת, בלי שום לחיצה
     נוספת, הסיכום חייב להראות את ארבעת הדברים — הסימון בוצע · פילוח לפי
     סוג חינוך · מי שעזבה מחוץ לחשבון · ומי שמסומנת אצלנו ואינה בקובץ. */
  await p.evaluate(`(() => {
    DB.activeYear='תשפ"ז'; DB.years=['תשפ"ז'];
    DB.gans=[{id:'g1',ganName:'גן הדקל',ganSymbol:'111111',education:'רגיל',age:'4',active:true}];
    const mk=(o)=>Object.assign({ year:'תשפ"ז', finished:false, education:'רגיל', placed:true,
      docs:{}, docFiles:{}, programs:{}, programsPaid:{}, special:{}, support:{},
      dob:'', motherName:'', fatherName:'', phone:'', mobile:'', dadMobile:'', momMobile:'', email:'',
      street:'', building:'', city:'', absorbedMunicipality:false }, o);
    DB.students=[
      mk({id:'n1',tz:'300000001',firstName:'א',lastName:'רגילה',ganId:'g1'}),
      mk({id:'n2',tz:'300000002',firstName:'ב',lastName:'רגילה',ganId:'g1'}),
      mk({id:'n3',tz:'300000003',firstName:'ג',lastName:'מיוחדת',education:'ח"מ'}),
      mk({id:'n4',tz:'300000004',firstName:'ד',lastName:'עזבה',ganId:'g1',finished:true}),
      /* מסומנת מהעלאה קודמת, וירדה מהרשימה */
      mk({id:'n5',tz:'300000090',firstName:'ה',lastName:'עודפתישנה',ganId:'g1',absorbedMunicipality:true})];
    DB.municipality={};
    __set('activeEdu',null);
    return 'ok';
  })()`);
  await p.evaluate(() => navToTab('students'));
  await p.waitForTimeout(250);
  await p.evaluate(() => navToTab('municipality'));
  await p.waitForTimeout(450);
  await p.evaluate(() => { const m = document.querySelector('#muni-mode'); m.value = 'update'; m.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(200);
  await load(p, [
    'מספר זהות,שם משפחה,שם פרטי,סמל מוסד',
    '300000001,רגילה,א,111111',
    '300000002,רגילה,ב,111111',
    '300000003,מיוחדת,ג,111111',
    '300000004,עזבה,ד,111111'
  ].join('\n'));
  await run(p);
  const flow = await p.evaluate(() => document.querySelector('#muni-result').textContent.replace(/\s+/g, ' '));

  /* 1 — הסימון בוצע */
  const marks = await p.evaluate(() => ['300000001','300000002','300000003']
    .map(t => !!(DB.students.find(x => x.tz === t) || {}).absorbedMunicipality));
  marks.every(Boolean) ? ok('1. כולן סומנו קלוטות — כולל זו שבחינוך מיוחד') : bad('הסימון לא בוצע', [JSON.stringify(marks)]);

  /* 2 — פילוח לפי סוג חינוך */
  /חינוך רגיל — פעילות2/.test(flow) && /חינוך ח"מ — פעילות1/.test(flow)
    ? ok('2. הפילוח מראה כמה מהרשימה בכל סוג חינוך') : bad('אין פילוח חינוך', [flow.slice(0, 500)]);

  /* 3 — מי שעזבה מחוץ לחשבון */
  /המספר להשוואה: 3/.test(flow)
    ? ok('3. מי שעזבה מנוכה — המספר להשוואה הוא 3 מתוך 4') : bad('העוזבת לא נוכתה', [flow.slice(0, 700)]);

  /* 4 — מסומנת אצלנו ואינה בקובץ, אוטומטית */
  /1 תיקים מסומנים אצלנו כ"קלוט בעירייה" — ואינם בקובץ שהועלה עכשיו/.test(flow)
    ? ok('4. העודפת עלתה לבד בסיכום, בלי שום לחיצה נוספת') : bad('הכיוון ההפוך לא הופיע', [flow.slice(0, 900)]);
  /300000090/.test(flow) ? ok('   ...ומופיעה בת"ז ובשם') : bad('אין פירוט של העודפת');
  /ההחלטה שלך/.test(flow) ? ok('   ...ומוצגת כהחלטה, לא כפעולה אוטומטית') : bad('לא ברור שזו החלטה');

  /* ההסרה זמינה, ולא בוצעה מעצמה */
  const stillMarked = await p.evaluate(() => !!(DB.students.find(x => x.tz === '300000090') || {}).absorbedMunicipality);
  stillMarked ? ok('   ...ולא הוסרה מעצמה') : bad('הסימון הוסר בלי אישור');
  const hasBtn = await p.evaluate(() => !!document.querySelector('#muni-unmark2'));
  hasBtn ? ok('   ...עם כפתור להסרה בלחיצה') : bad('אין כפתור הסרה');

  if (!errs.length) ok('אין שגיאות JavaScript'); else bad('שגיאות בעמוד', errs);
  await browser.close(); server.close();
  console.log('\n' + '─'.repeat(52));
  console.log(fail ? `❌ ${fail} בדיקות נכשלו` : '✅ כל הבדיקות עברו');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
