const CACHE = 'lifequest-v1.6.1-github';
const ASSETS = ['./', './index.html', './style.css', './app.js', './features.js', './schedule.js', './pwa.js', './cloud.js', './cloud-config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lifequest-') && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok && response.type === 'basic') { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); }
    return response;
  })));
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
