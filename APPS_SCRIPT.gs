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

// שם תיקיית האב שתיווצר ב-Drive (אפשר לשנות לפי הצורך).
var ROOT_FOLDER_NAME = 'מסמכי רישום תלמידות (מהמערכת)';

function doPost(e){
  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try{
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if(!verifyToken_(req.idToken)) return json_(out, {ok:false, error:'unauthorized'});
    switch(req.action){
      case 'ping':        return json_(out, ping_());
      case 'childFolder': return json_(out, childFolder_(req.year, req.name));
      case 'list':        return json_(out, list_(req.folderId));
      case 'upload':      return json_(out, upload_(req.folderId, req.name, req.mimeType, req.dataB64));
      case 'copy':        return json_(out, copy_(req.fileId, req.folderId, req.name));
      case 'download':    return json_(out, download_(req.fileId));
      case 'share':       return json_(out, share_(req.email, req.role));
      default:            return json_(out, {ok:false, error:'unknown-action'});
    }
  }catch(err){
    return json_(out, {ok:false, error:String(err)});
  }
}

function doGet(e){ return ContentService.createTextOutput('OK'); }

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
function childFolder_(year, name){
  var r = root_();
  var y = sub_(r, String(year || 'ללא שנה'));
  var c = sub_(y, String(name || 'ללא שם'));
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
