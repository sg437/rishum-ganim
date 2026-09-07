# DESIGN-SPEC — המערכת המרכזית (management.html)

**שם השפה:** מסילה רכה · Warm Rail
**סטטוס:** מולא (שלב ב') · **עודכן לאחרונה:** 2026-09-07

> **מה זה:** מקור האמת היחיד לשפה העיצובית של המרכזי. כל שיחת עיצוב חדשה
> מתחילה בהדבקת הבלוק שלמטה, ולכן הוא עומד בפני עצמו — בלי "כפי שסיכמנו",
> בלי הפניות לשיחה כלשהי, וכל ערך מספרי מפורש.
>
> **מה זה לא:** אינו נוגע לתוכנת הערים (`index.html` · `ui-lab.css` · `ui-lab.js`)
> ואינו נוגע ל-`docs/design/`, שהיא חבילת העיצוב של הערים. ראה ההערה
> ב-`management.html:31-35`.

## איך עובדים עם הקובץ

1. בכל שיחת עיצוב חדשה מעתיקים את **כל** הבלוק שלמטה ומדביקים בראש השיחה,
   תחת הכותרת `═══ DESIGN-SPEC ═══`, יחד עם סעיף הגבולות ורשימת המסכים לאותה שיחה.
2. בסוף כל קבוצת מסכים — אם נוסף רכיב או ערך שלא מופיע כאן, **מעדכנים מיד**,
   לפני השיחה הבאה. מפרט שלא מתעדכן הוא מקור הסחף.
3. כל שינוי נרשם בטבלת השינויים בתחתית.

---

## המפרט — להעתקה כמקשה אחת

```
DESIGN-SPEC · מרכז ניהול ארצי (management.html)
שם השפה: מסילה רכה · Warm Rail
עברית, RTL, מסך בהיר כברירת מחדל, מצב לילה אופציונלי.
Vanilla JS, משתני CSS ב-:root, בלי ספריות ובלי build step.

═══ 1. גופנים ═══
נטענים מקומית מ-fonts/ דרך @font-face (CSP: font-src 'self' data:).
  @font-face{font-family:"Heebo";src:url("fonts/heebo-hebrew.woff2") format("woff2");font-weight:100 900;font-display:swap}
  @font-face{font-family:"Assistant";src:url("fonts/assistant-hebrew.woff2") format("woff2");font-weight:200 800;font-display:swap}
--font-head: "Heebo", system-ui, sans-serif      → כותרות, מספרים גדולים, שמות ערים
--font-body: "Assistant", system-ui, sans-serif  → כל השאר
--font-mono: ui-monospace, Menlo, monospace      → מספר זהות, טלפון, סמל מוסד בלבד
body { font-variant-numeric: tabular-nums }

═══ 2. טוקני צבע — מצב בהיר ═══
--bg            #f4f2ed  רקע האפליקציה (נייר שבור, לא לבן בוהק)
--surface       #fffefb  משטח כרטיס, טבלה, סרגל צד, שכבה מרחפת
--surface-2     #f2efe8  משטח שקוע: ריחוף פריט ניווט, פס פעולות, כותרת קבוצת ערים
--surface-3     #e9e5dc  מסלול מד התקדמות, רקע בורר מקטעים
--border        #eae6dd  קו הפרדה שקט: מסגרת כרטיס, קו בין שורות
--border-strong #e3dfd6  מסגרת שדה קלט וכפתור משני
--rule          #f2efe8  קו בין שורות בתוך כרטיס
--ink           #22221f  טקסט ראשי, מספרים, כותרות
--ink-soft      #4e4c46  טקסט משני, פריט ניווט לא נבחר
--muted         #6b6860  תווית, טקסט עזר, ערך ריק (מינימום המותר לטקסט)
--brand         #2f5d4a  ירוק מרווה: כפתור ראשי, מצב נבחר, פוקוס, מד תקין
--brand-ink     #24483a  טקסט מותג על רקע רך
--brand-soft    #e6efe9  רקע פריט ניווט נבחר, תגית מותג, אזור שחרור גרירה
--brand-lift    #5f8a76  הצד הבהיר בגרדיאנט של אריח מותג
--warn          #8a5b12  ענבר: מתקרב לרף, טרם נקלט, ממתין
--warn-soft     #f3edde  רקע תגית אזהרה
--danger        #9d3227  חימר: חריגה מרף, בלי ת״ז, מסמך חסר, פעולה הרסנית
--danger-soft   #f8e5e1  רקע תגית שגיאה
--band-from     #3f4f48  פס הדיו העליון — גרדיאנט מלמעלה
--band-to       #2b3630  פס הדיו העליון — גרדיאנט מלמטה
--band-lit      #5d6f66  קו האור בקצה העליון של הפס (inset 0 1px 0)
--band-ink      #fffefb  טקסט על הפס
--band-soft     #d3dbd7  טקסט משני על הפס
--band-line     #6d7a74  מסגרות ומפרידים על הפס
--rail          #2f5d4a  קו המסילה 2px מתחת לפס
--scrim         rgba(34,34,31,.20)  עמעום הבסיס מתחת לשכבה מרחפת

═══ 3. טוקני צבע — מצב לילה ═══
[data-theme="dark"] דורס את הערכים הבאים; כל השאר זהה.
--bg            #1b1f1d
--surface       #232826
--surface-2     #2b312e
--surface-3     #363d39
--border        #333a36
--border-strong #414a45
--rule          #2f3532
--ink           #eceae4
--ink-soft      #c2c7c2
--muted         #98a09b   (5.1:1 על --surface)
--brand         #7fbb9e   (ירוק מרווה מובהר; 6.4:1 על --surface)
--brand-ink     #b9dccb
--brand-soft    #24332c
--brand-lift    #9ed3b6
--warn          #d9a94a
--warn-soft     #37301d
--danger        #e08476
--danger-soft   #3a2622
--band-from     #2b3630
--band-to       #1f2724
--band-lit      #46534d
--scrim         rgba(0,0,0,.42)
כפתור המעבר: ☾ בפס העליון; הבחירה נשמרת ב-localStorage תחת hq-theme.
ברירת מחדל: prefers-color-scheme.

═══ 4. טיפוגרפיה — הסולם המלא ═══
כותרת מסך      Heebo 600 · 23px · line-height 1.2  · letter-spacing -.015em
כותרת קטע      Heebo 600 · 15px · 1.4
כותרת כרטיס    Heebo 600 · 15px · 1.4
מספר גדול      Heebo 700 · 30px · 1.05  (מד ראשי, אחוז ארצי)
מספר תור       Heebo 700 · 22px · 1.1
מספר תחנה      Heebo 700 · 28px · 1     (בקו מתאר: color:transparent; -webkit-text-stroke:1.3px var(--muted))
טקסט           Assistant 400 · 14px · 1.5
טקסט מודגש     Assistant 700 · 14px · 1.5   (שם תלמידה, ערך חשוב)
טקסט משני      Assistant 400 · 13.5px · 1.5
טקסט עזר       Assistant 400 · 12.5px · 1.45
תווית          Assistant 700 · 10.5px · 1.3 · letter-spacing .12em   (כותרת קבוצה בסרגל)
כותרת עמודה    Assistant 700 · 11px · 1.3 · letter-spacing .09em
מספר מונו      var(--font-mono) 400 · 13.5px

═══ 5. סולם ריווח — הערכים המותרים בלבד ═══
4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 24
ריווח פנימי כרטיס: 16px 18px. ריווח בין כרטיסים: 12px. ריווח בין קבוצות בסרגל: 16px.
ריווח פנימי מסך (main): 18px 20px 20px.

═══ 6. רדיוסים — הערכים המותרים בלבד ═══
4px    צ׳יפ מד/אריח קטן (11×11)
8px    תגית מקטע בבורר, אריח מספר
10px   כפתור, שדה קלט, פריט ניווט
12px   כרטיס פנימי (כרטיס תלמידה, כפתור תור עבודה), טוסט
14px   כרטיס ראשי, מסגרת המסך, מגירה, מודאל
999px  תגית סטטוס, מד התקדמות, אווטאר

═══ 7. סולם צללות — שלוש רמות ═══
--sh-1: 0 1px 2px rgba(34,34,31,.04), 0 1px 3px rgba(34,34,31,.06)
        מנוחה: כרטיס, טבלה, פריט ניווט נבחר.
--sh-2: 0 4px 12px -4px rgba(34,34,31,.10), 0 2px 4px rgba(34,34,31,.05)
        ריחוף/הרמה: כרטיס בריחוף, popover, אריח מורם, תפריט.
--sh-3: 0 18px 40px -12px rgba(34,34,31,.22), 0 4px 10px -4px rgba(34,34,31,.10)
        שכבה: מגירה, מודאל, טוסט.
במצב לילה: אותם ערכים עם rgba(0,0,0,.5)/(.28)/(.6) בהתאמה.
אסור: צל על שורת טבלה, צל על אלמנט שחוזר יותר מ-20 פעם במסך.

═══ 8. חתימת השפה — חמישה מרכיבים שחוזרים בכל מסך ═══
8.1 פס הדיו: גובה 58px, לרוחב כל המערכת (מעל הסרגל),
    background:linear-gradient(180deg,var(--band-from),var(--band-to));
    box-shadow:inset 0 1px 0 var(--band-lit);
    תוכן: סמל המסילה (3 קווים 2px: מותג/לבן/אפור, רוחב 22px) · שם המערכת Heebo 600 15.5px ·
    מפריד 1px · שם המחלקה · חיפוש 34px · בורר שנה · ☾ · אווטאר 30px.
8.2 קו המסילה: div בגובה 2px, background:var(--rail), ישר מתחת לפס, לכל רוחב אזור התוכן.
8.3 צמתים: על קו המסילה, position:absolute;top:-7px. לא פעיל 13×13 radius 4,
    background:linear-gradient(180deg,#fff,#e7e5df), border:1px solid var(--border-strong),
    box-shadow:0 2px 0 #d4d2cb, 0 4px 7px -3px rgba(34,34,31,.30).
    פעיל 19×19, top:-11px, background:linear-gradient(180deg,var(--brand-lift),var(--brand)),
    box-shadow:0 3px 0 var(--brand-ink), 0 7px 14px -4px rgba(47,93,74,.55).
8.4 אורות איתות: סטטוס = ריבוע + מילה, לא תגית מרובעת.
    קיים ■ בצבע המצב (--brand/--warn/--danger), טרם □ ב---muted, שניהם font-weight 700, 14px.
    תגית מרובעת (radius 999, padding 1px 8px, 12.5px/700, רקע *-soft) נשמרת למונים בכותרות בלבד.
8.5 ספרות מונו: כל מספר זהות, טלפון וסמל מוסד ב---font-mono ובתוך dir="ltr".

═══ 9. רכיבים — מידות וכל המצבים ═══
9.1 כפתור ראשי: גובה 36px · padding 0 15px · radius 10 · background var(--brand) ·
    border 1px solid var(--brand) · טקסט var(--band-ink) 13px/700.
    ריחוף: background var(--brand-ink). לחוץ: background var(--brand-ink) + transform translateY(1px).
    פוקוס: outline 2px solid var(--brand); outline-offset 2px.
    מושבת: opacity .45; cursor not-allowed. שגיאה: אין (ראה הרסני).
9.2 כפתור משני: גובה 36 · radius 10 · background var(--surface) · border 1px solid var(--border-strong) ·
    טקסט var(--ink) 13px/400. ריחוף: border-color var(--brand). לחוץ: background var(--surface-2).
9.3 כפתור שקוף: אותן מידות, border transparent, background transparent.
    ריחוף: background var(--surface-2).
9.4 כפתור הרסני: כמו ראשי עם var(--danger) / רקע var(--danger-soft) וטקסט var(--danger) לגרסה הרכה.
9.5 כפתור אייקון: 34–36px ריבועי, radius 10, אייקון 16px.
9.6 שדה קלט: גובה 36px · padding 0 12px · radius 10 · background #faf8f4 ·
    border 1px solid var(--border-strong) · טקסט 13.5px.
    placeholder: var(--muted). פוקוס: outline 2px solid var(--brand); outline-offset 1px; background var(--surface).
    שגיאה: border-color var(--danger) + הודעה 12.5px var(--danger) מתחת.
    מושבת: background var(--surface-2); color var(--muted).
9.7 בורר (select): כמו שדה קלט + חץ 10px var(--muted) בקצה.
9.8 בורר מקטעים: מכל radius 11 · padding 3 · background var(--surface-3);
    אפשרות גובה 32 · radius 8 · הפעילה background var(--surface) + --sh-1 + 700.
9.9 טבלה: גובה שורה קבוע 44px · כותרת דביקה position:sticky;top:0 עם
    box-shadow:inset 0 -1px 0 var(--border-strong) (לא border, כדי לא לאבד אותה ב-collapse) ·
    border-collapse:collapse · קו בין שורות border-bottom 1px var(--rule) על ה-tr (לא על התאים) ·
    ריווח תא 0 8px, תא ראשון 0 24px 0 0, אחרון 0 24px 0 8px ·
    ריחוף שורה: background var(--surface-2) בלבד, בלי transition ובלי צל ·
    שורה נבחרת: background var(--brand-soft) + box-shadow:inset -3px 0 0 var(--brand) על התא הראשון ·
    הטבלה גוללת בתוך המכל (overflow:auto) ולא בתוך הדף ·
    white-space:nowrap על ה-table; רוחבי עמודות אוטומטיים.
    קבוצת ערים: שורת td colSpan מלא, גובה 34px, background var(--surface-2),
    ובה ריבוע מותג 7px · שם העיר Heebo 700 14px · מונה · מד 110×4px.
9.10 כרטיס: radius 14 · background var(--surface) · border 1px solid var(--border) · --sh-1 ·
    padding 16px 18px. ריחוף (אם לחיץ): transform translateY(-1px) + --sh-2, transition 140ms ease.
9.11 מד קיבולת: מסלול גובה 8px (או 6px בתוך רשימה) radius 999 background var(--surface-3);
    מילוי var(--brand) עד 85%, var(--warn) מ-86% עד 100%, var(--danger) מעל 100%.
    לצדו מספר Heebo 700 13.5px, ומתחתיו שורת מצב: "N מקומות פנויים" / "מתקרב לרף · N" /
    "חריגה מרף השיבוץ · שיבוץ חסום".
9.12 תגית סטטוס: radius 999 · padding 1px 8px · 12.5px/700 · רקע *-soft · טקסט בצבע המצב.
9.13 Drawer: רוחב 452px · צמוד לקצה שמאל (RTL) · גובה מלא · background var(--surface) ·
    border-inline-end 1px solid var(--border) · radius 14 בפינות הפנימיות · --sh-3 ·
    כותרת 18px 20px 14px + כפתור ✕ 32px · גוף גולל · פוטר עם פעולות על var(--surface-2).
    פתיחה: opacity 0→1 + translateX(-8px→0), 180ms ease-out. Esc סוגר. לחיצה על ה-scrim סוגרת.
9.14 Popover: רוחב 320px · radius 12 · background var(--surface) · border 1px solid var(--border-strong) ·
    --sh-2 · עוגן לרכיב שפתח אותו · כותרת 11px 14px + ✕ · פוטר עם "החל"/"ביטול" על var(--surface-2).
    פתיחה 150ms opacity+translateY(-4px→0).
9.15 מודאל: רוחב 560px (רחב: 860px) · radius 14 · --sh-3 · scrim var(--scrim) ·
    ממורכז · פתיחה 180ms opacity + scale(.99→1). רק לפעולה שדורשת מיקוד מלא.
9.16 טוסט: radius 12 · background var(--ink) · טקסט var(--surface) 13.5px ·
    padding 11px 14px 11px 16px · --sh-3 · נקודה 8px בצבע המצב · כפתור "ביטול" שקוף עם border 1px ·
    ממורכז 20px מלמטה · נעלם אחרי 6s.
    כשקיים סרגל פעולות מרחף — למכל הגלילה שמעליו חייב padding-bottom של 82px,
    אחרת השורה האחרונה נופלת מתחתיו.
9.17 סרגל פעולות מרחף (בחירה מרובה): radius 12 · background var(--ink) · --sh-3 ·
    מונה נבחרים 13px/700 · כפתור ראשי + שקופים + ✕.
9.18 אייקוני ניווט: SVG מקומי 16×16, fill none, stroke currentColor, stroke-width 1.4,
    linecap/linejoin round, opacity .75. גיאומטריים בלבד — בלי אילוסטרציות.

═══ 10. מצבי מסך ═══
טעינה: שלד — 3–5 מלבנים radius 12 בגובה השורה האמיתית, background var(--surface-2),
        בלי אנימציית shimmer. מעל 400ms בלבד; מתחת לזה שום דבר.
ריק:    כרטיס ממורכז, כותרת Heebo 600 15px, שורת הסבר 13.5px var(--muted),
        וכפתור ראשי אחד לפעולה שפותרת את הריקנות.
שגיאה:  כרטיס עם border-color var(--danger), כותרת בצבע var(--danger),
        טקסט מה קרה ומה לעשות, וכפתור "נסה שוב".
אין הרשאה: כרטיס על var(--surface-2), 🔒 טקסטואלי, הסבר שההרשאות נקבעות
        ב"הגדרות והרשאות", בלי כפתור פעולה.
צפייה בלבד: באנר 36px על var(--surface-2) בראש התוכן + כל הכפתורים disabled.

═══ 11. כללי פריסה ═══
סרגל צד: רוחב 248px, קבוע ופתוח מ-900px ומעלה, תמיד גלוי, בלי המבורגר בדסקטופ.
         מצב מכווץ אופציונלי 64px (אייקונים בלבד) עם כפתור « בראשו; ברירת מחדל פתוח.
         17 המודולים מקובצים לחמש קבוצות: ראשי · רישום ושיבוץ · קשר והפצה · בקרה וציות · ניהול.
נקודת שבירה: 900px.
מובייל (<900px): הסרגל הופך למגירה נשלפת עם scrim; שכבות מרחפות הופכות ל-bottom sheet
         כמעט מלא-מסך עם ידית גרירה; אזורי מגע 44px לפחות; רספונסיבי עד 360px.
רוחב תוכן מקסימלי: אין — הטבלה מתפרשת לכל הרוחב. טקסט רץ עד 68ch.
פס עליון: 58px. קו מסילה: 2px. פס תחנות: 96–102px. שורת סינון: 52px.
שכבה אחת פתוחה בלבד בכל רגע.

═══ 12. כללי RTL ═══
dir="rtl" על ה-html. כל הפריסות ב-flex/grid עם gap — לא margin ולא inline flow.
מספרים, אימיילים וטלפונים בתוך dir="ltr" (span או td).
הסרגל בימין; המגירה נפתחת משמאל.
לוגי בלבד: padding-inline / margin-inline / border-inline-*.
אייקוני כיוון: › לפעולה קדימה (מצביע שמאלה בפועל), « לכיווץ הסרגל.
טקסט מעורב עברית-לטינית: תמיד לעטוף את המקטע הלטיני ב-dir="ltr".

═══ 13. כללי עומק ═══
העומק מושג בשלושה אמצעים בלבד: סולם הצללות (3 רמות), הבהרת משטח השכבה מול הבסיס,
ועמעום עדין של הבסיס (var(--scrim)) מאחור.
גרדיאנטים מותרים על: פס הדיו, צמתים ואריחים מורמים, אור עליון על אזור התוכן, אווטאר.
אסור: perspective, rotate3d, transform-style:preserve-3d, parallax, WebGL, ספריות אנימציה.
backdrop-filter: על שכבות קטנות בלבד (popover, טוסט). אסור מעל טבלה ארוכה.

═══ 14. כללי ביצועים ═══
טבלאות ארוכות: כותרת דביקה, גלילה בתוך המכל, גובה שורה קבוע, בלי צל ובלי transition על שורות.
אנימציות: פתיחה/סגירה של שכבות בלבד, 150–200ms, על opacity ו-transform בלבד.
מיקרו-פידבק על כרטיס לחיץ: transition 140ms על transform ו-box-shadow — לא על שורת טבלה.
תגובה מיידית: מצב לחוץ/טעינה נראה בפחות מ-100ms מהלחיצה.
בלי גרדיאנט ובלי צל רחב על אלמנט שחוזר יותר מ-20 פעם במסך.
prefers-reduced-motion: reduce → כל ה-transition ל-0ms.

═══ 15. ניגודיות ═══
כל טקסט 4.5:1 לפחות מול מה שמאחוריו; כותרות מעל 24px — 3:1 לפחות.
הצבעים בסעיפים 2–3 נבדקו: --muted 5.5:1, --brand 6.4:1, --warn 5.8:1, --danger 7.1:1,
טקסט על --brand 8.7:1, טקסט על פס הדיו 11:1.
לעולם לא להעביר מידע בצבע בלבד — לכל מצב יש גם מילה או ריבוע איתות.
פוקוס מקלדת: outline 2px solid var(--brand); outline-offset 2px — בשום מקום לא להסיר.
```

---

## טבלת שינויים

| תאריך | מה השתנה | באיזו שיחה/מסך התגלה |
|---|---|---|
| 2026-09-07 | המפרט המלא נכתב — שלב ב', פלטה "מסילה רכה · Warm Rail" | שלב ב' |
