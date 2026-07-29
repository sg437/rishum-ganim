/* Service Worker מינימלי — מאפשר התקנת המערכת כאפליקציה (PWA) במסך הבית.
   בכוונה ללא שמירת מטמון (network pass-through), כדי שלעולם לא תוצג גרסה ישנה
   של התוכנה — כל בקשה עוברת ישירות לרשת. */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){ /* מעבר שקוף לרשת — בלי מטמון */ });
