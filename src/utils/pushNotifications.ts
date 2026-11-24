export type PushPermissionState = NotificationPermission | 'unsupported';

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestTradePushPermission(userId: string): Promise<{
  permission: PushPermissionState;
  subscribed: boolean;
}> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { permission: 'unsupported', subscribed: false };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { permission, subscribed: false };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSub = await registration.pushManager?.getSubscription().catch(() => null);

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        enabled: true,
        endpoint: existingSub?.endpoint || `sw-local://${userId}`,
      }),
    });

    return { permission, subscribed: true };
  } catch {
    return { permission, subscribed: true };
  }
}

export async function dispatchServiceWorkerTradeNotification(payload: {
  title: string;
  body: string;
  tradeId?: string;
  tag?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: 'SHOW_TRADE_NOTIFICATION',
        title: payload.title,
        body: payload.body,
        tradeId: payload.tradeId || '',
        tag: payload.tag || `kromacard-trade-${payload.tradeId || Date.now()}`,
        url: '/?tab=bazaar',
      });
      return true;
    }

    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || 'kromacard-trade',
      data: { url: '/?tab=bazaar', tradeId: payload.tradeId || '' },
    });
    return true;
  } catch {
    return false;
  }
}
