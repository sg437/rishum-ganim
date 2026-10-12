/* ============================================================================
   בדיקת "כתיבת meta לפי שדות" (field mask)
   ----------------------------------------------------------------------------
   התקלה: save() דרס את כל מסמך meta מהעותק שבמכשיר — עובדת רגילה שלחה גם את
   שדות ההרשאות (מעותק ישן → השרת דחה: "אין הרשאת כתיבה"), ודרסה את
   settings.userActivity של אחרות (→ הן איבדו הרשאה). כאן נבדק שהמסכה:
     1. לעובדת רגילה — בלי admins/allowedEmails/editScopes/userNames.
     2. למנהל/ת — כולל אותם.
     3. userActivity — רק הרשומה של המשתמש/ת עצמו/ה (נתיב מקונן), לכולם.
     4. כל נתיב במסכה קיים בנתונים (אחרת ה-SDK זורק שגיאה).
     5. פורמט REST: אימייל (עם @ ונקודה) עטוף ב-backticks ומקודד ל-URL.
   הרצה:  node tests/meta-mask.test.cjs
   ============================================================================ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function grab(decl){
  const at = SRC.indexOf(decl); if(at < 0) throw new Error('לא נמצא ב-index.html: ' + decl);
  let i = SRC.indexOf('{', at), depth = 0, inLine = false, inBlock = false, q = '', esc = false;
  for(let j = i; j < SRC.length; j++){
    const c = SRC[j], n = SRC[j+1];
    if(esc){ esc = false; continue; }
    if(q){ if(c === '\\') esc = true; else if(c === q) q = ''; continue; }
    if(inLine){ if(c === '\n') inLine = false; continue; }
    if(inBlock){ if(c === '*' && n === '/'){ inBlock = false; j++; } continue; }
    if(c === '/' && n === '/'){ inLine = true; j++; continue; }
    if(c === '/' && n === '*'){ inBlock = true; j++; continue; }
    if(c === '"' || c === "'" || c === '`'){ q = c; continue; }
    if(c === '{') depth++;
    else if(c === '}'){ depth--; if(!depth) return SRC.slice(at, j+1); }
  }
  throw new Error('סוגריים לא מאוזנים אחרי: ' + decl);
}
const line = d => { const a = SRC.indexOf(d); if(a<0) throw new Error('לא נמצא: '+d); return SRC.slice(a, SRC.indexOf('\n', a)); };
const code = [ line('const META_PRIV_FIELDS'), line('const _privDirty'), line('let _metaBase'), line('function markPrivDirty('), grab('function metaForWrite('), grab('function metaWriteSpec('), line("function _restFieldPath(")+"\n"+line("  return segs.map")+"\n}", line('function _restMaskQuery(') ].join('\n');
const ME = 'rivka.c@example.com';
const ctx = { Date, Object, Array, String, RegExp, JSON, encodeURIComponent, admin:false, cloudDocs:null,
  DB:{ activeYear:'2026', years:['2026','2025'], municipality:{a:1}, historical:{}, historicalGans:{}, assignments:{x:1}, tzGroups:{},
       settings:{ gansTarget:29, admins:['boss@example.com'], allowedEmails:['a@b.c'], editScopes:{ [ME]:'רגיל' }, userNames:{ [ME]:'רבקה' }, appLogo:'data:...', appTitle:'כותרת',
                  userActivity:{ [ME]:{ ts:1 }, 'other@example.com':{ ts:2 } } } },
  isAdmin(){ return ctx.admin; }, myEmail(){ return ME; } };
vm.createContext(ctx);
vm.runInContext(code + ';Object.defineProperty(this,"_metaBase",{set:v=>{_metaBase=v},get:()=>_metaBase});this.markPrivDirty=markPrivDirty; this._privDirty=_privDirty; this.metaWriteSpec=metaWriteSpec; this._restMaskQuery=_restMaskQuery; this._restFieldPath=_restFieldPath;', ctx);
let pass=0, fail=0; const check=(n,c,d)=>{ if(c){pass++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n+(d?'  → '+d:''));} };
const key = p => p.join('/');
const getAt = (o,p) => p.reduce((a,k)=> (a==null?undefined:a[k]), o);

console.log('1) עובדת רגילה');
ctx.markPrivDirty('admins'); // גם אם סומן — עובדת לא כותבת שדות הרשאה
let sp = ctx.metaWriteSpec(); let keys = sp.paths.map(key);
check('בלי שדות הרשאה', !keys.some(k=>/^settings\/(admins|allowedEmails|editScopes|userNames)$/.test(k)), keys.join(','));
check('userActivity רק של עצמה', keys.includes('settings/userActivity/'+ME) && !keys.includes('settings/userActivity') && !keys.includes('settings/userActivity/other@example.com'));
check('שאר ההגדרות כן', keys.includes('settings/gansTarget') && keys.includes('settings/appTitle'));
check('שדות-על כן', ['activeYear','years','municipality','assignments','updatedAt','updatedBy'].every(k=>keys.includes(k)));
check('appLogo לא נכתב ל-meta (נשמר ב-branding)', !keys.includes('settings/appLogo'));
check('כל נתיב קיים בנתונים', sp.paths.every(p=>getAt(sp.data,p)!==undefined));

ctx._privDirty.clear();
console.log('2) מנהל/ת');
ctx.admin = true; sp = ctx.metaWriteSpec(); keys = sp.paths.map(key);
check('מנהל/ת ששמר/ה תיק — לא כותב/ת רשימות הרשאה (עותק ישן לא מוחק אף אחד)', !keys.some(k=>/^settings\/(admins|allowedEmails|editScopes|userNames)$/.test(k)), keys.join(','));
['admins','allowedEmails','editScopes','userNames'].forEach(f=>ctx.markPrivDirty(f));
sp = ctx.metaWriteSpec(); keys = sp.paths.map(key);
check('מנהל/ת ששינה/תה הרשאות — כולל שדות הרשאה', ['settings/admins','settings/allowedEmails','settings/editScopes','settings/userNames'].every(k=>keys.includes(k)));
check('גם למנהל — userActivity רק של עצמו', keys.includes('settings/userActivity/'+ME) && !keys.includes('settings/userActivity'));
check('כל נתיב קיים בנתונים', sp.paths.every(p=>getAt(sp.data,p)!==undefined));

console.log('2ב) רק מה שהשתנה מול השרת — עותק ישן לא מוחק פנייה חדשה');
ctx._privDirty.clear(); ctx.admin=false;
ctx.DB.settings.feedback = [];                                                           // במכשיר: עותק (ישן) בלי הפנייה החדשה
ctx._metaBase = JSON.parse(JSON.stringify(ctx.metaWriteSpec().data));                     // המסך נבנה מה-meta הזה
// בינתיים בשרת נוספה פנייה חדשה — המכשיר לא יודע עליה
ctx.DB.settings.userActivity[ME] = { ts: 99 };                                           // העריכה שלה עכשיו
sp = ctx.metaWriteSpec(); keys = sp.paths.map(key);
check('הפניות לא נכתבות (לא נוגעים ברשימת הפניות שבשרת)', !keys.includes('settings/feedback'), keys.join(','));
check('הגדרות שלא השתנו לא נכתבות', !keys.includes('settings/gansTarget') && !keys.includes('years'));
check('הפעילות שלה וחותמת השמירה כן', keys.includes('settings/userActivity/'+ME) && keys.includes('updatedAt'));
ctx.DB.settings.feedback = [{ id:'mine', text:'פנייה שלי' }];
sp = ctx.metaWriteSpec(); keys = sp.paths.map(key);
check('פנייה שהיא הוסיפה — כן נכתבת', keys.includes('settings/feedback'));
ctx._metaBase = null; ctx.DB.settings.feedback = undefined;

console.log('3) פורמט REST');
check('אימייל עטוף ב-backticks', ctx._restFieldPath(['settings','userActivity',ME])==='settings.userActivity.`'+ME+'`');
check('מזהה פשוט בלי עטיפה', ctx._restFieldPath(['settings','gansTarget'])==='settings.gansTarget');
const q = ctx._restMaskQuery([['activeYear'],['settings','userActivity',ME]]);
check('שאילתת updateMask מקודדת', q==='updateMask.fieldPaths=activeYear&updateMask.fieldPaths='+encodeURIComponent('settings.userActivity.`'+ME+'`'));

console.log('4) שימוש בפועל ב-index.html');
check('SDK: setDoc של meta עם mergeFields', /setDoc\(cityDoc\("meta"\), ms\.data, \{ mergeFields/.test(SRC));
check('REST: PATCH של meta עם updateMask', /base\+"meta\?"\+_restMaskQuery\(ms\.paths\)/.test(SRC));
check('אין יותר כתיבת meta מלאה', !/setDoc\(cityDoc\("meta"\), metaForWrite\(\)\)/.test(SRC) && !/body:JSON\.stringify\(\{fields:encFsFields\(metaForWrite\(\)\)\}\)/.test(SRC));
check('בנייה-מחדש שומרת גלילה', (SRC.match(/rerenderKeepScroll\(\)/g)||[]).length>=2);

console.log(`\n${pass} עברו · ${fail} נכשלו`); process.exit(fail?1:0);
