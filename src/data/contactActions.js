import { Linking, Platform, Share } from 'react-native';
import { statusLabel, trackUrl, qrImageUrl } from './repairTracking';
import { showAlert } from '../utils/dialog';

export function normalizePhone(phone) {
  const raw = String(phone || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
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
    showAlert('ไม่มีเบอร์', 'ผู้แจ้งไม่ได้ใส่เบอร์โทร');
    return false;
  }
  try {
    const can = await Linking.canOpenURL(href);
    if (!can && Platform.OS !== 'web') {
      showAlert('โทรไม่ได้', 'อุปกรณ์นี้ไม่รองรับการโทร');
      return false;
    }
    await Linking.openURL(href);
    return true;
  } catch (_) {
    showAlert('โทรไม่ได้', href);
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
      showAlert('คัดลอกแล้ว', 'วางใน LINE / แชทได้เลย');
      return 'copied';
    }
    showAlert('ลิงก์ติดตาม', link || message);
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

/** Download / share QR PNG so it can be opened from the device gallery */
export async function saveQrToGallery(trackToken, jobNum) {
  const link = trackToken ? trackUrl(trackToken) : '';
  if (!link) {
    showAlert('ไม่มี QR', 'งานนี้ยังไม่มีลิงก์ติดตาม');
    return false;
  }
  const qrUrl = qrImageUrl(link, 512);
  const filename = `sombat-track-${jobNum || trackToken}.png`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
      showAlert('บันทึกแล้ว', 'เปิดไฟล์จาก Downloads / แกลเลอรี แล้วใช้กล้องสแกนได้');
      return true;
    } catch (_) {
      if (typeof window !== 'undefined') window.open(qrUrl, '_blank');
      showAlert('เปิดรูป QR แล้ว', 'กดค้างที่รูป → บันทึกลงรูปภาพ');
      return false;
    }
  }

  try {
    await Share.share({ message: link, url: qrUrl, title: filename });
    return true;
  } catch (_) {
    try {
      await Linking.openURL(qrUrl);
      return true;
    } catch (e) {
      showAlert('บันทึกไม่ได้', link);
      return false;
    }
  }
}
