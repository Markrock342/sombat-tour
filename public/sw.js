/* PWA service worker — same-origin cache + Web Push (do NOT intercept API) */
const CACHE = 'sombat-tour-v8';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        '/',
        '/manifest.json',
        '/logo192.png',
        '/logo512.png',
        '/favicon.png',
        '/splash-wordmark.png',
      ])
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))).then(() =>
        self.clients.claim()
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch (_) {
    return;
  }

  // สำคัญ: อย่าดัก fetch ไป 425store.com/api — ถ้าเน็ตหลุด/timeout
  // แล้ว fallback เป็น caches.match('/') จะได้ HTML ของแอป
  // แล้วหน้า Dashboard คิดว่า API ตอบ HTML (HTTP 200)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => res)
      .catch((err) =>
        caches.match(event.request).then((hit) => {
          if (hit) return hit;
          // fallback แอปเฉพาะตอนเปิดหน้า (navigate) — ไม่ใช้กับ asset อื่น
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return Promise.reject(err);
        })
      )
  );
});

self.addEventListener('push', (event) => {
  let title = 'สมบัติทัวร์';
  let body = 'มีงานแจ้งซ่อมใหม่ — แตะเพื่อเปิดดู';
  let url = '/';
  try {
    if (event.data) {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.url) url = data.url;
    }
  } catch (_) {
    try {
      const text = event.data && event.data.text();
      if (text) body = text;
    } catch (__) {}
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/logo192.png',
      badge: '/favicon-48.png',
      tag: 'sombat-repair-alert',
      renotify: true,
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const c = clientList[i];
        if (c.url && 'focus' in c) {
          c.focus();
          if (c.navigate) c.navigate(target);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});
