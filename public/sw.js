// App-shell cache so the worker app still opens with no network, plus background alerts (Web Push).
// API calls are never cached here; the app keeps its own last-known plan in localStorage.
const CACHE = 'heatmitra-v2';
const SHELL = ['/', '/index.html', '/styles.css', '/heat.js', '/i18n.js', '/app.js', '/manifest.webmanifest'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html'))));
});

// Pushes carry no payload: fetch this phone's latest notice from the server and show it.
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let n = { title: 'HeatMitra', body: 'Open HeatMitra', tag: 'heatmitra', urgent: true };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const r = await fetch('/api/push/latest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub && sub.endpoint }) });
      if (r.ok) n = await r.json();
    } catch {}
    await self.registration.showNotification(n.title || 'HeatMitra', {
      body: n.body, tag: n.tag || 'heatmitra', renotify: true, requireInteraction: Boolean(n.urgent), vibrate: [400, 150, 400, 150, 400],
    });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => (ws.length ? ws[0].focus() : self.clients.openWindow('/'))));
});
