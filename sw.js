/* ==========================================================================
   מערכת ניהול רשת הגנים  ·  Rishum Ganim
   Copyright © 2026 שמואל גולדמן (Shmuel Goldman). כל הזכויות שמורות / All rights reserved.

   תוכנה קניינית. אין להעתיק, לשכפל, להפיץ, לפרסם, לשנות, לתרגם, ליצור עבודות
   נגזרות או לעשות כל שימוש בקוד זה — כולו או חלקו — ללא אישור מפורש ובכתב
   מבעל הזכויות. הדבר חל גם על שכפול באמצעות כלי בינה מלאכותית או כל אמצעי
   אוטומטי אחר. עצם היכולת לצפות בקוד המקור בדפדפן אינה מעניקה כל רישיון.

   Proprietary. Unauthorized copying, distribution, modification, or derivative
   works — including reproduction by AI tools or any automated means — are
   prohibited. Source visibility in a browser grants no license.

   תנאים מלאים: קובץ LICENSE שבשורש הפרויקט.  ·  רישוי: sg@taharat.org
   ========================================================================== */

/* Service Worker מינימלי — מאפשר התקנת המערכת כאפליקציה (PWA) במסך הבית.
   בכוונה ללא שמירת מטמון (network pass-through), כדי שלעולם לא תוצג גרסה ישנה
   של התוכנה — כל בקשה עוברת ישירות לרשת. */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){ /* מעבר שקוף לרשת — בלי מטמון */ });
