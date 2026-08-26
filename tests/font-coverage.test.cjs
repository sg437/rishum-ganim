/* ============================================================================
   בדיקת כיסוי הגופן של העיצוב החדש (Playwright + Chromium)
   ----------------------------------------------------------------------------
   הטענה שנבדקת: כשמעבדת העיצוב דלוקה, *כל* אלמנט בכל מסך מקבל את גופני
   העיצוב — Assistant לגוף ו-Heebo לכותרות ולמספרים — ואף אחד לא נופל לגופן
   ברירת המחדל של הדפדפן.

   למה זו בדיקה ולא הסתמכות על העין: הפירצה הקודמת לא נראית בצילום מסך אצל
   מפתח שיש לו את הגופנים מותקנים במכשיר. היא נראית רק אצל מי שאין לו — כלומר
   אצל רוב המשתמשים. הבדיקה רצה בדפדפן נקי בלי גופנים מותקנים, ולכן היא רואה
   בדיוק את מה שהם רואים.

   ארבעה דברים נבדקים:
     1. שישה @font-face נטענים, וקובצי הגופן באמת מגיעים (200) ונטענים.
     2. אף אלמנט גלוי — בכל 15 המסכים, בשני המצבים ובשני הרוחבים — אינו
        מחוץ ל-Assistant/Heebo.
     3. רכיבי הטופס (input · select · option · textarea · button) בפרט —
        אלה שאינם יורשים font-family, וששם נפתחה הפירצה מלכתחילה.
     4. כשהמעבדה כבויה: אין מחלקה, אין בקשת CSS ואין בקשת גופן. אפס השפעה.

   הרצה:  NODE_PATH=$(npm root) node tests/font-coverage.test.cjs
   ============================================================================ */

const fs=require('fs'), path=require('path');
let chromium;
try{ ({chromium}=require('playwright')); }
catch(e){
  console.log('⏭️  דילוג: הבדיקה דורשת Playwright (בדיקה אופציונלית, לא נדרשת לשימוש בתוכנה).');
  console.log('    הרצה:   NODE_PATH=$(npm root) node tests/font-coverage.test.cjs   [PW_CHROME=/path/to/chrome]');
  process.exit(0);
}

const ROOT=path.join(__dirname,'..');
const PORT=8732;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
            '.js':'text/javascript; charset=utf-8','.woff2':'font/woff2'};
const server=require('http').createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html';
  const f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)){ res.writeHead(403); return res.end('no'); }
  let body; try{ body=fs.readFileSync(f); }catch(e){ res.writeHead(404); return res.end('nf'); }
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});
  res.end(body);
});

/* הסריקה עצמה — רצה בתוך הדפדפן. נספרים רק אלמנטים שבאמת על המסך
   (getClientRects), כדי שמסכים מוסתרים לא יזייפו את התוצאה לשני הכיוונים. */
const SCAN=`(() => {
  const SKIP=['script','style','link','meta','head','title','br','svg','path','g',
              'circle','rect','line','polyline','polygon','defs','use','tspan','text'];
  const bad=[]; let seen=0;
  for(const el of document.querySelectorAll('*')){
    const t=el.tagName.toLowerCase();
    if(SKIP.includes(t)) continue;
    if(!el.getClientRects().length) continue;
    seen++;
    const fam=getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g,'').trim();
    if(fam!=='Assistant' && fam!=='Heebo')
      bad.push(t+(el.className?'.'+String(el.className).split(' ')[0]:'')+' → '+fam);
  }
  return { seen, bad:[...new Set(bad)] };
})()`;

let fail=0;
const ok =(m)=>console.log('✅ '+m);
const bad=(m,d)=>{ fail++; console.log('❌ '+m); (d||[]).forEach(x=>console.log('     '+x)); };

(async()=>{
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  const base='http://127.0.0.1:'+PORT+'/';
  const browser=await chromium.launch({
    executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-sandbox'] });

  /* --- 1. קובצי הגופן שב-CSS קיימים על הדיסק --------------------------- */
  const css=fs.readFileSync(path.join(ROOT,'ui-lab.css'),'utf8');
  const refs=[...css.matchAll(/url\("(fonts\/[^"]+\.woff2)"\)/g)].map(m=>m[1]);
  const missing=refs.filter(f=>!fs.existsSync(path.join(ROOT,f)));
  if(refs.length!==6)      bad('ui-lab.css מצהיר על '+refs.length+' קובצי גופן במקום 6');
  else if(missing.length)  bad('קובצי גופן חסרים במאגר', missing);
  else                     ok('שישה קובצי גופן מוצהרים ב-ui-lab.css וקיימים במאגר');

  /* --- 2. הגופנים באמת מגיעים ונטענים ---------------------------------- */
  const p=await browser.newPage({ viewport:{width:1440,height:900} });
  const woff=[];
  p.on('response',r=>{ if(/\.woff2$/.test(r.url())) woff.push([r.status(), r.url().split('/').pop()]); });
  await p.goto(base+'demo.html',{waitUntil:'networkidle'});
  await p.evaluate(()=>document.fonts.ready);

  const faces=await p.evaluate(()=>[...document.fonts].length);
  if(faces!==6) bad('נטענו '+faces+' הצהרות @font-face במקום 6');
  else          ok('שש הצהרות @font-face הגיעו לדפדפן');

  const failedFont=woff.filter(([s])=>s!==200);
  /* מספיק שהקבצים חזרו 200 — הקדמת הטעינה (preload) מביאה אותם גם בלי
     ‎@font-face‎. לכן נבדק גם שהדפדפן באמת *שייך* אותם למשפחה. */
  const applied=await p.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').length);
  if(!woff.length)           bad('אף קובץ גופן לא נתבקש — הגופנים עדיין נלקחים מהמכשיר');
  else if(failedFont.length) bad('קובץ גופן לא נטען', failedFont.map(x=>x.join(' ')));
  else if(!applied)          bad('קובצי הגופן ירדו אך אף אחד לא שויך למשפחה — @font-face חסר');
  else                       ok(woff.length+' קובצי גופן נטענו ו-'+applied+' שויכו למשפחה: '+woff.map(x=>x[1]).join(' · '));

  const checks=await p.evaluate(()=>({
    a400:document.fonts.check('400 16px Assistant'), a800:document.fonts.check('800 16px Assistant'),
    h500:document.fonts.check('500 16px Heebo'),     h800:document.fonts.check('800 16px Heebo') }));
  const missW=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  if(missW.length) bad('משקלים שאינם זמינים בפועל', missW);
  else             ok('כל המשקלים שהעיצוב משתמש בהם זמינים (400 · 500 · 800)');

  /* --- 3. כל מסך · כל מצב · כל רוחב ------------------------------------ */
  const ids=await p.evaluate(()=>[...document.querySelectorAll('#tabs [data-tab]')].map(b=>b.dataset.tab));
  if(ids.length<10) bad('נמצאו רק '+ids.length+' מסכים בדמו — הניווט השתנה?');
  await p.close();

  for(const vp of [{width:1440,height:900,name:'שולחני'},{width:390,height:844,name:'נייד'}]){
    for(const scheme of ['light','dark']){
      const q=await browser.newPage({ viewport:{width:vp.width,height:vp.height}, colorScheme:scheme });
      await q.goto(base+'demo.html',{waitUntil:'networkidle'});
      await q.evaluate(()=>document.fonts.ready);
      let seen=0; const offenders=new Set();
      for(const id of ids){
        await q.evaluate(i=>{ const b=document.querySelector('#tabs [data-tab="'+i+'"]'); if(b) b.click(); }, id);
        await q.waitForTimeout(120);
        const r=await q.evaluate(SCAN);
        seen+=r.seen; r.bad.forEach(x=>offenders.add(x));
      }
      const label=vp.name+' · '+(scheme==='dark'?'לילה':'יום');
      if(offenders.size) bad(label+' — '+offenders.size+' אלמנטים מחוץ לגופן העיצוב', [...offenders]);
      else               ok(label+' — כל '+seen+' האלמנטים הגלויים ב-'+ids.length+' המסכים בגופן העיצוב');
      await q.close();
    }
  }

  /* --- 4. רכיבי טופס בכל עמוד שהמעבדה נוגעת בו -------------------------
     כאן נפתחה הפירצה מלכתחילה: הדפדפן אינו מוריש font-family לרכיבי טופס,
     ו-management.html תיקן זאת ל-button בלבד. */
  for(const page of ['demo.html','management.html?ui=new','register.html?ui=new']){
    const q=await browser.newPage({ viewport:{width:1440,height:900} });
    await q.goto(base+page,{waitUntil:'load'});
    await q.waitForTimeout(1200);
    await q.evaluate(()=>document.fonts.ready);
    const r=await q.evaluate(()=>{
      const out=[]; let n=0;
      for(const el of document.querySelectorAll('input,select,textarea,button,option,optgroup')){
        n++;
        const fam=getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g,'').trim();
        if(fam!=='Assistant' && fam!=='Heebo') out.push(el.tagName.toLowerCase()+' → '+fam);
      }
      return { n, bad:[...new Set(out)] };
    });
    if(r.bad.length) bad(page+' — רכיבי טופס בגופן ברירת המחדל', r.bad);
    else             ok(page+' — כל '+r.n+' רכיבי הטופס בגופן העיצוב');
    await q.close();
  }

  /* --- 5. חלונות ההדפסה וה-PDF ------------------------------------------
     מסמכים ש-window.open נפתחים בהם אינם יורשים גיליונות סגנון, ולכן כל אחד
     מהם חייב לקרוא ל-labFontTags(). נבדק על המקור עצמו: הבדיקה שלמעלה רצה
     על demo.html שאין בו הדפסה, ומסך הדפסה אמיתי דורש התחברות. */
  const app=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const writes=[...app.matchAll(/<!doctype html><html dir="rtl"[^`]*?<\/head>/g)].map(m=>m[0]);
  const guideWrite=/<title>מדריך[^`]*?<style>/.test(app);
  const uncovered=writes.filter(w=>!w.includes('${labFontTags()}'));
  if(!writes.length)     bad('לא נמצאו חלונות הדפסה ב-index.html — המבנה השתנה?');
  else if(uncovered.length) bad(uncovered.length+' חלונות הדפסה בלי גופני העיצוב',
                               uncovered.map(w=>w.slice(0,80)+'…'));
  else if(!guideWrite || !/<title>מדריך[\s\S]{0,120}\$\{labFontTags\(\)\}/.test(app))
                         bad('חלון המדריך להדפסה בלי גופני העיצוב');
  else                   ok(writes.length+' חלונות הדפסה/PDF מקבלים את גופני העיצוב');

  if(!/html body,html body \*\{font-family:"Assistant"/.test(app))
    bad('גיליון הכפייה של החלונות המשניים חסר — Arial/system-ui יגברו על הגופן');
  else ok('גיליון הכפייה גובר על ‏Arial/system-ui‏ שבסגנונות ההדפסה עצמם');

  /* --- 6. מעבדה כבויה = אפס השפעה -------------------------------------- */
  for(const page of ['register.html','management.html']){
    const ctx=await browser.newContext();
    const q=await ctx.newPage();
    const extra=[];
    q.on('request',r=>{ const u=r.url(); if(/ui-lab\.(css|js)|\/fonts\//.test(u)) extra.push(u.split('/').pop()); });
    await q.goto(base+page,{waitUntil:'load'});
    await q.waitForTimeout(700);
    const cls=await q.evaluate(()=>document.documentElement.className);
    if(cls.includes('ui-lab')) bad(page+' (מעבדה כבויה) — המחלקה ui-lab נוספה בכל זאת');
    else if(extra.length)      bad(page+' (מעבדה כבויה) — נטענו קבצים של המעבדה', extra);
    else                       ok(page+' (מעבדה כבויה) — אין מחלקה, אין CSS, אין גופן. אפס השפעה');
    await ctx.close();
  }

  console.log('============================================');
  console.log(fail? ('תוצאה: '+fail+' נכשלו') : 'תוצאה: כיסוי הגופן מלא ✅');
  await browser.close(); server.close();
  process.exit(fail?1:0);
})();
