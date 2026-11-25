// Yalnızca bildirimler için; sayfa önbelleklemesi yapmaz.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  const { title = 'Zodi', body = '', url = '/', tag } = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: Boolean(tag),
      icon: '/icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url } = event.notification.data;
  event.waitUntil(
    (async () => {
      const [client] = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (!client) return self.clients.openWindow(url);
      client.postMessage({ type: 'navigate', url });
      return client.focus();
    })(),
  );
});
