const CACHE_NAME = 'quiz-points-v2';
const assets = [
  './',
  './index.html',
  './style.css',
  './app.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Outfit:wght@400;600;800&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
