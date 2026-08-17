/**
 * גשר Google Drive למערכת רישום התלמידות.
 * ------------------------------------------------------------------
 * מפרסמים כ-Web App כדי שהתוכנה תוכל ליצור תיקיות, להעלות, לצפות ולהוריד
 * מסמכים ב-Drive — עבור כל משתמש שמחובר לתוכנה, בלי חיבור Google אישי.
 *
 * הפעלה (ראה SETUP.md — "גשר Drive"):
 *   1. היכנסו ל-https://script.google.com עם חשבון ה-Drive של הארגון
 *      (כל הקבצים ייווצרו ב-Drive של החשבון הזה).
 *   2. New project → הדביקו את כל הקובץ הזה ל-Code.gs → Save.
 *   3. Deploy → New deployment → Type: Web app
 *        - Execute as: Me (חשבון הארגון)
 *        - Who has access: Anyone
 *      → Deploy → אשרו את ההרשאות → העתיקו את כתובת ה-Web app (/exec).
 *   4. שלחו את הכתובת — היא נכנסת ל-APPS_SCRIPT_URL ב-index.html.
 * ------------------------------------------------------------------
 */

// מפתח ה-Web של Firebase (זהה ל-apiKey ב-index.html) — משמש לאימות שהבקשה
// מגיעה ממשתמש שמחובר לתוכנה. אינו סוד.
var FIREBASE_API_KEY = 'AIzaSyBRIWtqtPXxd-W0WR3nB-iGn0Qn9ml-Q8I';

// מזהה פרויקט Firebase (זהה ל-projectId ב-index.html). משמש לניהול משתמשים ולבדיקת מנהל.
var FIREBASE_PROJECT_ID = 'rishum-ganim-fad40';

// שם תיקיית האב שתיווצר ב-Drive (אפשר לשנות לפי הצורך).
var ROOT_FOLDER_NAME = 'מסמכי רישום תלמידות (מהמערכת)';

// פעולות ניהול משתמשים — דורשות שהקורא יהיה מנהל מערכת (settings.admins ב-Firestore).
var USER_ACTIONS = { userCreate:true, userList:true, userDelete:true, userSetPassword:true, userSetName:true };

function doPost(e){
  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try{
    // תומך גם בשליחה דרך שאילתת ה-URL (?data=) וגם בגוף הבקשה — כי Apps Script
    // לעיתים משמיט את גוף ה-POST החוצה-מקור, והנתונים בשאילתה שורדים הפניות.
    var req = JSON.parse((e && e.parameter && e.parameter.data) || (e && e.postData && e.postData.contents) || '{}');
    if(!verifyToken_(req.idToken)) return json_(out, {ok:false, error:'unauthorized'});
    // פעולות ניהול משתמשים פתוחות למנהלי מערכת בלבד.
    if(USER_ACTIONS[req.action]){
      var gate = adminGate_(req.idToken);
      if(!gate.ok) return json_(out, {ok:false, error:gate.error || 'not-admin'});
    }
    switch(req.action){
      case 'ping':           return json_(out, ping_());
      case 'childFolder':    return json_(out, childFolder_(req.year, req.name, req.edu, req.gan));
      case 'childMove':      return json_(out, childMove_(req.folderId, req.year, req.edu, req.gan));
      case 'chat':           return json_(out, chat_(req.messages, req.system, req.model));
      case 'sendMail':       return json_(out, sendMail_(req.to, req.subject, req.body));
      case 'staffFolder':    return json_(out, staffFolder_(req.edu, req.name));
      case 'list':           return json_(out, list_(req.folderId));
      case 'upload':         return json_(out, upload_(req.folderId, req.name, req.mimeType, req.dataB64));
      case 'copy':           return json_(out, copy_(req.fileId, req.folderId, req.name));
      case 'download':       return json_(out, download_(req.fileId));
      case 'sheetSync':      return json_(out, sheetSync_(req.title, req.sheets));
      case 'share':          return json_(out, share_(req.email, req.role));
      case 'shareList':      return json_(out, shareList_());
      case 'shareRemove':    return json_(out, shareRemove_(req.email));
      case 'userCreate':     return json_(out, userCreate_(req.email, req.password, req.name));
      case 'userList':       return json_(out, userList_());
      case 'userDelete':     return json_(out, userDelete_(req.uid));
      case 'userSetPassword':return json_(out, userSetPassword_(req.uid, req.password));
      case 'userSetName':    return json_(out, userSetName_(req.uid, req.name));
      default:               return json_(out, {ok:false, error:'unknown-action'});
    }
  }catch(err){
    return json_(out, {ok:false, error:String(err)});
  }
}

function doGet(e){ return ContentService.createTextOutput('OK'); }

/* שליחת מייל מהשרת (מחשבון הגשר) — לפניות/הצעות שמגיעות מהמערכת */
function sendMail_(to, subject, body){
  if(!to) return { ok:false, error:'no-recipient' };
  MailApp.sendEmail(String(to), String(subject || '(ללא נושא)'), String(body || ''));
  return { ok:true };
}

/* ============================================================
   עוזר AI (Claude) — הבקשה עוברת דרך הגשר כדי שמפתח ה-API יישאר מוסתר.
   הגדרה חד-פעמית: Project Settings → Script Properties → הוסף מפתח בשם
   ANTHROPIC_API_KEY עם הערך של המפתח מ-console.anthropic.com.
   ============================================================ */
function chat_(messages, system, model){
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if(!key) return { ok:false, error:'no-ai-key' };   // עדיין לא הוגדר מפתח
  var payload = {
    model: model || 'claude-haiku-4-5',
    max_tokens: 1024,
    system: String(system || ''),
    messages: (messages || []).slice(-16)             // שומר את 16 ההודעות האחרונות
  };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var data; try{ data = JSON.parse(res.getContentText() || '{}'); }catch(e){ data = {}; }
  if(code >= 400) return { ok:false, error: (data.error && data.error.message) || ('http-' + code) };
  var text = (data.content || []).filter(function(b){ return b.type === 'text'; })
                                 .map(function(b){ return b.text; }).join('\n');
  return { ok:true, text: text };
}

function json_(out, obj){ out.setContent(JSON.stringify(obj)); return out; }

/* אימות שהבקשה הגיעה ממשתמש מחובר של הפרויקט (טוקן Firebase תקף) */
function verifyToken_(idToken){
  if(!idToken) return false;
  try{
    var resp = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY,
      { method:'post', contentType:'application/json',
        payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions:true });
    if(resp.getResponseCode() !== 200) return false;
    var d = JSON.parse(resp.getContentText());
    return !!(d && d.users && d.users.length > 0);
  }catch(err){ return false; }
}

function root_(){
  var it = DriveApp.getRootFolder().getFoldersByName(ROOT_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
}
function sub_(parent, name){
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function ping_(){
  var r = root_();
  return { ok:true, rootId:r.getId(), rootLink:r.getUrl() };
}
/* שם תיקיית החינוך הראשית — חלוקה ל"חינוך רגיל" / "חינוך מיוחד" (סעיף 12) */
function eduFolderName_(edu){
  var e = String(edu || '').replace(/\s/g,'');
  if(e.indexOf('מיוחד') >= 0 || e === 'ח"מ' || e === 'חמ') return 'חינוך מיוחד';
  return 'חינוך רגיל';
}
function childFolder_(year, name, edu, gan){
  var r = root_();
  var e = sub_(r, eduFolderName_(edu));            // חלוקה ראשית לפי חינוך (סעיף 12)
  var y = sub_(e, String(year || 'ללא שנה'));
  var parent = (gan && String(gan).trim()) ? sub_(y, String(gan).trim()) : y;  // תיקיית גן בתוך השנה (חינוך → שנה → גן → ילדה)
  var c = sub_(parent, String(name || 'ללא שם'));
  return { ok:true, folderId:c.getId(), folderLink:c.getUrl(), rootLink:r.getUrl() };
}
/* העברת תיקיית ילדה קיימת אל תוך תיקיית הגן שלה (ארגון מחדש של מבנה קיים) */
function childMove_(folderId, year, edu, gan){
  var r = root_();
  var e = sub_(r, eduFolderName_(edu));
  var y = sub_(e, String(year || 'ללא שנה'));
  var parent = (gan && String(gan).trim()) ? sub_(y, String(gan).trim()) : y;
  var f = DriveApp.getFolderById(folderId);
  f.moveTo(parent);                                 // מעביר לתיקיית היעד (שומר על התוכן)
  return { ok:true, folderId:f.getId(), folderLink:f.getUrl() };
}
/* תיקיית אנשי צוות — לפי חינוך, ובתוכה תיקייה לכל איש/אשת צוות (סעיפים 12, 17) */
function staffFolder_(edu, name){
  var r = root_();
  var e = sub_(r, eduFolderName_(edu));
  var s = sub_(e, 'אנשי צוות');
  var c = sub_(s, String(name || 'ללא שם'));
  return { ok:true, folderId:c.getId(), folderLink:c.getUrl(), rootLink:r.getUrl() };
}
function list_(folderId){
  var f = DriveApp.getFolderById(folderId);
  var it = f.getFiles(), files = [];
  while(it.hasNext()){
    var x = it.next();
    files.push({ id:x.getId(), name:x.getName(), mimeType:x.getMimeType(), link:x.getUrl(), size:x.getSize() });
  }
  files.sort(function(a,b){ return a.name < b.name ? -1 : 1; });
  return { ok:true, files:files };
}
function upload_(folderId, name, mimeType, dataB64){
  var f = DriveApp.getFolderById(folderId);
  var blob = Utilities.newBlob(Utilities.base64Decode(dataB64), mimeType || 'application/octet-stream', name || 'file');
  var file = f.createFile(blob);
  return { ok:true, id:file.getId(), name:file.getName(), link:file.getUrl() };
}
function copy_(fileId, folderId, name){
  var file = DriveApp.getFileById(fileId);
  var folder = DriveApp.getFolderById(folderId);
  var c = file.makeCopy(name || file.getName(), folder);
  return { ok:true, id:c.getId(), name:c.getName(), link:c.getUrl() };
}
function download_(fileId){
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  return { ok:true, name:file.getName(), mimeType:blob.getContentType(), dataB64: Utilities.base64Encode(blob.getBytes()) };
}
function share_(email, role){
  var r = root_();
  if(role === 'writer') r.addEditor(email); else r.addViewer(email);
  return { ok:true };
}

/* ==================================================================
   שיקוף נתונים ל-Google Sheets (סעיף 12)
   ------------------------------------------------------------------
   מקבל מהתוכנה מבנה של גיליונות: [{ name, headers:[...], rows:[[...],...] }, ...]
   ומכתיב אותם לקובץ Google Sheets בתיקיית האב (יוצר אם אין, לשונית לכל ישות).
   הקובץ הוא "מראה" של הנתונים — מקור האמת נשאר Firestore.
   ================================================================== */
var SHEET_FILE_NAME = 'רשת הגנים מודיעין עילית — נתונים (שיקוף)';
function sheetSync_(title, sheets){
  if(!sheets || !sheets.length) return { ok:false, error:'no-data' };
  var r = root_();
  var name = String(title || SHEET_FILE_NAME);
  var ss = null;
  var it = r.getFilesByName(name);
  if(it.hasNext()){
    try{ ss = SpreadsheetApp.open(it.next()); }catch(e){ ss = null; }
  }
  if(!ss){
    ss = SpreadsheetApp.create(name);
    // העברת הקובץ שנוצר לתיקיית האב (SpreadsheetApp.create יוצר בשורש ה-Drive)
    try{ var f = DriveApp.getFileById(ss.getId()); r.addFile(f); DriveApp.getRootFolder().removeFile(f); }catch(e){}
  }
  var keep = {};
  sheets.forEach(function(s){
    var sName = String(s.name || 'גיליון');
    keep[sName] = true;
    var sh = ss.getSheetByName(sName) || ss.insertSheet(sName);
    sh.clear();
    try{ sh.setRightToLeft(true); }catch(e){}
    var headers = s.headers || [];
    var rows = s.rows || [];
    var W = headers.length;
    if(!W) return;
    var data = [headers];
    for(var i=0;i<rows.length;i++){
      var src = rows[i] || [], row = [];
      for(var c=0;c<W;c++){ row.push(src[c] != null ? src[c] : ''); }
      data.push(row);
    }
    sh.getRange(1, 1, data.length, W).setValues(data);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, W).setFontWeight('bold').setBackground('#e8f2ea');
    try{ sh.autoResizeColumns(1, W); }catch(e){}
  });
  // הסרת לשוניות ישנות שאינן בשימוש (כולל לשונית ברירת המחדל)
  ss.getSheets().forEach(function(sh){
    if(!keep[sh.getName()] && ss.getSheets().length > 1){ try{ ss.deleteSheet(sh); }catch(e){} }
  });
  return { ok:true, sheetId:ss.getId(), sheetLink:ss.getUrl() };
}
/* מי משותף עם תיקיית האב — בעלים/עורכים/צופים (שם, אימייל, הרשאה). */
function shareList_(){
  var r = root_();
  var map = {}; // email(lower) -> {name, email, role, rank}
  function add(u, role, rank){
    if(!u) return;
    var em; try{ em = u.getEmail(); }catch(e){ em = ''; }
    if(!em) return;
    var key = em.toLowerCase();
    if(!map[key] || rank > map[key].rank){
      var nm = ''; try{ nm = u.getName() || ''; }catch(e){}
      map[key] = { name:nm, email:em, role:role, rank:rank };
    }
  }
  try{ add(r.getOwner(), 'owner', 3); }catch(e){}
  try{ r.getEditors().forEach(function(u){ add(u, 'writer', 2); }); }catch(e){}
  try{ r.getViewers().forEach(function(u){ add(u, 'reader', 1); }); }catch(e){}
  var shares = [];
  for(var k in map){ if(map.hasOwnProperty(k)){ shares.push({ name:map[k].name, email:map[k].email, role:map[k].role }); } }
  shares.sort(function(a,b){ return (a.email < b.email) ? -1 : 1; });
  return { ok:true, shares:shares };
}
/* הסרת גישה ישירה ל-Drive (עורך/צופה). לא ניתן להסיר בעלים. */
function shareRemove_(email){
  email = String(email || '').trim();
  if(!email) return { ok:false, error:'no-email' };
  var r = root_();
  try{ r.removeEditor(email); }catch(e){}
  try{ r.removeViewer(email); }catch(e){}
  return { ok:true };
}

/* ==================================================================
   ניהול משתמשים (Firebase Authentication) — ראה SETUP.md
   ------------------------------------------------------------------
   - יצירת משתמש: דרך מפתח ה-Web (accounts:signUp) — בלי הגדרות נוספות.
   - רשימה / מחיקה / איפוס סיסמה: דורשים Service Account המוגדר ב-Script
     Properties (SA_CLIENT_EMAIL, SA_PRIVATE_KEY) — פעולות אדמין ב-Identity
     Toolkit. שירותים אלה חינמיים (אינם דורשים תוכנית Blaze).
   ================================================================== */

/* אימות שהקורא הוא מנהל מערכת: קורא את app/meta מ-Firestore עם הטוקן של
   הקורא עצמו (הרשאת קריאה בסיסית), ובודק את רשימת settings.admins. רשימה
   ריקה = מצב אתחול (כל משתמש מחובר רשאי) — תואם ל-isAdmin() באפליקציה. */
function adminGate_(idToken){
  var email = tokenEmail_(idToken);
  if(!email) return { ok:false, error:'unauthorized' };
  try{
    var url = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID +
              '/databases/(default)/documents/app/meta';
    var resp = UrlFetchApp.fetch(url, { headers:{ Authorization:'Bearer ' + idToken }, muteHttpExceptions:true });
    if(resp.getResponseCode() !== 200) return { ok:false, error:'admin-check-failed' };
    var admins = [];
    try{
      var vals = JSON.parse(resp.getContentText()).fields.settings.mapValue.fields.admins.arrayValue.values || [];
      admins = vals.map(function(v){ return String(v.stringValue || '').toLowerCase(); }).filter(String);
    }catch(e){ admins = []; }
    if(!admins.length) return { ok:true };            // מצב אתחול
    if(admins.indexOf(email) >= 0) return { ok:true };
    return { ok:false, error:'not-admin' };
  }catch(err){ return { ok:false, error:'admin-check-failed' }; }
}

/* מחזיר את האימייל (lower-case) של בעל הטוקן, או null אם אינו תקף. */
function tokenEmail_(idToken){
  if(!idToken) return null;
  try{
    var resp = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY,
      { method:'post', contentType:'application/json',
        payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions:true });
    if(resp.getResponseCode() !== 200) return null;
    var d = JSON.parse(resp.getContentText());
    return (d.users && d.users[0] && String(d.users[0].email || '').toLowerCase()) || null;
  }catch(err){ return null; }
}

/* יצירת משתמש חדש — דרך מפתח ה-Web (signUp). אינו דורש Service Account.
   אם סופק שם ו-Service Account מוגדר — נקבע גם displayName. */
function userCreate_(email, password, name){
  email = String(email || '').trim();
  password = String(password || '');
  name = String(name || '').trim();
  if(!email) return { ok:false, error:'no-email' };
  if(password.length < 6) return { ok:false, error:'weak-password' };
  var resp = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + FIREBASE_API_KEY,
    { method:'post', contentType:'application/json',
      payload: JSON.stringify({ email:email, password:password, returnSecureToken:true }),
      muteHttpExceptions:true });
  var d = JSON.parse(resp.getContentText());
  if(resp.getResponseCode() !== 200) return { ok:false, error:(d.error && d.error.message) || 'signup-failed' };
  if(name){ var token = saToken_(); if(token) accountsUpdate_(token, { localId:d.localId, displayName:name }); }
  return { ok:true, uid:d.localId, email:email };
}

/* רשימת כל המשתמשים — דורש Service Account. אם אינו מוגדר: saConfigured=false. */
function userList_(){
  var token = saToken_();
  if(!token) return { ok:true, saConfigured:false, users:[] };
  var url = 'https://identitytoolkit.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/accounts:query';
  var resp = UrlFetchApp.fetch(url, { method:'post', contentType:'application/json',
    headers:{ Authorization:'Bearer ' + token }, payload: JSON.stringify({}), muteHttpExceptions:true });
  var d = JSON.parse(resp.getContentText());
  if(resp.getResponseCode() !== 200) return { ok:false, error:(d.error && d.error.message) || 'query-failed' };
  var arr = d.userInfo || d.users || [];
  var users = arr.map(function(u){
    return { uid:u.localId, email:u.email || '', name:u.displayName || '',
             created: u.createdAt ? Number(u.createdAt) : 0,
             lastSignIn: u.lastLoginAt ? Number(u.lastLoginAt) : 0 };
  });
  return { ok:true, saConfigured:true, users:users };
}

/* מחיקת משתמש — דורש Service Account. */
function userDelete_(uid){
  uid = String(uid || '');
  if(!uid) return { ok:false, error:'no-uid' };
  var token = saToken_();
  if(!token) return { ok:false, error:'no-sa' };
  var url = 'https://identitytoolkit.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/accounts:delete';
  var resp = UrlFetchApp.fetch(url, { method:'post', contentType:'application/json',
    headers:{ Authorization:'Bearer ' + token }, payload: JSON.stringify({ localId:uid }), muteHttpExceptions:true });
  var d = JSON.parse(resp.getContentText());
  if(resp.getResponseCode() !== 200) return { ok:false, error:(d.error && d.error.message) || 'delete-failed' };
  return { ok:true };
}

/* קביעת סיסמה חדשה למשתמש קיים — דורש Service Account. */
function userSetPassword_(uid, password){
  uid = String(uid || '');
  password = String(password || '');
  if(!uid) return { ok:false, error:'no-uid' };
  if(password.length < 6) return { ok:false, error:'weak-password' };
  var token = saToken_();
  if(!token) return { ok:false, error:'no-sa' };
  return accountsUpdate_(token, { localId:uid, password:password });
}

/* קביעת/עדכון השם (displayName) של משתמש קיים — דורש Service Account.
   שם ריק מוחק את השם הקיים. */
function userSetName_(uid, name){
  uid = String(uid || '');
  name = String(name || '').trim();
  if(!uid) return { ok:false, error:'no-uid' };
  var token = saToken_();
  if(!token) return { ok:false, error:'no-sa' };
  var body = { localId:uid };
  if(name) body.displayName = name; else body.deleteAttribute = ['DISPLAY_NAME'];
  return accountsUpdate_(token, body);
}

/* קריאת עדכון (accounts:update) עם טוקן אדמין — משמשת לסיסמה ולשם. */
function accountsUpdate_(token, body){
  var url = 'https://identitytoolkit.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/accounts:update';
  var resp = UrlFetchApp.fetch(url, { method:'post', contentType:'application/json',
    headers:{ Authorization:'Bearer ' + token },
    payload: JSON.stringify(body), muteHttpExceptions:true });
  var d; try{ d = JSON.parse(resp.getContentText()); }catch(e){ d = {}; }
  if(resp.getResponseCode() !== 200) return { ok:false, error:(d.error && d.error.message) || 'update-failed' };
  return { ok:true };
}

/* מנפיק OAuth access token עבור Service Account (חתימת JWT → החלפה בטוקן).
   מחזיר null אם ה-Service Account אינו מוגדר ב-Script Properties. */
function saToken_(){
  var props = PropertiesService.getScriptProperties();
  var clientEmail = props.getProperty('SA_CLIENT_EMAIL');
  var privateKey  = props.getProperty('SA_PRIVATE_KEY');
  if(!clientEmail || !privateKey) return null;
  privateKey = privateKey.replace(/\\n/g, '\n'); // אם הודבק עם \n מילוליים
  var now = Math.floor(Date.now() / 1000);
  var header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg:'RS256', typ:'JWT' })).replace(/=+$/, '');
  var claim = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/identitytoolkit',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  })).replace(/=+$/, '');
  var signature = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(header + '.' + claim, privateKey)).replace(/=+$/, '');
  var jwt = header + '.' + claim + '.' + signature;
  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method:'post',
    payload:{ grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
    muteHttpExceptions:true });
  try{
    var d = JSON.parse(resp.getContentText());
    return d.access_token || null;
  }catch(e){ return null; }
}
