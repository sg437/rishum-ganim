/* ============================================================================
   בדיקה ללא רשת — המרכזי מותקן כאפליקציה (PWA)
   ----------------------------------------------------------------------------
   מוודאת שכל מה שהדפדפן צריך כדי להציע התקנה של management.html קיים ועקבי:
     • <link rel="manifest"> ל-manifest-central.webmanifest, אייקון iOS ותגיות
       apple-mobile-web-app / mobile-web-app-capable בראש הדף.
     • ה-manifest תקין (JSON), עם מזהה ו-start_url משלו (שונים מתוכנת הערים),
       start_url בתוך ה-scope, display standalone, ואייקוני 192/512 + maskable
       שקיימים בדיסק וגודלם נכון (לפי כותרת ה-PNG).
     • management.html רושם את sw.js, ומאזין ל-beforeinstallprompt / appinstalled.
     • ה-CSP של המרכזי מתיר worker-src 'self' (רישום ה-service worker).
     • _headers מרענן גם את manifest-central.webmanifest.
   הרצה:  node tests/central-pwa.test.cjs
   ============================================================================ */
const fs=require('fs'), path=require('path'), assert=require('assert');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const html=read('management.html');
const head=html.slice(0, html.indexOf('</head>'));

/* --- ראש הדף --- */
assert(/<link rel="manifest" href="manifest-central\.webmanifest">/.test(head), 'חסר <link rel="manifest"> למרכזי בראש הדף');
assert(/<link rel="apple-touch-icon" href="central-apple-touch-icon\.png">/.test(head), 'חסר apple-touch-icon למרכזי');
assert(/<meta name="apple-mobile-web-app-capable" content="yes">/.test(head), 'חסר apple-mobile-web-app-capable');
assert(/<meta name="mobile-web-app-capable" content="yes">/.test(head), 'חסר mobile-web-app-capable');
assert(/<meta name="apple-mobile-web-app-title" content="[^"]+">/.test(head), 'חסר apple-mobile-web-app-title');
assert(/<meta name="theme-color" content="#[0-9a-f]{6}">/i.test(head), 'חסר theme-color');
const csp=(head.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)||[])[1]||'';
assert(/worker-src 'self'/.test(csp), 'ה-CSP של המרכזי חייב להתיר worker-src \'self\' לרישום ה-service worker');

/* --- ה-manifest --- */
const mf=JSON.parse(read('manifest-central.webmanifest'));
const city=JSON.parse(read('manifest.webmanifest'));
assert.notStrictEqual(mf.id, city.id, 'למרכזי חייב להיות id שונה מתוכנת הערים (אחרת הדפדפן חושב שהיא כבר מותקנת)');
assert.notStrictEqual(mf.start_url, city.start_url, 'start_url של המרכזי חייב להיות שונה משל תוכנת הערים');
assert(/management\.html$/.test(mf.start_url), 'start_url של המרכזי חייב להצביע על management.html');
const norm=u=>u.replace(/^\.\//,'');
assert(norm(mf.start_url).startsWith(norm(mf.scope)), 'start_url חייב להיות בתוך ה-scope');
assert.strictEqual(mf.display, 'standalone');
assert.strictEqual(mf.lang, 'he'); assert.strictEqual(mf.dir, 'rtl');
assert(mf.name && mf.short_name, 'חסרים name / short_name');
assert(mf.short_name.length<=12, 'short_name ארוך מדי לאייקון במסך הבית');

/* גודל PNG לפי הכותרת (IHDR) — בלי ספריות */
function pngSize(f){ const b=fs.readFileSync(path.join(ROOT,f)); assert.strictEqual(b.toString('hex',0,8),'89504e470d0a1a0a',f+' אינו PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
const sizes=new Set(); let maskable=false;
for(const ic of mf.icons){
  assert(fs.existsSync(path.join(ROOT,ic.src)), 'אייקון חסר בדיסק: '+ic.src);
  const [w,h]=pngSize(ic.src); assert.strictEqual(w+'x'+h, ic.sizes, ic.src+': הגודל בפועל '+w+'x'+h+' שונה מהמוצהר '+ic.sizes);
  assert.strictEqual(ic.type,'image/png'); sizes.add(ic.sizes); if(ic.purpose==='maskable') maskable=true;
}
assert(sizes.has('192x192') && sizes.has('512x512'), 'נדרשים אייקונים 192 ו-512 להתקנה באנדרואיד (WebAPK)');
assert(maskable, 'נדרש אייקון maskable');
assert(!mf.icons.some(ic=>/^icon-(192|512)\.png$/.test(ic.src)), 'המרכזי חייב אייקונים משלו, לא של תוכנת הערים');
const [aw,ah]=pngSize('central-apple-touch-icon.png'); assert(aw===ah && aw>=180, 'apple-touch-icon של המרכזי חייב להיות ריבועי, 180 ומעלה');

/* --- הקוד --- */
assert(/navigator\.serviceWorker\.register\('sw\.js'\)/.test(html), 'management.html אינו רושם את sw.js');
assert(/addEventListener\('beforeinstallprompt'/.test(html), 'חסר מאזין beforeinstallprompt');
assert(/addEventListener\('appinstalled'/.test(html), 'חסר מאזין appinstalled');
assert(/window\.__hqInstall=/.test(html), 'חסר מודול ההתקנה __hqInstall');
assert(/\['install','התקנה בטלפון'/.test(html), 'חסרה לשונית "התקנה בטלפון" בהגדרות');
assert(/class="hq-install-open"/.test(html), 'חסר כפתור ההתקנה בתחתית התפריט');
assert(fs.existsSync(path.join(ROOT,'sw.js')), 'sw.js חסר');
assert(/manifest-central\.webmanifest\n\s+Cache-Control: no-cache/.test(read('_headers')), '_headers: ה-manifest של המרכזי חייב no-cache');

console.log('✅ central-pwa: המרכזי מוכן להתקנה כאפליקציה — manifest, אייקונים, service worker ולשונית ההתקנה במקומם.');
