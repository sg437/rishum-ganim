/* ============================================================================
   בדיקות למטמון הגשר (APPS_SCRIPT.gs) — הרצות בו-זמניות
   ----------------------------------------------------------------------------
   Apps Script מגביל ל-1,000 הרצות בו-זמנית, ומספר ההרצות שרצות יחד שווה בקירוב
   ל"קצב הקריאות × משך ההרצה". כל קריאה לגשר שילמה קודם 3–5 פניות רשת (אימות
   טוקן · טוקן Service Account · Firestore) ועוד סריקת שרשרת תיקיות ב-Drive,
   ורק אז התחילה לעבוד. הבדיקה מריצה את הקובץ האמיתי מול Drive/רשת/מטמון מדומים
   וסופרת פניות, כדי לוודא שהקיצור באמת קורה — ושלא נשמר מה שאסור לשמור:

     • המרת טוקן למייל נשמרת — פנייה אחת לכמה הרצות.
     • החלטת "מורשה" חיובית נשמרת; שלילה *לא* נשמרת (אישור נכנס לתוקף מיד).
     • נתיב תיקיות נשמר — הרצה שנייה אינה סורקת שוב תיקייה-תיקייה.
     • תיקייה שנמחקה במטמון מתגלה ומאותרת מחדש (לא מוחזר מזהה מת).

   אין כאן שום גישה לרשת — סימולציה טהורה ב-Node.
   הרצה:  node tests/bridge-cache.test.cjs
   ============================================================================ */
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const code = fs.readFileSync(path.join(__dirname, '..', 'APPS_SCRIPT.gs'), 'utf8');

let ok = 0;
function check(name, cond){ if(!cond) throw new Error('נכשל: ' + name); ok++; console.log('  ✓ ' + name); }

/* ---------- Drive מדומה: תיקיות בזיכרון, עם ספירת סריקות ---------- */
function makeDrive(){
  const byId = new Map();
  const counts = { scan:0, byId:0 };
  let seq = 0;
  function mkFolder(name, parentId){
    const id = 'f' + (++seq);
    const f = { id, name, parentId, trashed:false,
      getId: () => id,
      getName: () => name,
      getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      isTrashed: () => byId.get(id).trashed,
      getFoldersByName(n){
        counts.scan++;
        const kid = [...byId.values()].find(x => x.parentId === id && x.name === n && !x.trashed);
        let done = false;
        return { hasNext: () => !!kid && !done, next: () => { done = true; return kid; } };
      },
      createFolder(n){ return mkFolder(n, id); },
      moveTo(){ } };
    byId.set(id, f);
    return f;
  }
  const rootFolder = mkFolder('__root__', null);
  return {
    counts, byId,
    DriveApp: {
      getRootFolder(){ return rootFolder; },
      createFolder(n){ return mkFolder(n, rootFolder.id); },
      getFolderById(id){
        counts.byId++;
        const f = byId.get(id);
        if(!f) throw new Error('no-folder');
        return f;
      }
    }
  };
}

/* ---------- הקשר הרצה: כל מה שהגשר נוגע בו, מדומה ---------- */
function makeCtx(opts){
  opts = opts || {};
  const drive = makeDrive();
  const shared = new Map();                 // CacheService — משותף בין ההרצות
  const net = { identity:0, oauth:0, firestore:0 };
  const allowed = opts.allowed !== undefined ? opts.allowed : true;
  const ctx = {
    console,
    net, drive, shared,
    allow(v){ ctx.__allowed = v; },
    __allowed: allowed,
    DriveApp: drive.DriveApp,
    CacheService: { getScriptCache: () => ({
      get: k => (shared.has(k) ? shared.get(k) : null),
      put: (k, v) => { shared.set(k, v); }
    }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (opts.props || {})[k] || null }) },
    Utilities: {
      DigestAlgorithm: { MD5:'MD5' }, Charset: { UTF_8:'UTF_8' },
      computeDigest: (_a, v) => [...crypto.createHash('md5').update(String(v), 'utf8').digest()],
      base64EncodeWebSafe: v => Buffer.from(Array.isArray(v) ? Buffer.from(v) : Buffer.from(String(v), 'utf8'))
                                     .toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      computeRsaSha256Signature: () => [1, 2, 3]
    },
    UrlFetchApp: { fetch(url){
      if(/identitytoolkit/.test(url)){
        net.identity++;
        return { getResponseCode: () => 200,
                 getContentText: () => JSON.stringify({ users:[{ email:'miri@example.org' }] }) };
      }
      if(/oauth2/.test(url)){
        net.oauth++;
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ access_token:'sa-tok' }) };
      }
      net.firestore++;
      const emails = ctx.__allowed ? [{ stringValue:'miri@example.org' }] : [];
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({
        fields: { settings: { mapValue: { fields: { allowedEmails: { arrayValue: { values: emails } } } } } } }) };
    } }
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  ctx.exec = () => { ctx.MEM_ = {}; };      // הרצה חדשה — מטמון ההרצה נמחק, המשותף נשאר
  return ctx;
}

console.log('— מטמון הגשר —');

/* 1. המרת טוקן למייל — פנייה אחת לכמה הרצות */
{
  const c = makeCtx();
  c.exec(); c.tokenEmail_('tok-a');
  c.exec(); c.tokenEmail_('tok-a');
  c.exec(); c.tokenEmail_('tok-a');
  check('טוקן → מייל: פנייה אחת לשלוש הרצות', c.net.identity === 1);
  c.exec(); c.tokenEmail_('tok-b');
  check('טוקן אחר נבדק בפני עצמו', c.net.identity === 2);
}

/* 2. שער ההרשאה — אישור נשמר, שלילה לא */
{
  const c = makeCtx();
  const city = { id:'modiin-illit', legacy:true };
  c.exec(); check('מורשה — מאושר', c.allowedGate_('tok-a', city).ok === true);
  const fsAfterFirst = c.net.firestore;
  c.exec(); c.allowedGate_('tok-a', city);
  c.exec(); c.allowedGate_('tok-a', city);
  check('החלטה חיובית נשמרת — בלי פניות נוספות ל-Firestore', c.net.firestore === fsAfterFirst);
}
{
  const c = makeCtx({ allowed:false });
  const city = { id:'modiin-illit', legacy:true };
  c.exec(); check('לא מורשה — נחסם', c.allowedGate_('tok-a', city).ok === false);
  const fsAfterFirst = c.net.firestore;
  c.exec(); c.allowedGate_('tok-a', city);
  check('שלילה אינה נשמרת — נבדקת מחדש', c.net.firestore > fsAfterFirst);
  c.allow(true);
  c.exec(); check('אישור נכנס לתוקף מיד', c.allowedGate_('tok-a', city).ok === true);
}

/* 3. טוקן Service Account — הנפקה אחת, לא בכל קריאה */
{
  const c = makeCtx({ props:{ SA_CLIENT_EMAIL:'sa@x.iam.gserviceaccount.com', SA_PRIVATE_KEY:'k' } });
  c.exec(); c.saToken_(); c.saToken_();
  c.exec(); c.saToken_();
  check('טוקן Service Account מונפק פעם אחת', c.net.oauth === 1);
}

/* 4. נתיב תיקיות — ההרצה השנייה אינה סורקת שוב */
{
  const c = makeCtx();
  const city = { id:'modiin-illit', legacy:true };
  c.exec();
  const first = c.childFolder_('תשפ"ז', 'שרה כהן', 'חינוך רגיל', 'גן ורד', city);
  check('תיקיית ילדה נוצרה', !!first.folderId && /drive\.google\.com/.test(first.folderLink));
  const scans = c.drive.counts.scan;
  check('פעם ראשונה — סריקת שרשרת התיקיות', scans > 0);
  c.exec();
  const again = c.childFolder_('תשפ"ז', 'שרה כהן', 'חינוך רגיל', 'גן ורד', city);
  check('אותה תיקייה בדיוק', again.folderId === first.folderId);
  check('הרצה שנייה — בלי סריקה חוזרת', c.drive.counts.scan === scans);
  check('רק אימות מזהה אחד מול Drive', c.drive.counts.byId <= 2);
}

/* 5. תיקייה שנמחקה — מאותרת מחדש במקום להחזיר מזהה מת */
{
  const c = makeCtx();
  const city = { id:'modiin-illit', legacy:true };
  c.exec();
  const first = c.childFolder_('תשפ"ז', 'רבקה לוי', 'חינוך מיוחד', '', city);
  c.drive.byId.get(first.folderId).trashed = true;     // נמחקה ידנית ב-Drive
  c.exec();
  const healed = c.childFolder_('תשפ"ז', 'רבקה לוי', 'חינוך מיוחד', '', city);
  check('מטמון ישן מתרפא — מזהה חדש ותקין', healed.folderId && healed.folderId !== first.folderId);
  check('התיקייה החדשה קיימת', !c.drive.byId.get(healed.folderId).trashed);
}

/* 6. תיקיות צוות ורישום — עוברות באותו מסלול מטמון */
{
  const c = makeCtx();
  const city = { id:'modiin-illit', legacy:true };
  c.exec(); const s1 = c.staffFolder_('חינוך רגיל', 'מרים גולד', city);
  const scans = c.drive.counts.scan;
  c.exec(); const s2 = c.staffFolder_('חינוך רגיל', 'מרים גולד', city);
  check('תיקיית צוות — אותה תיקייה בלי סריקה חוזרת',
        s1.folderId === s2.folderId && c.drive.counts.scan === scans);
}

/* 7. שם ריק — התיקייה לא "נבלעת" לתוך תיקיית הגן */
{
  const c = makeCtx();
  const city = { id:'modiin-illit', legacy:true };
  c.exec();
  const gan = c.childFolder_('תשפ"ז', '   ', 'חינוך רגיל', 'גן ורד', city);
  const named = c.drive.byId.get(gan.folderId);
  check('שם ריק → "ללא שם", ולא תיקיית הגן עצמה', named.name === 'ללא שם');
  c.exec();
  const noYear = c.childFolder_('', 'לאה כהן', 'חינוך רגיל', '', city);
  const parent = c.drive.byId.get(c.drive.byId.get(noYear.folderId).parentId);
  check('שנה ריקה → "ללא שנה"', parent.name === 'ללא שנה');
}

/* 8. המטמון הוא לפי טוקן *ועיר* — שתי ערים אינן מתערבבות */
{
  const c = makeCtx();
  c.exec(); c.allowedGate_('tok-a', { id:'modiin-illit', legacy:true });
  const fsAfterHome = c.net.firestore;
  c.exec(); c.allowedGate_('tok-a', { id:'beitar', name:'ביתר', legacy:false });
  check('עיר אחרת נבדקת בפני עצמה', c.net.firestore > fsAfterHome);
}

console.log('\n✅ כל הבדיקות עברו (' + ok + ')');
