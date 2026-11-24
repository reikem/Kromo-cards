/* Kromacard PWA Service Worker Push & Background Trade Notification Handler */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Nueva oferta de trueque en Kromacard',
    body: 'Tienes una nueva propuesta verificada esperándote en el Bazar.',
    url: '/?tab=bazaar',
    tag: 'kromacard-trade',
    tradeId: '',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || 'kromacard-trade',
      renotify: true,
      vibrate: [140, 60, 140],
      data: {
        url: payload.url || '/?tab=bazaar',
        tradeId: payload.tradeId || '',
      },
      actions: [
        { action: 'open-trade', title: 'Ver oferta' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'SHOW_TRADE_NOTIFICATION') return;

  const title = data.title || 'Nueva oferta de trueque en Kromacard';
  const body = data.body || 'Revisa tu Bazar de Trueque para verificar el intercambio.';
  const tag = data.tag || `kromacard-trade-${Date.now()}`;
  const url = data.url || '/?tab=bazaar';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag,
      renotify: true,
      vibrate: [140, 60, 140],
      data: {
        url,
        tradeId: data.tradeId || '',
      },
      actions: [
        { action: 'open-trade', title: 'Ver oferta' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/?tab=bazaar';
  const tradeId = (event.notification.data && event.notification.data.tradeId) || '';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE_TRADE',
            tradeId,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
