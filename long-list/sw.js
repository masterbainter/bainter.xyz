// A new version name to force an update and clear old caches.
const CACHE_NAME = 'checklist-pwa-v8'; 

// Only cache the local application files.
// The browser is very efficient at caching external resources like CSS from a CDN.
const urlsToCache = [
  './', 
  './index.html',
  './app.js?v=7', // The version must match the one in index.html
  './firebase-init.js',
  './icon.png'
];


// Install event - cache the app shell
self.addEventListener('install', event => {
  console.log('Service Worker: Installing new version...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching local app shell');
        return cache.addAll(urlsToCache);
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
    // Let the browser handle all non-GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    // For all GET requests, use a "cache-first" strategy.
    event.respondWith(
        caches.match(event.request)
        .then(response => {
            // If the request is in the cache, return it.
            if (response) {
              return response;
            }
            
            // Otherwise, fetch it from the network. The browser will cache it if possible.
            return fetch(event.request);
        })
    );
});
