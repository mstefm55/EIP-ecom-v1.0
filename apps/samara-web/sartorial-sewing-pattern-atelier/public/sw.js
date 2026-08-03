// Sartorial Atelier - Offline Resilient Service Worker
const CACHE_VERSION = 'v1.1.0';
const STATIC_CACHE_NAME = `sartorial-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `sartorial-dynamic-${CACHE_VERSION}`;
const ERP_DATA_CACHE_NAME = `sartorial-erp-data-${CACHE_VERSION}`;

// Essential UI assets to pre-cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/index.css',
  '/src/data.js',
  '/src/data_positions.js',
];

// Install Event: Create static cache and seed essential paths
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching core shell assets...');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Service Worker] Pre-cache warning (some files will be cached on-demand):', err);
      });
    })
  );
});

// Activate Event: Sweep and purge obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheKeys) => {
      return Promise.all(
        cacheKeys.map((key) => {
          if (
            key !== STATIC_CACHE_NAME &&
            key !== DYNAMIC_CACHE_NAME &&
            key !== ERP_DATA_CACHE_NAME
          ) {
            console.log('[Service Worker] Purging stale cache key:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Check if a request is for ERP pattern data or similar API endpoints
const isApiRequest = (url) => {
  return url.pathname.includes('/api/') || url.pathname.includes('patterns') || url.pathname.includes('sartorial_erp');
};

// Helper: Check if request is for static assets (fonts, styles, scripts, images)
const isStaticAsset = (url) => {
  const ext = url.pathname.split('.').pop() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'ico'].includes(ext.toLowerCase());
  const isWebFont = url.host.includes('fonts.gstatic.com') || url.host.includes('fonts.googleapis.com');
  const isLocalAsset = url.pathname.includes('/src/assets/') || url.pathname.includes('/assets/');

  return (
    isImage ||
    isWebFont ||
    isLocalAsset ||
    ['js', 'jsx', 'css', 'json'].includes(ext.toLowerCase())
  );
};

// Fetch Event: Orchestrate caching strategies depending on resource type
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Strategy A: ERP Pattern Data & APIs -> Network-First with Cache Fallback
  // This guarantees fresh data is always displayed if online, and caches the pushed state.
  if (isApiRequest(requestUrl)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(ERP_DATA_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          console.log('[Service Worker] Offline or network failure. Serving cached ERP pattern data.');
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a offline fallback JSON if there is absolutely no cache
            return new Response(
              JSON.stringify({
                status: 'offline',
                message: 'You are currently offline. Local fallback patterns are active.',
                offlineMode: true,
                patterns: []
              }),
              {
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Strategy B: Static UI Assets (Styles, Scripts, Fonts, Images) -> Stale-While-Revalidate
  // Fast loading from cache, dynamic updates in background
  if (isStaticAsset(requestUrl)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Silence network errors for background fetches when offline
          });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Strategy C: Generic HTML / Documents -> Stale-While-Revalidate with absolute fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // If offline and request is an HTML page document, return root cache fallback
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/');
            }
          })
      );
    })
  );
});
