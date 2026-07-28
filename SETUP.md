# הפעלת המערכת בענן — מדריך הגדרה (חד-פעמי) 🔧

הגרסה המתארחת (`index.html`) שומרת את כל הנתונים ב**ענן** (Firebase) עם **התחברות** (אימייל וסיסמה),
כך שאותם נתונים נראים בכל המכשירים — טלפון ומחשב — ומסתנכרנים בזמן אמת.

צריך לבצע פעם אחת את השלבים הבאים (בערך 10–15 דקות). אין צורך בכרטיס אשראי — השכבה החינמית מספיקה בהרבה.

---

## שלב 1 — יצירת פרויקט Firebase
1. היכנס/י ל־https://console.firebase.google.com עם חשבון Google.
2. לחצ/י **Add project / הוספת פרויקט** → תן/י שם (למשל `rishum-ganim`) → המשך/י (אפשר לכבות Analytics) → **Create**.

## שלב 2 — הפעלת התחברות (Authentication)
1. בתפריט הצד: **Build → Authentication → Get started**.
2. בלשונית **Sign-in method** → בחר/י **Email/Password** → **Enable** → **Save**.
3. בלשונית **Users → Add user**: הוסף/י את המשתמש/ים שיתחברו למערכת (אימייל + סיסמה).
   כל מי שתוסיף/י כאן יוכל להתחבר. (אין הרשמה פתוחה — רק מי שהוספת.)

## שלב 3 — יצירת מסד הנתונים (Firestore)
1. בתפריט: **Build → Firestore Database → Create database**.
2. בחר/י מיקום (למשל `eur3`/`europe-west`) → **Next**.
3. בחר/י **Start in production mode** → **Create**.
4. עבור/י ללשונית **Rules**, מחק/י את הקיים והדבק/י את הכללים הבאים, ואז **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // רק משתמש מחובר (שהוגדר ב-Authentication) יכול לקרוא/לכתוב
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> כללים אלה מבטיחים שרק משתמש שהתחבר עם אימייל/סיסמה שהגדרת יוכל לגשת לנתונים.

## שלב 4 — קבלת המפתחות (Config) והדבקתם באפליקציה
1. בקונסולה: גלגל השיניים ⚙️ (למעלה משמאל) → **Project settings**.
2. גלול/י ל־**Your apps** → לחצ/י על אייקון האינטרנט **</>** (Web) → תן/י כינוי → **Register app**.
3. יוצג בלוק `const firebaseConfig = { … }` עם 6 ערכים. העתק/י אותם.
4. פתח/י את הקובץ **`index.html`** במאגר, ובראש קוד ה-JavaScript החלף/י את בלוק `firebaseConfig`
   (השדות עם `YOUR_...`) בערכים האמיתיים שקיבלת. לדוגמה:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "rishum-ganim.firebaseapp.com",
  projectId: "rishum-ganim",
  storageBucket: "rishum-ganim.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

5. שמור/י את הקובץ (commit).

## שלב 5 — פרסום כאתר (GitHub Pages)
1. במאגר ב-GitHub: **Settings → Pages**.
2. תחת **Build and deployment → Source** בחר/י **Deploy from a branch**.
3. בחר/י ענף **main** ותיקייה **/ (root)** → **Save**.
   (אם השינויים עדיין בענף הפיתוח — מזגו קודם את ה-Pull Request ל-main.)
4. אחרי דקה־שתיים יופיע הכתובת, בדרך כלל: **`https://sg437.github.io/rishum-ganim/`**

## שלב 6 — אישור הדומיין ב-Firebase (חשוב!)
1. חזור/י ל-Firebase → **Authentication → Settings → Authorized domains → Add domain**.
2. הוסף/י את `sg437.github.io` (הדומיין של GitHub Pages).
   בלי זה ההתחברות תיחסם בכתובת האמיתית. (`localhost` כבר מאושר לבדיקות מקומיות.)

---

## זהו! ✅
נכנסים לכתובת האתר, מתחברים עם האימייל והסיסמה שהגדרת בשלב 2, וכל הנתונים נשמרים בענן
ומסתנכרנים בין כל המכשירים.

### העברת הנתונים שכבר הוזנו בטלפון (מהגרסה הישנה)
1. בטלפון, פתח/י את הקישור הישן (הדמו) → **הגדרות → ⬇️ ייצוא גיבוי (JSON)** ושמור/י את הקובץ.
2. באפליקציה החדשה (בענן) → **הגדרות → ⬆️ שחזור מגיבוי** ובחר/י את הקובץ.
   הנתונים ייטענו ויעלו לענן, ומעכשיו יופיעו גם במחשב.

### שיתוף לביקורת עם מישהו חיצוני
אפשרות א׳ — לתת לו/ה משתמש: הוסף/י אותו ב-Authentication → Users (אימייל + סיסמה), והוא יתחבר לכתובת האתר.
אפשרות ב׳ — אם רוצים שרק *יראה* בלי חשבון: אפשר להקים בהמשך "מצב צפייה בלבד" (דורש התאמה נוספת — פנה/י אליי).

### עלות
השכבה החינמית של Firebase (Spark) כוללת בערך 50K קריאות ו-20K כתיבות ליום ו-1GB אחסון —
הרבה מעבר לצורך של רשת גני ילדות. אין חיוב ללא שדרוג יזום לתוכנית בתשלום.

---

# חיבור Google Drive (שלב נוסף — תיקייה אוטומטית + העלאת מסמכים) 📁

מאפשר: ליצור תיקייה בדרייב לכל ילדה (לפי שנה/שם/ת"ז) ולהעלות אליה מסמכים ישירות מהתיק.
משתמשים באותו פרויקט Google של Firebase. הגישה מוגבלת אך ורק לקבצים שהמערכת יוצרת (scope בשם `drive.file`).

> **חשוב:** להתחבר תמיד עם **אותו חשבון Google** (מומלץ חשבון הארגון). כך כל התיקיות יושבות במקום אחד ונגישות לכולם.

## שלב D1 — הפעלת Google Drive API
1. היכנס/י ל־https://console.cloud.google.com ובחר/י למעלה את הפרויקט **`rishum-ganim-fad40`** (אותו פרויקט של Firebase).
2. בתפריט (☰) → **APIs & Services → Library**.
3. חפש/י **"Google Drive API"** → לחצ/י עליו → **Enable**.

## שלב D2 — מסך ההסכמה (OAuth consent screen)
1. תפריט (☰) → **APIs & Services → OAuth consent screen**.
2. בחר/י **External** → **Create**.
3. מלא/י: **App name** = `רישום גני ילדות`, **User support email** = האימייל שלך, ולמטה **Developer contact** = האימייל שלך → **Save and continue**.
4. במסך **Scopes** — פשוט **Save and continue** (לא צריך להוסיף כלום).
5. במסך **Test users** → **Add users** → הוסף/י את כתובות ה-Gmail של מי שישתמש בדרייב (למשל `7684252sg@gmail.com`) → **Save and continue** → **Back to dashboard**.

## שלב D3 — יצירת מזהה OAuth (Client ID)
1. תפריט (☰) → **APIs & Services → Credentials**.
2. למעלה **+ Create credentials → OAuth client ID**.
3. **Application type** = **Web application**.
4. **Name** = `rishum-ganim web`.
5. תחת **Authorized JavaScript origins** → **Add URI** → הזן/י בדיוק:
   `https://sg437.github.io`
   (אפשר להוסיף עוד URI `http://localhost` לבדיקות מקומיות — לא חובה.)
6. לחצ/י **Create**.
7. יופיע חלון עם **Client ID** (מחרוזת שמסתיימת ב-`.apps.googleusercontent.com`). העתק/י אותו ושלח/י לי — אני אכניס אותו לקוד ואדחוף.

## שלב D4 — שימוש
- **הגדרות → חיבור Google Drive → "חבר Google Drive"** (פעם אחת בכל מכשיר; אשר/י את ההרשאה).
- בכל תיק ילדה → מקטע **"תיקיית דרייב"** → **"צור תיקייה בדרייב"**, ואז **"העלאת מסמכים"**.
