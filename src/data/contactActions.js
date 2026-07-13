import { Linking, Platform, Share, Alert } from 'react-native';
import { statusLabel, trackUrl } from './repairTracking';

export function normalizePhone(phone) {
  const raw = String(phone || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  // Thai local 08xxxxxxxx → +668xxxxxxxx for LINE/SMS links when needed
  if (raw.startsWith('0') && raw.length >= 9) return raw;
  return raw;
}

export function telHref(phone) {
  const p = normalizePhone(phone);
  return p ? `tel:${p}` : '';
}

export async function callPhone(phone) {
  const href = telHref(phone);
  if (!href) {
    Alert.alert('ไม่มีเบอร์', 'ผู้แจ้งไม่ได้ใส่เบอร์โทร');
    return false;
  }
  try {
    const can = await Linking.canOpenURL(href);
    if (!can && Platform.OS !== 'web') {
      Alert.alert('โทรไม่ได้', 'อุปกรณ์นี้ไม่รองรับการโทร');
      return false;
    }
    await Linking.openURL(href);
    return true;
  } catch (_) {
    Alert.alert('โทรไม่ได้', href);
    return false;
  }
}

export async function copyText(text) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  try {
    await Share.share({ message: text });
    return true;
  } catch (_) {
    return false;
  }
}

export function statusNotifyMessage({ jobNum, status, trackToken, note }) {
  const link = trackToken ? trackUrl(trackToken) : '';
  const parts = [
    `แจ้งซ่อม #${jobNum || '—'}`,
    `สถานะ: ${statusLabel(status) || status}`,
  ];
  if (note) parts.push(`หมายเหตุ: ${note}`);
  if (link) parts.push(`ดูสถานะ: ${link}`);
  return parts.join('\n');
}

export async function shareTrackLink({ jobNum, status, trackToken, note }) {
  const message = statusNotifyMessage({ jobNum, status, trackToken, note });
  const link = trackToken ? trackUrl(trackToken) : '';

  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: `แจ้งซ่อม #${jobNum || ''}`, text: message, url: link || undefined });
      return 'shared';
    }
    await Share.share({ message, url: link || undefined, title: `แจ้งซ่อม #${jobNum || ''}` });
    return 'shared';
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
    const ok = await copyText(link || message);
    if (ok) {
      Alert.alert('คัดลอกแล้ว', 'วางใน LINE / แชทได้เลย');
      return 'copied';
    }
    Alert.alert('ลิงก์ติดตาม', link || message);
    return 'shown';
  }
}

/** Open LINE share (works on mobile / LINE app) */
export async function shareViaLine({ jobNum, status, trackToken, note }) {
  const message = statusNotifyMessage({ jobNum, status, trackToken, note });
  const href = `https://line.me/R/share?text=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(href);
    return true;
  } catch (_) {
    return shareTrackLink({ jobNum, status, trackToken, note });
  }
}
