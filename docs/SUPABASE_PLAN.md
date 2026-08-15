# תוכנית מעבר ל-Supabase — הרחבה לריבוי ערים 🏙️

> מסמך תכנון (לא שינוי קוד). מטרתו: להכין את המערכת למעבר ממסד נתונים יחיד (Firebase/Firestore)
> ל-**Supabase (PostgreSQL)** עם **הפרדה נקייה בין ערים**, לקראת הרחבה מעבר למודיעין עילית.

עודכן: תשפ"ז · גרסה 1.0

---

## 1. למה בכלל לעבור? (המצב היום מול היעד)

**היום — Firebase/Firestore:** מסד NoSQL של מסמכים, סנכרון בזמן אמת, התחברות. עובד מצוין
לעיר אחת. החולשות לקראת הרחבה:
- אין הפרדה אמיתית בין ארגונים/ערים — כל משתמש מחובר רואה את *כל* הנתונים (ההרשאות ברמת האפליקציה בלבד).
- שאילתות ודוחות מורכבים (חתכים בין ערים/שנים/גילאים) מסורבלים ב-NoSQL.
- אין מבנה רלציוני (קשרים בין ילדה↔גן↔צוות) שנאכף ברמת המסד.

**היעד — Supabase:** Postgres מנוהל + Auth + Storage + Realtime, קוד פתוח.
- **Row-Level Security (RLS)** — כל עיר רואה ועורכת *רק* את הנתונים שלה, ברמת השרת (לא ניתן לעקוף).
- **SQL מלא** — דוחות, חתכים והצטלבויות בקלות (כולל `VIEW`ים ו-`materialized views`).
- **קשרים רלציוניים** עם `FOREIGN KEY` ואילוצים — שלמות נתונים.
- **Auth מובנה** כולל Google, עם תפקידים (מנהל-על / מנהל-עיר / עורך / צופה).

---

## 2. עקרונות הארכיטקטורה

- **הפרונט נשאר כמו שהוא** — אפליקציית עמוד יחיד (SPA) סטטית ב-GitHub Pages / PWA. מחליפים רק את **שכבת הנתונים**.
- **Multi-tenant בטבלה אחת** (Shared schema): לכל טבלה עמודת `city_id`. RLS מסנן לפי העיר של המשתמש. זו הגישה
  הפשוטה והזולה ביותר לתחזוקה (מול schema/DB נפרד לכל עיר).
- **מקור אמת יחיד**: Supabase. Google Sheets (אם נשמר) הופך למראה/ייצוא בלבד, כמו היום.
- **הגירה הדרגתית**: לא "מפץ גדול". מריצים במקביל, מוודאים, ואז עוברים.

```
┌─────────────┐     Auth (Google)      ┌──────────────────────────┐
│  הדפדפן/PWA │ ─────────────────────▶ │        Supabase          │
│  (SPA סטטי) │ ◀── Realtime + SQL ──▶ │  Postgres + RLS + Auth   │
└─────────────┘                        │  + Storage (מסמכים)      │
       │                               └──────────────────────────┘
       │ (אופציונלי, נשמר) 
       ▼
  Google Drive / Sheets  ← מראה/גיבוי בלבד
```

---

## 3. מבנה הנתונים המוצע (טבלאות)

מיפוי מהמבנה הנוכחי (מסמכי Firestore: `meta`, `gans`, `staff`, `management`, `students_<שנה>`)
למבנה רלציוני. כל טבלה כוללת `city_id` ו-`created_at` / `updated_at`.

### `cities` (ערים / ארגונים — ה-tenant)
| עמודה | סוג | הערה |
|---|---|---|
| id | uuid PK | |
| name | text | "מודיעין עילית", "ביתר עילית", … |
| subtitle | text | שם לתצוגה בכותרת |
| logo_url | text | לוגו (Storage) |
| settings | jsonb | הגדרות כלליות של העיר (יעד גנים, תפקידים, קמפוסים…) |

### `app_users` (משתמשים והרשאות)
| עמודה | סוג | הערה |
|---|---|---|
| id | uuid PK | = auth.users.id |
| email | text | |
| city_id | uuid FK→cities | לאיזו עיר שייך |
| role | text | `superadmin` / `city_admin` / `editor` / `viewer` |
| display_name | text | |

> `superadmin` (הנהלת הרשת) רואה את כל הערים; כל השאר מוגבלים ל-`city_id` שלהם.

### `gans` (גנים)
`id, city_id, gan_name, internal_symbol, gan_symbol, teacher_name, age, education ('רגיל'/'ח"מ'),
address, building, street, zone, phone_gan, phone_home, teacher_mobile, assistant_name, assistant_mobile,
campus, capacity, active (bool), docs_note, created_at`

### `students` (תלמידות)
`id, city_id, year, first_name, last_name, tz, dob, mother_name, father_name, phone, mobile,
street, building, city_text, gan_id FK→gans, campus, age, period ('א'/'ב'/'ג'/'סופי'),
education, placed (bool), registered_by_us (bool), absorbed_municipality (bool), insurance_paid (bool),
retention_next (bool), finished (bool), notes,
docs jsonb, doc_files jsonb, programs jsonb, programs_paid jsonb, support jsonb, special jsonb,
drive_folder, drive_folder_id, created_at`

> השדות המורכבים (מסמכים/תוכניות/סיוע/שונות) יכולים להישאר כ-`jsonb` בשלב ראשון — פשוט וגמיש —
> ובהמשך, אם צריך דוחות עליהם, לפרק לטבלאות ייעודיות.

### `staff` (צוות)
`id, city_id, last_name, first_name, tz, role, education, phone, mobile, email, city_text,
movements jsonb, notes, created_at`

### `assignments` (שיבוץ צוות)
`id, city_id, year, context ('activity'/'tzaharon'/…), gan_id FK→gans, role, staff_id FK→staff,
days jsonb, dur_type, dur_months, dur_from, dur_to, students jsonb`

### `management` (טלפוני הנהלה)
`id, city_id, name, dept, phone, mobile, email`

### `history` (נתונים היסטוריים לשנים קודמות)
`id, city_id, year, kind ('summary'/'by_gan'), data jsonb`

---

## 4. הפרדת ערים — Row-Level Security (RLS)

הלב של הרב-עירוניות. דוגמה למדיניות (על כל טבלה עם `city_id`):

```sql
-- הפעלת RLS
alter table students enable row level security;

-- פונקציית עזר: העיר של המשתמש המחובר
create or replace function auth_city_id() returns uuid language sql stable as $$
  select city_id from app_users where id = auth.uid()
$$;

-- קריאה/כתיבה רק לעיר של המשתמש (superadmin רואה הכל)
create policy students_city_isolation on students
  using (
    city_id = auth_city_id()
    or exists (select 1 from app_users u where u.id = auth.uid() and u.role = 'superadmin')
  )
  with check ( city_id = auth_city_id()
    or exists (select 1 from app_users u where u.id = auth.uid() and u.role = 'superadmin') );
```

> אותו דפוס חוזר לכל הטבלאות. כך **אין שום אפשרות** שמשתמש מעיר א' יראה/ישנה נתוני עיר ב' —
> גם אם ינסה לעקוף את הממשק. אפשר גם להוסיף מדיניות לפי `role` (למשל `viewer` — קריאה בלבד).

---

## 5. אימות (Auth)

- **Supabase Auth** עם Google (בדיוק כמו שהוספנו ל-Firebase). המשתמש נכנס עם Google.
- טריגר `on auth.users insert` → יוצר/מקשר רשומת `app_users`; משתמש שאין לו רשומה מאושרת = **אין גישה**
  (במקום ה"רשימת מורשים" הידנית של היום — כאן זה נאכף ברמת המסד).
- תפקידים ב-`app_users.role`, ובדיקה גם ב-RLS וגם בממשק (הסתרת כפתורי עריכה ל-`viewer`).

---

## 6. תוכנית הגירה — שלב אחר שלב

| שלב | תוכן | סיכון | הערכת מאמץ |
|---|---|---|---|
| **0. תשתית** | פתיחת פרויקט Supabase, הגדרת Auth+Google, פרויקט נפרד לבדיקות | נמוך | חצי יום |
| **1. סכימה** | יצירת כל הטבלאות + FK + אינדקסים + מדיניות RLS | נמוך | 1–2 ימים |
| **2. שכבת נתונים באפליקציה** | הפשטת גישת הנתונים ל-`db adapter` אחד (במקום קריאות Firestore ישירות), עם מימוש Supabase (`@supabase/supabase-js`): טעינה, שמירה, ומנוי Realtime | בינוני | 3–6 ימים |
| **3. הגירת נתונים** | סקריפט חד-פעמי: ייצוא מ-Firestore → טעינה ל-Supabase (עם `city_id` של מודיעין עילית) | בינוני | 1–2 ימים |
| **4. הרצה מקבילה + מעבר** | להריץ את שתי הגרסאות זו לצד זו, להשוות, ואז מעבר (cutover) | בינוני | 1–2 ימים |
| **5. עיר שנייה** | הוספת שורת `cities` + משתמשים — ללא שינוי קוד. אימות ההפרדה | נמוך | חצי יום |

**סה"כ הערכה גסה: כשבועיים עבודה מרוכזת**, תלוי בכמות ההתאמות בממשק.

### לגבי שלב 2 (שכבת הנתונים) — שתי גישות
- **א. "הרמה מהירה" (jsonb):** לשמור את מבנה ה-DB הנוכחי כמעט כמו שהוא, בעמודות `jsonb` בטבלאות
  לפי עיר. הגירה מהירה, שינוי קוד מינימלי — אבל מוותרים על חלק מיתרונות ה-SQL. טוב כ**גשר**.
- **ב. רלציוני מלא (מומלץ ליעד):** הטבלאות שבסעיף 3, עם קשרים ואינדקסים. יותר עבודה, אבל נותן את כל
  יתרונות הדוחות/השלמות/הביצועים. **מומלץ** אם באמת מרחיבים לכמה ערים.

> אפשר גם משולב: להתחיל ב-jsonb לשדות המורכבים (מסמכים/סיוע), ורלציוני לישויות הראשיות (ילדות/גנים/צוות).

---

## 7. מה נשמר ומה משתנה

| רכיב | היום | אחרי המעבר |
|---|---|---|
| ממשק (SPA/PWA) | ✅ | ✅ ללא שינוי מהותי |
| התחברות Google | ✅ Firebase | ✅ Supabase Auth |
| סנכרון בזמן אמת | ✅ Firestore | ✅ Supabase Realtime |
| הפרדת ערים | ❌ | ✅ RLS |
| דוחות SQL | ❌ | ✅ |
| Google Drive (מסמכים) | ✅ גשר Apps Script | ✅ נשאר, או Supabase Storage |
| Google Sheets (מראה) | ✅ | ✅ נשאר כמראה |

---

## 8. עלויות (הערכה)

- **Supabase Free tier:** מסד עד 500MB, Auth, Realtime — מספיק להתחלה ולכמה ערים קטנות.
- **Pro (~$25/חודש):** כשגדלים — יותר אחסון, גיבויים יומיים, ביצועים.
- אין נעילה לספק: Postgres סטנדרטי — אפשר לייצא/להעביר בכל עת.

---

## 9. הצעד הבא כשנחליט לבצע

1. פתיחת פרויקט Supabase + הפעלת Google Auth.
2. הרצת סקריפט הסכימה (שלב 1) — אכין אותו מוכן להדבקה ב-SQL Editor.
3. בניית `db adapter` והחלפת שכבת הנתונים (שלב 2), עם דגל שמאפשר לעבור בין Firebase ל-Supabase לבדיקות.
4. הגירת הנתונים של מודיעין עילית (שלב 3).
5. אימות מקביל ומעבר (שלב 4).

> עד שנחליט — **המערכת הנוכחית על Firebase יציבה ומספיקה**. המסמך הזה מוכן לרגע שבו מתחילים
> להרחיב לעיר נוספת, ואז ניגשים לביצוע לפי השלבים.
