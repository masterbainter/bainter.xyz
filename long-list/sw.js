// A new version name to force an update and clear old caches.
const CACHE_NAME = 'checklist-pwa-v6'; 
const urlsToCache = [
  './', 
  './index.html',
  './app.js?v=7', // The version must match the one in index.html
  './firebase-init.js'
];
const externalUrlsToCache = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];


// Install event - cache the app shell
self.addEventListener('install', event => {
  console.log('Service Worker: Installing new version...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('Service Worker: Caching app shell');
        // Cache local files
        await cache.addAll(urlsToCache);
        
        // Cache external files with no-cors mode
        const externalRequests = externalUrlsToCache.map(url => 
            new Request(url, { mode: 'no-cors' })
        );
        await cache.addAll(externalRequests);
      })
      .then(() => self.skipWaiting()) // Force the new service worker to become active immediately
  );
});

// Activate event - clean up ALL old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating new version...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache ->', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open pages
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // If the request is for Firebase, ignore it and let it go to the network.
    if (requestUrl.hostname.includes('firebase') || requestUrl.hostname.includes('googleapis')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
        .then(response => {
            // If the request is in the cache, return it.
            if (response) {
              return response;
            }
            // Otherwise, fetch it from the network.
            return fetch(event.request);
        })
    );
});
