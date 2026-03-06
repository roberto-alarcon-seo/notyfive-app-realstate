// Brokia24 Service Worker — Push + Cache
const CACHE_NAME = 'brokia24-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
];

// Install — precache core assets (do NOT skipWaiting automatically)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Don't call skipWaiting() here — wait for the client to signal via message
});

// Listen for SKIP_WAITING message from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Skip OAuth routes
  if (event.request.url.includes('/~oauth')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'Nuevo lead', body: 'Un cliente quiere información', url: '/inbox' };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    // fallback
  }

  const options = {
    body: data.body || 'Tienes un nuevo cliente interesado',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/inbox' },
    actions: [{ action: 'open', title: 'Ver lead' }],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Nuevo lead recibido', options)
  );

  // Update badge count
  if (navigator.setAppBadge) {
    navigator.setAppBadge((data.badge_count || 1));
  }
});

// Notification click — open/focus app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/inbox';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
