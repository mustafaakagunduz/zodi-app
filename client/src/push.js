import { api } from './api.js';

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// Bildirim kullanılamıyorsa nedenini döner.
function blocker() {
  // iPhone'da bildirim yalnızca ana ekrana eklenen sitede çalışır.
  if (window.isSecureContext && isIOS() && !isStandalone()) return 'ios-install';
  const supported =
    window.isSecureContext && 'serviceWorker' in navigator &&
    'PushManager' in window && 'Notification' in window;
  if (!supported) return 'unsupported';
  return Notification.permission === 'denied' ? 'denied' : null;
}

async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager?.getSubscription()) ?? null;
}

const save = (token, subscription) =>
  api('/api/push', { token, method: 'POST', body: subscription.toJSON() });

const toBytes = (base64url) =>
  Uint8Array.from(atob(base64url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const sameKey = (buffer, bytes) => {
  const current = new Uint8Array(buffer ?? []);
  return current.length === bytes.length && current.every((b, i) => b === bytes[i]);
};

// Açılışta mevcut aboneliği sunucuyla eşitler ve durumu döner.
export async function syncPush(token, publicKey) {
  const reason = blocker();
  if (reason) return reason;
  const subscription = await currentSubscription();
  const valid =
    Notification.permission === 'granted' && subscription &&
    sameKey(subscription.options.applicationServerKey, toBytes(publicKey));
  if (!valid) return 'off';
  await save(token, subscription);
  return 'on';
}

// Bir düğme dokunuşundan çağrılmalı: izin penceresi ancak böyle açılır.
export async function enablePush(token, publicKey) {
  const reason = blocker();
  if (reason) return reason;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;
  const key = toBytes(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  await save(token, subscription);
  return 'on';
}

export async function disablePush(token) {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await subscription.unsubscribe();
  if (token) {
    await api('/api/push', { token, method: 'DELETE', body: { endpoint: subscription.endpoint } });
  }
}
