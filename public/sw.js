// Mosa Service Worker for Web Push & Notification Handling
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push events (if backend WebPush is configured)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Mosa';
    const options = {
      body: data.body || 'New message received',
      icon: data.icon || '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [150, 80, 150],
      data: {
        url: data.url || '/',
        chatId: data.chatId,
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Mosa', {
        body: text,
        icon: '/favicon.ico',
      })
    );
  }
});

// Focus or open window when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
