// Service worker tối thiểu — chỉ để đủ điều kiện cho trình duyệt hiện nút "Cài đặt app".
// Không cache gì đặc biệt, mọi request đều đi thẳng ra mạng như bình thường.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
