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

// בעלי המערכת — עוגן הרשאה קבוע. תמיד נחשבים מורשים/מנהלים, גם אם ההגדרות
// ב-Firestore ריקות. ⚠️ חייב להיות זהה ל-OWNER_EMAILS ב-index.html ול-ownerEmails()
// ב-firestore.rules. מיילים באותיות קטנות בלבד.
var OWNER_EMAILS = ['7684252sg@gmail.com', 'sg@taharat.org'];

// גרסת הגשר — מוחזרת ב"בדיקת חיבור" בתוכנה, כדי לדעת בוודאות איזו גרסה *נפרסה בפועל*
// (שמירת הקוד בעורך אינה מספיקה — חייבים לפרוס גרסה חדשה). יש להעלות את התאריך
// בכל שינוי שמוסיף/משנה פעולה בגשר.
var BRIDGE_VERSION = '2026-08-25';

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
    // פעולות ציבוריות (טופס הרישום להורים) — ללא צורך בהתחברות
    var PUBLIC_ACTIONS = { regConfigGet:true, regSubmit:true };
    // אכיפת הרשאה בכל פעולה לא-ציבורית: לא די בטוקן Firebase תקף — המייל חייב
    // להופיע ברשימת המורשים של המערכת (או להיות בעל מערכת). פעולות ניהול משתמשים
    // דורשות הרשאת מנהל (adminGate_ הוא תת-קבוצה של allowedGate_).
    if(!PUBLIC_ACTIONS[req.action]){
      if(USER_ACTIONS[req.action]){
        var gate = adminGate_(req.idToken);
        if(!gate.ok) return json_(out, {ok:false, error:gate.error || 'not-admin'});
      } else {
        var agate = allowedGate_(req.idToken);
        if(!agate.ok) return json_(out, {ok:false, error:agate.error || 'unauthorized'});
      }
    }
    switch(req.action){
      case 'ping':           return json_(out, ping_());
      case 'childFolder':    return json_(out, childFolder_(req.year, req.name, req.edu, req.gan));
      case 'childMove':      return json_(out, childMove_(req.folderId, req.year, req.edu, req.gan));
      case 'chat':           return json_(out, chat_(req.messages, req.system, req.model));
      case 'geocode':        return json_(out, geocode_(req.q, req.city, req.bias));
      case 'walk':           return json_(out, walk_(req.origin, req.dests));
      case 'sendMail':       return json_(out, sendMail_(req.to, req.subject, req.body));
      case 'sendMailBulk':   return json_(out, sendMailBulk_(req.items, req.opts));
      case 'mailDoc':        return json_(out, mailDoc_(req.to, req.subject, req.body, req.fileName, req.mimeType, req.dataB64));
      case 'mailQuota':      return json_(out, mailQuota_());
      case 'msgGateway':     return json_(out, msgGateway_(req.channel, req.items));
      case 'msgGatewayStatus': return json_(out, msgGatewayStatus_());
      case 'regConfigGet':   return json_(out, regConfigGet_());
      case 'regConfigSet':   return json_(out, regConfigSet_(req.config));
      case 'regSubmit':      return json_(out, regSubmit_(req.data, req.files));
      case 'regList':        return json_(out, regList_());
      case 'regRemove':      return json_(out, regRemove_(req.id));
      case 'staffFolder':    return json_(out, staffFolder_(req.edu, req.name));
      case 'list':           return json_(out, list_(req.folderId));
      case 'upload':         return json_(out, upload_(req.folderId, req.name, req.mimeType, req.dataB64));
      case 'backupSave':     return json_(out, backupSave_(req.name, req.dataB64));
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

/* ============================================================
   רישום דיגיטלי — טופס ציבורי להורים (קונפיג, קליטה, רשימה לאישור)
   ============================================================ */
function regFolder_(){ return sub_(root_(), 'רישום דיגיטלי'); }
function putTextFile_(folder, name, content){
  var it = folder.getFilesByName(name);
  while(it.hasNext()){ it.next().setTrashed(true); }
  return folder.createFile(name, content, 'application/json');
}
function getTextFile_(folder, name){
  var it = folder.getFilesByName(name);
  return it.hasNext() ? it.next().getBlob().getDataAsString() : '';
}
/* קונפיג הטופס — נשמר ע"י התוכנה (גנים+סמלים, שנה, פרטי בעלות, מייל התראה) */
function regConfigSet_(config){ putTextFile_(regFolder_(), 'reg-config.json', JSON.stringify(config || {})); return { ok:true }; }
function regConfigGet_(){ var t=getTextFile_(regFolder_(), 'reg-config.json'); var c={}; try{ c=JSON.parse(t||'{}'); }catch(e){} return { ok:true, config:c }; }
/* רשימת הרישומים הממתינים (לתוכנה, לאחר התחברות) */
function regList_(){ var t=getTextFile_(regFolder_(), 'registrations.json'); var a=[]; try{ a=JSON.parse(t||'[]'); }catch(e){} return { ok:true, items:a }; }
function regRemove_(id){
  var f=regFolder_(); var t=getTextFile_(f,'registrations.json'); var a=[]; try{ a=JSON.parse(t||'[]'); }catch(e){}
  a = a.filter(function(x){ return x.id !== id; });
  putTextFile_(f, 'registrations.json', JSON.stringify(a)); return { ok:true };
}
/* קליטת רישום מהטופס הציבורי — קבצים לדרייב, שמירה כ"ממתין", התראה במייל */
function regSubmit_(data, files){
  data = data || {};
  var f = regFolder_();
  var yearF = sub_(f, String(data.year || 'ללא שנה'));
  var nm = (data.childName || 'ללא שם') + (data.childTz ? (' · ' + data.childTz) : '');
  var subF = sub_(yearF, nm);
  var links = [];
  var formPdfBlob = null;   // מסמך הרישום הממותג (לצירוף למייל)
  (files || []).forEach(function(file){
    try{
      var isForm = (file.kind === 'טופס רישום');
      var fname = isForm ? ('טופס רישום · ' + nm + '.pdf') : ((file.kind || 'מסמך') + ' · ' + nm);
      var blob = Utilities.newBlob(Utilities.base64Decode(file.dataB64), file.mimeType || 'application/octet-stream', fname);
      var created = subF.createFile(blob);
      if(isForm){ formPdfBlob = created.getBlob(); }
      links.push({ kind:file.kind || 'מסמך', name:created.getName(), id:created.getId(), link:created.getUrl() });
    }catch(e){}
  });
  if(data.signature){
    try{
      var b64 = String(data.signature).split(',')[1] || '';
      var sBlob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', ('חתימה · ' + nm + '.png'));
      var sFile = subF.createFile(sBlob);
      links.push({ kind:'חתימה', name:sFile.getName(), id:sFile.getId(), link:sFile.getUrl() });
    }catch(e){}
  }
  delete data.signature;   // לא לשמור את ה-data-url הגדול ב-JSON (נשמר כקובץ)
  var rec = { id: Utilities.getUuid(), status:'pending', at:new Date().toISOString(),
              data: data, folderId: subF.getId(), folderLink: subF.getUrl(), files: links };
  var recsT = getTextFile_(f, 'registrations.json'); var recs=[]; try{ recs=JSON.parse(recsT||'[]'); }catch(e){}
  recs.unshift(rec);
  putTextFile_(f, 'registrations.json', JSON.stringify(recs));
  try{
    var cfg = {}; try{ cfg = JSON.parse(getTextFile_(f,'reg-config.json')||'{}'); }catch(e){}
    if(cfg.notifyEmail){
      var body = 'התקבל רישום דיגיטלי חדש:\n\n'
        + 'תלמיד/ה: ' + (data.childName||'') + ' · ת"ז: ' + (data.childTz||'') + '\n'
        + 'גן מבוקש: ' + (data.ganName||'') + ' (סמל ' + (data.ganSymbol||'') + ')\n'
        + 'הורה: ' + (data.parentName||'') + ' · נייד אם: ' + (data.momMobile||'') + ' · נייד אב: ' + (data.dadMobile||'') + '\n'
        + 'כתובת: ' + (data.address||'') + '\n\n'
        + 'תיקיית המסמכים: ' + subF.getUrl() + '\n\n'
        + (formPdfBlob ? 'מצורף מסמך הרישום המלא (PDF).\n\n' : '')
        + 'הרישום ממתין לאישור בתוכנה (רישומים דיגיטליים).';
      var mailOpts = { name: (cfg.ownership && cfg.ownership.name) || 'רישום דיגיטלי' };
      if(formPdfBlob){ mailOpts.attachments = [formPdfBlob]; }
      MailApp.sendEmail(String(cfg.notifyEmail), 'רישום דיגיטלי חדש · ' + (data.childName||''), body, mailOpts);
    }
  }catch(e){}
  /* אישור אוטומטי לנרשם (סעיף 7) — נשלח לכתובת שההורה הזין, לפי התבנית
     שנקבעה בתוכנה (כלים ושירותים → רישום דיגיטלי → מייל אישור לנרשם). */
  try{
    var cfg2 = {}; try{ cfg2 = JSON.parse(getTextFile_(f,'reg-config.json')||'{}'); }catch(e){}
    var am = cfg2.applicantMail || {};
    if(am.enabled && data.email){
      var own = cfg2.ownership || {};
      var vars = {
        'שם הילדה': data.childName || '',
        'תז': data.childTz || '',
        'גן': data.ganName || '',
        'סמל גן': data.ganSymbol || '',
        'שם ההורה': data.parentName || '',
        'כתובת': data.address || '',
        'שנה': data.year || cfg2.year || '',
        'שם המוסד': own.institutionName || own.name || '',
        'תאריך': Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'Asia/Jerusalem', 'dd/MM/yyyy')
      };
      var subj = msgMerge_(am.subject || 'אישור קבלת רישום · {{שם הילדה}}', vars);
      var bodyA = msgMerge_(am.body || 'שלום {{שם ההורה}},\n\nרישומה של {{שם הילדה}} התקבל אצלנו בהצלחה.\n\nבברכה,\n{{שם המוסד}}', vars);
      var optsA = { name: own.name || 'רישום דיגיטלי' };
      if(am.replyTo) optsA.replyTo = String(am.replyTo);
      if(am.attachForm && formPdfBlob) optsA.attachments = [formPdfBlob];
      MailApp.sendEmail(String(data.email), subj, bodyA, optsA);
    }
  }catch(e){}
  return { ok:true };
}
/* מיזוג {{שדה}} בתוך תבנית טקסט */
function msgMerge_(tpl, vars){
  var t = String(tpl || '');
  Object.keys(vars || {}).forEach(function(k){
    t = t.split('{{' + k + '}}').join(String(vars[k] == null ? '' : vars[k]));
  });
  return t.replace(/\{\{[^}]*\}\}/g, '');   // שדות שלא הוגדרו — מנוקים
}

/* שליחת מייל מהשרת (מחשבון הגשר) — לפניות/הצעות שמגיעות מהמערכת */
function sendMail_(to, subject, body){
  if(!to) return { ok:false, error:'no-recipient' };
  MailApp.sendEmail(String(to), String(subject || '(ללא נושא)'), String(body || ''));
  return { ok:true };
}

/* שליחת מסמך (PDF) במייל עם קובץ מצורף — "שיתוף מסמך" בתוכנה שולח ישירות למייל,
   במקום להוריד את הקובץ ולצרף אותו ידנית. to: כתובת אחת או כמה מופרדות בפסיק. */
function mailDoc_(to, subject, body, fileName, mimeType, dataB64){
  var list = String(to || '').split(/[,;\s]+/).filter(function(x){ return x; });
  if(!list.length) return { ok:false, error:'no-recipient' };
  var opts = {};
  if(dataB64){
    opts.attachments = [ Utilities.newBlob(Utilities.base64Decode(String(dataB64)),
                          String(mimeType || 'application/pdf'), String(fileName || 'document.pdf')) ];
  }
  MailApp.sendEmail(list.join(','), String(subject || '(ללא נושא)'), String(body || ''), opts);
  return { ok:true, sent:list.length };
}

/* מכסת המיילים שנותרה היום בחשבון הגשר (Gmail רגיל ~100 · Workspace ~1500) */
function mailQuota_(){
  var left = 0;
  try{ left = MailApp.getRemainingDailyQuota(); }catch(e){ left = -1; }
  return { ok:true, remaining:left };
}
/* ============================================================
   שליחת מיילים מרוכזת (סעיפים 8-9) — כל נמען מקבל הודעה ממוזגת משלו.
   items: [{to, subject, body}] · opts: {fromName, replyTo, html}
   השליחה נעצרת בעדינות כשנגמרת המכסה היומית, ומדווחת מה נשלח.
   ============================================================ */
function sendMailBulk_(items, opts){
  items = items || []; opts = opts || {};
  var quota = 0; try{ quota = MailApp.getRemainingDailyQuota(); }catch(e){ quota = items.length; }
  var sent = 0, failed = 0, errors = [], stopped = false;
  for(var i = 0; i < items.length; i++){
    var it = items[i] || {};
    if(!it.to){ failed++; errors.push({ to:'', error:'no-recipient' }); continue; }
    if(quota <= 0){ stopped = true; break; }
    try{
      var o = { name: opts.fromName || '' };
      if(!o.name) delete o.name;
      if(opts.replyTo) o.replyTo = String(opts.replyTo);
      if(opts.html) o.htmlBody = String(it.body || '');
      MailApp.sendEmail(String(it.to), String(it.subject || '(ללא נושא)'), String(it.body || ''), o);
      sent++; quota--;
    }catch(e){ failed++; errors.push({ to:String(it.to), error:String(e && e.message || e) }); }
  }
  return { ok:true, sent:sent, failed:failed, stopped:stopped,
           remaining:(items.length - sent - failed), errors:errors.slice(0, 25),
           quotaLeft:quota };
}

/* ============================================================
   שער הודעות חיצוני (סעיפים 10-11) — SMS · וואטסאפ · הודעה קולית.
   שירותים אלה אינם חינמיים ואינם חלק מ-Google, ולכן הם עוברים דרך ספק
   חיצוני שבוחרים (למשל 019 / InforU / Cellact / Twilio). ההגדרה נעשית
   פעם אחת ב-Script Properties של הגשר — כדי שהמפתחות לא יישמרו בתוכנה:

     MSG_SMS_URL / MSG_WHATSAPP_URL / MSG_VOICE_URL   — כתובת ה-API של הספק
     MSG_SMS_BODY / MSG_WHATSAPP_BODY / MSG_VOICE_BODY — תבנית גוף הבקשה (JSON),
        עם {{to}} למספר, {{text}} לתוכן ו-{{from}} לשם/מספר השולח
     MSG_SMS_HEADERS / …                              — כותרות (JSON), למשל אימות
     MSG_SMS_FROM / …                                 — שם או מספר השולח
     MSG_SMS_METHOD / …                               — ברירת מחדל POST

   אין ספק מוגדר → מוחזר 'no-gateway', והתוכנה נופלת אוטומטית למצב ידני
   (פתיחת וואטסאפ / SMS / חיוג לכל נמען בלחיצה).
   ============================================================ */
function msgChannelKey_(channel){
  var c = String(channel || '').toLowerCase();
  if(c === 'sms') return 'SMS';
  if(c === 'whatsapp' || c === 'wa') return 'WHATSAPP';
  if(c === 'voice' || c === 'call') return 'VOICE';
  return '';
}
function msgGatewayStatus_(){
  var props = PropertiesService.getScriptProperties();
  var out = {};
  ['SMS','WHATSAPP','VOICE'].forEach(function(k){
    out[k.toLowerCase()] = !!props.getProperty('MSG_' + k + '_URL');
  });
  return { ok:true, channels:out };
}
function msgGateway_(channel, items){
  var key = msgChannelKey_(channel);
  if(!key) return { ok:false, error:'bad-channel' };
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('MSG_' + key + '_URL');
  if(!url) return { ok:false, error:'no-gateway' };
  var bodyTpl = props.getProperty('MSG_' + key + '_BODY') || '{"to":"{{to}}","text":"{{text}}"}';
  var method  = (props.getProperty('MSG_' + key + '_METHOD') || 'post').toLowerCase();
  var from    = props.getProperty('MSG_' + key + '_FROM') || '';
  var headers = {};
  try{ headers = JSON.parse(props.getProperty('MSG_' + key + '_HEADERS') || '{}'); }catch(e){ headers = {}; }

  var sent = 0, failed = 0, errors = [];
  (items || []).forEach(function(it){
    it = it || {};
    if(!it.to){ failed++; errors.push({ to:'', error:'no-recipient' }); return; }
    try{
      var payload = bodyTpl
        .split('{{to}}').join(msgJsonEsc_(it.to))
        .split('{{text}}').join(msgJsonEsc_(it.text || ''))
        .split('{{from}}').join(msgJsonEsc_(from));
      var res = UrlFetchApp.fetch(url, {
        method: method, contentType:'application/json', headers: headers,
        payload: payload, muteHttpExceptions: true
      });
      var code = res.getResponseCode();
      if(code >= 200 && code < 300) sent++;
      else { failed++; errors.push({ to:String(it.to), error:'http-' + code + ' ' + String(res.getContentText()||'').slice(0,120) }); }
    }catch(e){ failed++; errors.push({ to:String(it.to), error:String(e && e.message || e) }); }
  });
  return { ok:true, sent:sent, failed:failed, errors:errors.slice(0, 25) };
}
/* בריחה בטוחה של ערך לתוך תבנית JSON */
function msgJsonEsc_(v){
  var s = JSON.stringify(String(v == null ? '' : v));
  return s.slice(1, -1);
}

/* ============================================================
   עוזר AI — הבקשה עוברת דרך הגשר כדי שמפתח ה-API יישאר מוסתר.
   נתמכים שני ספקים:
     • Google Gemini (חלופה חינמית) — מפתח חינם מ-aistudio.google.com/apikey,
       נשמר ב-Script Property בשם GEMINI_API_KEY. אין צורך בחיוב.
     • Anthropic Claude (בתשלום) — מפתח מ-console.anthropic.com,
       נשמר ב-Script Property בשם ANTHROPIC_API_KEY.
   בחירת הספק: לפי המודל המבוקש אם המפתח שלו קיים; אחרת לפי המפתח הזמין
   (Gemini החינמי מקבל עדיפות). כך מספיק להגדיר GEMINI_API_KEY כדי שהעוזר יעבוד.
   ============================================================ */
function chat_(messages, system, model){
  var props = PropertiesService.getScriptProperties();
  var geminiKey    = props.getProperty('GEMINI_API_KEY');
  var anthropicKey = props.getProperty('ANTHROPIC_API_KEY');
  model = String(model || '');
  var wantsGemini    = /^gemini/i.test(model);
  var wantsAnthropic = /^claude/i.test(model);
  var useGemini;
  if(wantsGemini && geminiKey)          useGemini = true;
  else if(wantsAnthropic && anthropicKey) useGemini = false;
  else if(geminiKey)                    useGemini = true;   // חלופה חינמית — ברירת מחדל
  else if(anthropicKey)                 useGemini = false;
  else return { ok:false, error:'no-ai-key' };              // עדיין לא הוגדר מפתח
  return useGemini ? chatGemini_(messages, system, model, geminiKey)
                   : chatAnthropic_(messages, system, model, anthropicKey);
}

/* Anthropic Claude — Messages API */
function chatAnthropic_(messages, system, model, key){
  var payload = {
    model: /^claude/i.test(model) ? model : 'claude-haiku-4-5',
    max_tokens: 3000,
    system: String(system || ''),
    messages: (messages || []).slice(-24)             // שומר את 24 ההודעות האחרונות (כולל תוצאות כלים)
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

/* Google Gemini — generateContent (מדרגה חינמית).
   Gemini משתמש בתפקידים "user"/"model" (assistant → model) ובהוראת מערכת נפרדת. */
function chatGemini_(messages, system, model, key){
  var DEFAULT_GEMINI = 'gemini-3.6-flash';   // מודל ה-Flash הנוכחי (חינם)
  // מזהים ישנים שהוצאו משימוש — ממופים אוטומטית לנוכחי, גם אם נשמרו בהגדרות
  var OLD_GEMINI = { 'gemini-1.5-flash':1, 'gemini-1.5-pro':1, 'gemini-2.0-flash':1,
                     'gemini-2.0-flash-exp':1, 'gemini-2.5-flash':1, 'gemini-2.5-pro':1 };
  var gm = (/^gemini/i.test(model) && !OLD_GEMINI[model]) ? model : DEFAULT_GEMINI;
  var contents = (messages || []).slice(-24).map(function(m){
    return { role: (m.role === 'assistant' ? 'model' : 'user'),
             parts: [{ text: String((m && m.content) || '') }] };
  });
  var payload = { contents: contents, generationConfig: { maxOutputTokens: 3000 } };
  if(system) payload.system_instruction = { parts: [{ text: String(system) }] };
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
            encodeURIComponent(gm) + ':generateContent?key=' + encodeURIComponent(key);
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var data; try{ data = JSON.parse(res.getContentText() || '{}'); }catch(e){ data = {}; }
  if(code >= 400) return { ok:false, error: (data.error && data.error.message) || ('http-' + code) };
  var cand = (data.candidates && data.candidates[0]) || {};
  var text = ((cand.content && cand.content.parts) || [])
               .map(function(p){ return p.text || ''; }).join('\n').replace(/^\n+|\n+$/g,'');
  if(!text && cand.finishReason && cand.finishReason !== 'STOP') text = '(אין תשובה — ' + cand.finishReason + ')';
  return { ok:true, text: text };
}

/* ============================================================
   גאוקוד מדויק דרך Google (משדרג דיוק) — הבקשה עוברת בגשר כדי שמפתח
   ה-API יישאר מוסתר. אם המפתח לא הוגדר → מוחזר 'no-geo-key', והאפליקציה
   נופלת חזרה ל-OpenStreetMap (חינמי) אוטומטית.
   הגדרה חד-פעמית: Project Settings → Script Properties → הוסף מפתח בשם
   GOOGLE_MAPS_API_KEY עם מפתח מ-console.cloud.google.com (Geocoding API).
   ============================================================ */
function geocode_(q, city, bias){
  var key = PropertiesService.getScriptProperties().getProperty('GOOGLE_MAPS_API_KEY');
  if(!key) return { ok:false, error:'no-geo-key' };      // אין מפתח → נפילה ל-OSM
  q = String(q || '').trim();
  if(!q) return { ok:false, error:'geo-not-found' };
  city = String(city || '').trim();
  // 1) נעילה לעיר (components=locality) — מבטיחה שכל תוצאה תהיה בעיר הנבחרת,
  //    יחד עם הטיה (bounds) שבוחרת את ההתאמה המדויקת בתוך העיר.
  var r = geocodeGoogleCall_(q, city, bias, key);
  // 2) נפילה אם שם העיר לא זוהה (ZERO_RESULTS) — בלי נעילה אך עם הטיה, כדי
  //    שעדיין נעדיף את אזור העיר (ולא ניפול לעיר אחרת).
  if(r.zero && city){ r = geocodeGoogleCall_(q, '', bias, key); }
  return r.out;
}
function geocodeGoogleCall_(q, city, bias, key){
  var url = 'https://maps.googleapis.com/maps/api/geocode/json?region=il&language=he&address='
            + encodeURIComponent(q) + '&key=' + encodeURIComponent(key);
  // נעילה לעיר בלבד, בלי country:IL — יישובי יהודה ושומרון מסווגים אצל Google
  // מחוץ ל-IL, וסינון מדינה מחזיר ZERO_RESULTS לכל כתובת בהם.
  if(city) url += '&components=' + encodeURIComponent('locality:' + city);
  if(bias && bias.lat != null && bias.lng != null){
    var dLat = 0.06, dLng = 0.07;   // ~6-8 ק"מ סביב מרכז העיר
    var sw = (bias.lat - dLat) + ',' + (bias.lng - dLng);
    var ne = (bias.lat + dLat) + ',' + (bias.lng + dLng);
    url += '&bounds=' + encodeURIComponent(sw + '|' + ne);
  }
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions:true });
  var data; try{ data = JSON.parse(res.getContentText() || '{}'); }catch(e){ data = {}; }
  if(data.status === 'OK' && data.results && data.results.length){
    var r0 = data.results[0], loc = r0.geometry.location;
    return { out:{ ok:true, lat:loc.lat, lng:loc.lng, formatted:r0.formatted_address,
             locType:(r0.geometry && r0.geometry.location_type) || '', partial:!!r0.partial_match } };
  }
  if(data.status === 'ZERO_RESULTS') return { zero:true, out:{ ok:false, error:'geo-not-found' } };
  return { out:{ ok:false, error:(data.error_message || data.status || 'geo-failed') } };
}

/* מרחק/זמן הליכה אמיתי דרך Google Distance Matrix (מצב הליכה).
   origin = {lat,lng}; dests = [{lat,lng},...] (עד 25). מחזיר results[] מקביל
   ל-dests, כל אחד {m, sec} או null. דורש GOOGLE_MAPS_API_KEY + Distance Matrix API. */
function walk_(origin, dests){
  var key = PropertiesService.getScriptProperties().getProperty('GOOGLE_MAPS_API_KEY');
  if(!key) return { ok:false, error:'no-geo-key' };
  if(!origin || origin.lat==null || !dests || !dests.length) return { ok:false, error:'bad-args' };
  var o = origin.lat + ',' + origin.lng;
  var d = dests.map(function(x){ return x.lat + ',' + x.lng; }).join('|');
  var url = 'https://maps.googleapis.com/maps/api/distancematrix/json?mode=walking&language=he&origins='
            + encodeURIComponent(o) + '&destinations=' + encodeURIComponent(d) + '&key=' + encodeURIComponent(key);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions:true });
  var data; try{ data = JSON.parse(res.getContentText() || '{}'); }catch(e){ data = {}; }
  if(data.status !== 'OK') return { ok:false, error:(data.error_message || data.status || 'walk-failed') };
  var els = (data.rows && data.rows[0] && data.rows[0].elements) || [];
  var results = els.map(function(el){
    if(!el || el.status !== 'OK') return null;
    return { m: (el.distance && el.distance.value), sec: (el.duration && el.duration.value) };
  });
  return { ok:true, results:results };
}

function json_(out, obj){ out.setContent(JSON.stringify(obj)); return out; }

/* ⚠️ הוצא משימוש כשער הרשאה. בודק רק שהטוקן שייך למשתמש Firebase כלשהו — לא
   שהמשתמש מורשה במערכת. אין להשתמש בו לאימות פעולות; השתמש ב-allowedGate_/adminGate_. */
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
  return { ok:true, rootId:r.getId(), rootLink:r.getUrl(), version:BRIDGE_VERSION };
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

/* ===================== גיבוי אוטומטי ל-Drive ===================== */
var BACKUP_FOLDER_NAME = 'גיבויים';
var BACKUP_KEEP = 30; // כמה גיבויים אחרונים לשמור (השאר נמחקים אוטומטית)
function backupFolder_(){ return sub_(root_(), BACKUP_FOLDER_NAME); }
function backupPrune_(folder){
  var arr = [], it = folder.getFiles();
  while(it.hasNext()){ var f = it.next(); arr.push({ f:f, t:f.getDateCreated().getTime() }); }
  arr.sort(function(a,b){ return b.t - a.t; }); // חדש → ישן
  for(var i = BACKUP_KEEP; i < arr.length; i++){ try{ arr[i].f.setTrashed(true); }catch(e){} }
}
/* גיבוי שנשלח מהתוכנה (client-side) — JSON של כל הנתונים, מקודד base64 */
function backupSave_(name, dataB64){
  var folder = backupFolder_();
  var blob = Utilities.newBlob(Utilities.base64Decode(dataB64), 'application/json',
                               name || ('backup-' + new Date().toISOString().slice(0,10) + '.json'));
  var file = folder.createFile(blob);
  backupPrune_(folder);
  return { ok:true, fileId:file.getId(), link:file.getUrl() };
}
/* גיבוי שרתי עצמאי — קורא את כל אוסף app מ-Firestore ושומר ל-Drive.
   מיועד לטריגר יומי (Triggers → backupFirestore_ → Time-driven → Day timer).
   דורש הרשאת OAuth "datastore" לחשבון המריץ (ראה SETUP.md — "גיבוי אוטומטי"). */
function backupFirestore_(){
  var token;
  try{ token = ScriptApp.getOAuthToken(); }catch(e){ return { ok:false, error:'no-token' }; }
  var base = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents/app';
  var docs = [], pageToken = '';
  do{
    var url = base + '?pageSize=300' + (pageToken ? ('&pageToken=' + encodeURIComponent(pageToken)) : '');
    var resp = UrlFetchApp.fetch(url, { headers:{ Authorization:'Bearer ' + token }, muteHttpExceptions:true });
    if(resp.getResponseCode() !== 200) return { ok:false, error:'firestore ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0,180) };
    var j = JSON.parse(resp.getContentText());
    (j.documents || []).forEach(function(d){ docs.push(d); });
    pageToken = j.nextPageToken || '';
  } while(pageToken);
  var payload = JSON.stringify({ _type:'firestore-raw-backup', at:new Date().toISOString(), documents:docs });
  var folder = backupFolder_();
  var fname = 'firestore-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.json';
  var file = folder.createFile(fname, payload, 'application/json');
  backupPrune_(folder);
  return { ok:true, count:docs.length, link:file.getUrl() };
}
/* עוטף ציבורי לטריגר היומי — בחר את הפונקציה הזו ברשימת הטריגרים
   (פונקציות שמסתיימות ב-"_" אינן מופיעות ברשימה). */
function backupFirestoreDaily(){ return backupFirestore_(); }
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

/* האם מייל (lower-case) הוא בעל מערכת (עוגן ההרשאה הקבוע). */
function isOwnerEmail_(email){
  email = String(email || '').toLowerCase();
  return OWNER_EMAILS.map(function(x){ return String(x).toLowerCase(); }).indexOf(email) >= 0;
}

/* קורא את מסמך app/meta מ-Firestore ומחזיר את ה-JSON (או null).
   מעדיף טוקן Service Account (פריבילגי — חסין App Check: כשמדליקים אכיפה על
   Firestore, בקשות REST עם טוקן משתמש נחסמות, אך טוקן SA עוקף זאת). אם SA אינו
   מוגדר — נופל לטוקן המשתמש (עובד כל עוד אכיפת App Check על Firestore כבויה).
   כך המעבר לאכיפה אינו שובר את הגשר, ובלי SA הכל ממשיך לעבוד כמו קודם. */
function metaDocJson_(idToken){
  var url = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID +
            '/databases/(default)/documents/app/meta';
  var sa = saToken_();
  var auth = sa ? ('Bearer ' + sa) : (idToken ? ('Bearer ' + idToken) : '');
  if(!auth) return null;
  try{
    var resp = UrlFetchApp.fetch(url, { headers:{ Authorization: auth }, muteHttpExceptions:true });
    if(resp.getResponseCode() !== 200) return null;
    return JSON.parse(resp.getContentText());
  }catch(e){ return null; }
}

/* אימות שהקורא הוא מנהל מערכת: בעל מערכת תמיד; אחרת קורא את app/meta מ-Firestore
   ובודק את settings.admins. רשימה ריקה = רק בעלים (אין יותר "כל מחובר מנהל"
   במצב אתחול) — תואם ל-isAdmin() באפליקציה. */
function adminGate_(idToken){
  var email = tokenEmail_(idToken);
  if(!email) return { ok:false, error:'unauthorized' };
  if(isOwnerEmail_(email)) return { ok:true };
  var meta = metaDocJson_(idToken);
  if(!meta) return { ok:false, error:'admin-check-failed' };
  var admins = [];
  try{
    var vals = meta.fields.settings.mapValue.fields.admins.arrayValue.values || [];
    admins = vals.map(function(v){ return String(v.stringValue || '').toLowerCase(); }).filter(String);
  }catch(e){ admins = []; }
  if(admins.indexOf(email) >= 0) return { ok:true };
  return { ok:false, error:'not-admin' };
}

/* אימות שהקורא מורשה להשתמש במערכת: בעל מערכת תמיד; אחרת המייל חייב להופיע
   ברשימת המורשים ב-app/meta (admins ∪ allowedEmails ∪ מפתחות userActivity) —
   מקביל ל-emailAllowed()/knownEmails() באפליקציה. חוסם כל חשבון Google אקראי
   שקיבל טוקן תקף אך אינו מורשה במערכת. */
function allowedGate_(idToken){
  var email = tokenEmail_(idToken);
  if(!email) return { ok:false, error:'unauthorized' };
  if(isOwnerEmail_(email)) return { ok:true, email:email };
  var meta = metaDocJson_(idToken);
  if(!meta) return { ok:false, error:'access-check-failed' };
  var s = {};
  try{ s = meta.fields.settings.mapValue.fields; }catch(e){ s = {}; }
  var known = {};
  ['admins','allowedEmails'].forEach(function(key){
    try{
      (s[key].arrayValue.values || []).forEach(function(v){
        var e = String(v.stringValue || '').toLowerCase(); if(e) known[e] = true;
      });
    }catch(e){}
  });
  try{
    var ua = s.userActivity.mapValue.fields || {};
    Object.keys(ua).forEach(function(k){ known[String(k).toLowerCase()] = true; });
  }catch(e){}
  if(known[email]) return { ok:true, email:email };
  return { ok:false, error:'not-allowed' };
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
    // identitytoolkit — לניהול משתמשים; datastore — לקריאת app/meta מ-Firestore
    // בטוקן פריבילגי (חסין App Check כשמדליקים אכיפה). שני ה-scopes מופרדים ברווח.
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore',
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
