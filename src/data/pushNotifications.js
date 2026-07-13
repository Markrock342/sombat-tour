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
    const err = new Error('อุปกรณ์นี้ยังไม่รองรับแจ้งเตือน — ลองติดตั้งแอปลงจอโฮม');
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

  let res;
  try {
    res = await fetch(`${API_BASE}/push_subscribe.php`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(sub.toJSON()),
    });
  } catch (e) {
    const err = new Error(
      'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — อัปไฟล์ push_subscribe.php, push_lib.php, vapid.php ขึ้น 425store.com/api/'
    );
    err.code = 'NETWORK';
    err.cause = e;
    throw err;
  }
  const text = await res.text();
  if (res.status === 404) {
    const err = new Error(
      'ยังไม่มีไฟล์ push บนเซิร์ฟเวอร์ — อัป push_subscribe.php + push_lib.php + vapid.php ขึ้น cPanel'
    );
    err.code = 'NOT_UPLOADED';
    throw err;
  }
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    const snippet = String(text || '')
      .replace(/\s+/g, ' ')
      .slice(0, 120);
    const err = new Error(
      snippet
        ? `เซิร์ฟเวอร์ตอบผิดรูปแบบ (${res.status}) — มักเพราะ push_lib.php อัปผิดไฟล์: ${snippet}`
        : 'เซิร์ฟเวอร์ตอบว่าง — อัป push_lib.php จาก api-upload ใหม่ (อย่าใช้ไฟล์อื่นชื่อซ้ำ)'
    );
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

/** Local OS notification (immediate) */
export async function showLocalTestNotification() {
  if (!pushSupported()) {
    const err = new Error('อุปกรณ์ไม่รองรับ');
    err.code = 'UNSUPPORTED';
    throw err;
  }
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') {
      const err = new Error('ยังไม่อนุญาตแจ้งเตือน');
      err.code = 'DENIED';
      throw err;
    }
  }
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('สมบัติทัวร์ · ทดสอบ', {
    body: 'ถ้าเห็นข้อความนี้ แสดงว่าระบบแจ้งเตือนบนเครื่องนี้พร้อมใช้งาน',
    icon: '/logo192.png',
    badge: '/favicon-48.png',
    tag: 'sombat-test',
    data: { url: '/' },
  });
  return true;
}

/** Server → push to this user's subscribed devices */
export async function sendServerTestPush() {
  let res;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 22000) : null;
  try {
    res = await fetch(`${API_BASE}/push_test.php`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: '{}',
      signal: ctrl ? ctrl.signal : undefined,
    });
  } catch (e) {
    const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
    const err = new Error(
      aborted
        ? 'เซิร์ฟเวอร์ตอบช้าเกิน — อัป push_test.php ชุดใหม่ขึ้น cPanel แล้วลองอีกครั้ง'
        : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจเน็ต หรืออัป push_test.php + bootstrap.php ขึ้น cPanel'
    );
    err.code = aborted ? 'TIMEOUT' : 'NETWORK';
    err.cause = e;
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
  const text = await res.text();
  if (res.status === 404) {
    const err = new Error('ยังไม่มี push_test.php บนเซิร์ฟเวอร์ — อัปขึ้น cPanel');
    err.code = 'NOT_UPLOADED';
    throw err;
  }
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    const snippet = String(text || '')
      .replace(/\s+/g, ' ')
      .slice(0, 120);
    const err = new Error(
      snippet
        ? `เซิร์ฟเวอร์ตอบผิดรูปแบบ (${res.status}): ${snippet}`
        : 'เซิร์ฟเวอร์ตอบว่าง — อัป bootstrap.php + push_test.php ใหม่'
    );
    err.code = 'BAD_RESPONSE';
    throw err;
  }
  if (!data.ok) {
    const err = new Error(data.message || data.error || 'test failed');
    err.code = data.error;
    throw err;
  }
  return data;
}

