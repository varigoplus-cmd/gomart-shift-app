/* Service worker — ເຮັດໃຫ້ແອັບເປີດໄດ້ເຖິງບໍ່ມີເນັດ */
const CACHE = 'gomart-shift-1.4.5';
const V = '1.4.5';   /* ຕ້ອງຕົງກັບ ?v= ໃນ index.html */
const ASSETS = [
  './index.html', './manifest.json',
  './img/logo-64.png', './img/logo-96.png', './img/logo-180.png',
  './img/logo-192.png', './img/logo-512.png',
  './css/style.css?v=' + V,
  './js/config.js?v=' + V, './js/db.js?v=' + V, './js/util.js?v=' + V,
  './js/app.js?v=' + V, './js/screens2.js?v=' + V
];
self.addEventListener('install', e => {
  /* ເກັບທີ່ລະໄຟລ໌ — ຖ້າໄຟລ໌ໃດໜຶ່ງພາດ ກໍ່ຍັງຕິດຕັ້ງໄດ້ */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
