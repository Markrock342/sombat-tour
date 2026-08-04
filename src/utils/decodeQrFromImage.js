import jsQR from 'jsqr';

/**
 * Decode QR payload from an image URI (blob:/data:/https:).
 * Works best on web (canvas). Returns the raw QR string.
 */
export async function decodeQrFromImageUri(uri) {
  if (!uri) throw new Error('ไม่มีรูป');

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('สแกนจากแกลเลอรีใช้ได้บนเว็บ — หรือวางลิงก์จาก QR');
  }

  const img = await loadImage(uri);
  const canvas = document.createElement('canvas');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('โหลดรูปไม่สำเร็จ');

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  // Try full size, then downscales if needed (big phone photos)
  const attempts = [
    { data: ctx.getImageData(0, 0, w, h), width: w, height: h },
  ];

  if (w > 900 || h > 900) {
    const scale = Math.min(900 / w, 900 / h);
    const sw = Math.max(1, Math.floor(w * scale));
    const sh = Math.max(1, Math.floor(h * scale));
    const small = document.createElement('canvas');
    small.width = sw;
    small.height = sh;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, sw, sh);
    attempts.push({ data: sctx.getImageData(0, 0, sw, sh), width: sw, height: sh });
  }

  for (const attempt of attempts) {
    const code = jsQR(attempt.data.data, attempt.width, attempt.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code?.data) return String(code.data).trim();
  }

  throw new Error('ไม่พบ QR ในรูปนี้ — ลองถ่ายชัดๆ หรือวางลิงก์แทน');
}

function loadImage(uri) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('เปิดรูปจากแกลเลอรีไม่สำเร็จ'));
    // blob:/data: don't need CORS; remote might
    if (!String(uri).startsWith('blob:') && !String(uri).startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = uri;
  });
}
