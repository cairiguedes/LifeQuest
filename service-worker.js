const CACHE = 'lifequest-v1.6.1-mobile-sync-20261123';
const ASSETS = ['./', './index.html', './style.css', './app.js', './features.js', './schedule.js', './pwa.js', './cloud.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lifequest-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  // Never cache configuration or API calls. Prevent outdated cloud settings.
  if (url.pathname.endsWith('/cloud-config.js')) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});

self.addEventListener('push', event => {
  let payload = {title:'LifeQuest',body:'Você tem uma missão agendada.'};
  try {payload = {...payload,...event.data.json()}} catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body:payload.body,icon:'./icon-192.png',badge:'./icon-192.png',
    tag:payload.tag||'lifequest-reminder',data:{url:self.registration.scope}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    const existing=windows.find(w=>w.url.startsWith(self.registration.scope));
    if(existing)return existing.focus();
    return clients.openWindow(self.registration.scope);
  }));
});
