export const PUBLIC_STATUSES = [
  { key: 'submitted', label: 'แจ้งแล้ว', color: '#64748B' },
  { key: 'received', label: 'รับเรื่องแล้ว', color: '#2563EB' },
  { key: 'assigned', label: 'มอบหมายช่างแล้ว', color: '#7C3AED' },
  { key: 'in_progress', label: 'กำลังซ่อม', color: '#D97706' },
  { key: 'waiting_parts', label: 'รออะไหล่', color: '#DC2626' },
  { key: 'done', label: 'ซ่อมเสร็จ', color: '#059669' },
  { key: 'closed', label: 'ปิดงาน', color: '#374151' },
];

export function statusLabel(key) {
  return PUBLIC_STATUSES.find((s) => s.key === key)?.label || key;
}

export function statusColor(key) {
  return PUBLIC_STATUSES.find((s) => s.key === key)?.color || '#64748B';
}

export function trackUrl(token) {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://425service.vercel.app';
  return `${base}/track/${encodeURIComponent(token)}`;
}

export function qrImageUrl(url, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(url)}`;
}

/** Extract token from pasted URL or raw token string */
export function parseTrackToken(input) {
  let t = String(input ?? '').trim();
  if (!t || t === 'undefined' || t === 'null') return '';
  const m = t.match(/\/track\/([^/?#]+)/i);
  if (m) {
    t = decodeURIComponent(m[1]);
    if (!t || t === 'undefined' || t === 'null') return '';
    return t;
  }
  if (t.includes('token=')) {
    try {
      const u = new URL(t.startsWith('http') ? t : `https://x/?${t.replace(/^\?/, '')}`);
      const q = u.searchParams.get('token');
      if (q && q !== 'undefined' && q !== 'null') return q;
    } catch (_) {
      /* ignore */
    }
  }
  return t;
}
