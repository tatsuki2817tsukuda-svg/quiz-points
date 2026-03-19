const CACHE_NAME = 'quiz-points-v6';
const assets = [
  './',
  './index.html',
  './style.css',
  './app.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Outfit:wght@400;600;800&display=swap'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // 即座に新しいSWを有効化
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('activate', (e) => {
  // 古いキャッシュを削除
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // 全タブに即時反映
  );
});

self.addEventListener('fetch', (e) => {
  // ネットワーク優先（最新ファイルを取得、失敗時のみキャッシュを使用）
  e.respondWith(
    fetch(e.request).then(res => {
      const resClone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
