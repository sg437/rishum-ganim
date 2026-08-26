# גופני העיצוב החדש

שני הגופנים שהמפרט (`docs/design/HANDOFF.md`) מבקש — **Assistant** לגוף
ו-**Heebo** לכותרות ולמספרים — יושבים כאן כקבצים במאגר, ולא נטענים מהרשת.

## למה במאגר ולא מ-Google Fonts

ה-CSP של האתר מתיר גופנים ממקור עצמי בלבד (`font-src 'self' data:`), ולכן
`fonts.googleapis.com` חסום. עד עכשיו הגופנים נלקחו **מהמכשיר** — כלומר מי
שאין לו Assistant/Heebo מותקנים קיבל נפילה אחורה ל-Segoe UI או ל-system-ui,
והעיצוב החדש נראה אצלו אחרת לגמרי. קבצים במאגר מבטיחים את אותו מראה בכל
מכשיר, בלי לפתוח את ה-CSP ובלי לדלוף כתובות IP של משתמשים לשרת חיצוני.

## הקבצים

| קובץ | משפחה | תת-קבוצה | גודל |
|---|---|---|---|
| `assistant-hebrew.woff2` | Assistant | עברית | 7 KB |
| `assistant-latin.woff2` | Assistant | לטינית | 22 KB |
| `assistant-latin-ext.woff2` | Assistant | לטינית מורחבת | 11 KB |
| `heebo-hebrew.woff2` | Heebo | עברית | 12 KB |
| `heebo-latin.woff2` | Heebo | לטינית | 30 KB |
| `heebo-latin-ext.woff2` | Heebo | לטינית מורחבת | 14 KB |

כולם **גופנים משתנים** (variable): קובץ אחד נושא את כל המשקלים —
Assistant 200–800 ו-Heebo 100–900 — ולכן אין צורך בקובץ נפרד לכל משקל.
כל `@font-face` נושא `unicode-range`, ולכן הדפדפן מוריד רק את מה שהעמוד
באמת מציג: בעברית זה כ-19 KB בלבד לשתי המשפחות יחד.

ההגדרות עצמן יושבות בסעיף הטיפוגרפיה שבראש `ui-lab.css`, ונטענות רק כשמעבדת
העיצוב דלוקה.

## מקור ורישוי

הקבצים הם ה-woff2 שגוגל מגישה בעצמה (Assistant v24, Heebo v28), בלי שינוי.
שני הגופנים ברישיון **SIL Open Font License 1.1**, שמתיר שימוש והפצה מחדש —
כולל אירוח עצמי — כל עוד נוסח הרישיון נשמר לצידם:

- `OFL-Assistant.txt` — Copyright 2020 The Assistant Project Authors
- `OFL-Heebo.txt` — Copyright 2014 The Heebo Project Authors

הרישיון הקנייני של התוכנה (קובץ `LICENSE` שבשורש) **אינו** חל על תיקייה זו.
