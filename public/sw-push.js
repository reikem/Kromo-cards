/* Kromacard PWA Service Worker Push & Background Notification Handler (Trades & Direct Messages) */

function buildNotificationOptions(payload) {
  const isChat = payload.kind === 'chat';
  const defaultUrl = isChat
    ? payload.roomId
      ? `/?tab=chat&room=${encodeURIComponent(payload.roomId)}`
      : '/?tab=chat'
    : '/?tab=bazaar';

  return {
    body: payload.body || (isChat ? 'Tienes un nuevo mensaje en Kromacard.' : 'Tienes una nueva propuesta verificada esperándote en el Bazar.'),
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || (isChat ? `kromacard-chat-${payload.roomId || 'dm'}` : 'kromacard-trade'),
    renotify: true,
    requireInteraction: false,
    vibrate: isChat ? [100, 50, 100] : [140, 60, 140],
    data: {
      url: payload.url || defaultUrl,
      kind: payload.kind || 'trade',
      tradeId: payload.tradeId || '',
      roomId: payload.roomId || '',
    },
    actions: [
      { action: isChat ? 'open-chat' : 'open-trade', title: isChat ? 'Ver mensaje' : 'Ver oferta' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
  };
}

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Nueva notificación en Kromacard',
    body: 'Tienes una actualización en Kromacard.',
    url: '/?tab=bazaar',
    tag: 'kromacard-push',
    kind: 'trade',
    tradeId: '',
    roomId: '',
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
    self.registration.showNotification(payload.title, buildNotificationOptions(payload))
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'SHOW_TRADE_NOTIFICATION') return;

  const isChat = data.kind === 'chat';
  const title = data.title || (isChat ? 'Nuevo mensaje en Kromacard' : 'Nueva oferta de trueque en Kromacard');
  const payload = {
    body: data.body || (isChat ? 'Revisa tu Sala de Amigos para leer el mensaje.' : 'Revisa tu Bazar de Trueque para verificar el intercambio.'),
    tag: data.tag || `kromacard-${isChat ? 'chat' : 'trade'}-${data.tradeId || data.roomId || Date.now()}`,
    url: data.url || (isChat ? '/?tab=chat' : '/?tab=bazaar'),
    kind: data.kind || 'trade',
    tradeId: data.tradeId || '',
    roomId: data.roomId || '',
  };

  event.waitUntil(
    self.registration.showNotification(title, buildNotificationOptions(payload))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') {
    return;
  }

  const data = event.notification.data || {};
  const kind = data.kind || 'trade';
  const tradeId = data.tradeId || '';
  const roomId = data.roomId || '';
  const targetUrl =
    data.url ||
    (kind === 'chat'
      ? roomId
        ? `/?tab=chat&room=${encodeURIComponent(roomId)}`
        : '/?tab=chat'
      : '/?tab=bazaar');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE_NOTIFICATION',
            kind,
            tradeId,
            roomId,
            url: targetUrl,
          });
          if (kind !== 'chat') {
            client.postMessage({
              type: 'NAVIGATE_TRADE',
              tradeId,
            });
          }
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
