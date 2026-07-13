import { Platform } from 'react-native';
import { getAuthToken } from './api';

const API_BASE = 'https://425store.com/api';

function authHeaders(extra = {}) {
  const h = { ...extra };
  const token = getAuthToken();
  if (token) {
    h.Authorization = `Bearer ${token}`;
    h['X-Auth-Token'] = token;
  }
  return h;
}

/** Must match api-upload/vapid.php */
export const VAPID_PUBLIC_KEY =
  'BFAywr6R71ilf8y0sbag9qFmiDjj7I5D4EMPDBJ8ndy4wOXmLrcnvptrsDN5wpGksAj3zGwwfAUqcE3tUmoITGk';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushPermission() {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function getExistingSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeStaffPush() {
  if (!pushSupported()) {
    const err = new Error('อุปกรณ์นี้ไม่รองรับแจ้งเตือน PWA');
    err.code = 'UNSUPPORTED';
    throw err;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    const err = new Error(
      permission === 'denied'
        ? 'ถูกปิดแจ้งเตือนไว้ — เปิดในการตั้งค่าเบราว์เซอร์/ระบบ'
        : 'ยังไม่ได้อนุญาตแจ้งเตือน'
    );
    err.code = 'DENIED';
    throw err;
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const res = await fetch(`${API_BASE}/push_subscribe.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(sub.toJSON()),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    const err = new Error('สมัครแจ้งเตือนไม่สำเร็จ — อัป push_*.php ขึ้น cPanel');
    err.code = 'BAD_RESPONSE';
    throw err;
  }
  if (!data.ok) {
    const err = new Error(data.message || data.error || 'subscribe failed');
    err.code = data.error;
    throw err;
  }
  return sub;
}

export async function unsubscribeStaffPush() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try {
      await fetch(`${API_BASE}/push_unsubscribe.php`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch (_) {}
    await sub.unsubscribe();
  } else {
    try {
      await fetch(`${API_BASE}/push_unsubscribe.php`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
    } catch (_) {}
  }
  return true;
}
