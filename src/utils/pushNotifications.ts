import { registerSW } from 'virtual:pwa-register';

export type PushPermissionState = NotificationPermission | 'unsupported';

let swRegisterInitialized = false;

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return null;
    const data = (await res.json()) as { vapidPublicKey?: string };
    return data.vapidPublicKey?.trim() || null;
  } catch {
    return null;
  }
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (!swRegisterInitialized) {
    swRegisterInitialized = true;
    try {
      registerSW({
        immediate: true,
        onRegisterError() {
          // Dev/preview environments may restrict SW registration gracefully
        },
      });
    } catch {
      // ignore if virtual:pwa-register cannot initialize in unsupported frame
    }
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      return existing;
    }
    const readyReg = await Promise.race<ServiceWorkerRegistration | null>([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4000)),
    ]);
    return readyReg;
  } catch {
    return null;
  }
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function subscribeUserToPush(
  userId: string,
  providedVapidPublicKey?: string | null,
): Promise<{ subscribed: boolean; hasPushSubscription: boolean }> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    Notification.permission !== 'granted'
  ) {
    return { subscribed: false, hasPushSubscription: false };
  }

  const registration =
    (await registerPushServiceWorker()) ||
    (await navigator.serviceWorker.ready.catch(() => null));
  if (!registration || !('pushManager' in registration)) {
    return { subscribed: false, hasPushSubscription: false };
  }

  const vapidPublicKey = providedVapidPublicKey || (await fetchVapidPublicKey());
  if (!vapidPublicKey) {
    return { subscribed: false, hasPushSubscription: false };
  }

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const currentKey = arrayBufferToBase64Url(subscription.options?.applicationServerKey ?? null);
      if (currentKey && currentKey !== vapidPublicKey) {
        await subscription.unsubscribe().catch(() => false);
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        enabled: true,
        subscription: subscription.toJSON(),
      }),
    });

    return { subscribed: res.ok, hasPushSubscription: true };
  } catch {
    return { subscribed: false, hasPushSubscription: false };
  }
}

export async function requestTradePushPermission(
  userId: string,
  providedVapidPublicKey?: string | null,
): Promise<{
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

  const result = await subscribeUserToPush(userId, providedVapidPublicKey);
  return { permission, subscribed: result.subscribed };
}

export async function dispatchServiceWorkerTradeNotification(payload: {
  title: string;
  body: string;
  kind?: 'trade' | 'gift' | 'chat';
  tradeId?: string;
  roomId?: string;
  url?: string;
  tag?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const isChat = payload.kind === 'chat';
  const targetUrl =
    payload.url ||
    (isChat
      ? payload.roomId
        ? `/?tab=chat&room=${encodeURIComponent(payload.roomId)}`
        : '/?tab=chat'
      : '/?tab=bazaar');

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: 'SHOW_TRADE_NOTIFICATION',
        title: payload.title,
        body: payload.body,
        kind: payload.kind || 'trade',
        tradeId: payload.tradeId || '',
        roomId: payload.roomId || '',
        tag: payload.tag || `kromacard-${isChat ? 'chat' : 'trade'}-${payload.tradeId || payload.roomId || Date.now()}`,
        url: targetUrl,
      });
      return true;
    }

    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || (isChat ? 'kromacard-chat' : 'kromacard-trade'),
      data: {
        url: targetUrl,
        kind: payload.kind || 'trade',
        tradeId: payload.tradeId || '',
        roomId: payload.roomId || '',
      },
    });
    return true;
  } catch {
    return false;
  }
}
