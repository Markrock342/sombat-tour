// เชื่อมต่อ API จริงของ 425store
// บน Vercel ใช้ /api (proxy same-origin) — คอมหลายเครื่องต่อตรง 425store.com ไม่ถึง / โดนบล็อก
const API_ORIGIN = 'https://425store.com/api';

function resolveApiBase() {
  if (typeof window === 'undefined') return API_ORIGIN;
  const host = String(window.location.hostname || '');
  if (host === '425service.vercel.app' || /\.vercel\.app$/i.test(host)) {
    return '/api';
  }
  return API_ORIGIN;
}

export const API_BASE = resolveApiBase();

/** Default request timeout — proxy + PHP ช้าได้ */
export const API_TIMEOUT_MS = 20000;

let _authToken = null;

export function setAuthToken(token) {
  _authToken = token || null;
}

export function getAuthToken() {
  return _authToken;
}

function authHeaders(extra = {}) {
  const h = { ...extra };
  if (_authToken) {
    h.Authorization = `Bearer ${_authToken}`;
    h['X-Auth-Token'] = _authToken;
  }
  return h;
}

/**
 * fetch + AbortController timeout (ใช้แทน fetch ตรงๆ กับ API)
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} [opts]
 */
export async function apiFetch(url, opts = {}) {
  const { timeoutMs = API_TIMEOUT_MS, signal: outerSignal, ...rest } = opts;
  const ctrl = new AbortController();
  const onOuterAbort = () => ctrl.abort();
  if (outerSignal) {
    if (outerSignal.aborted) ctrl.abort();
    else outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  }
  const timer =
    timeoutMs > 0
      ? setTimeout(() => ctrl.abort(), timeoutMs)
      : null;
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error('โหลดช้าเกินกำหนด — ลองใหม่');
      err.code = 'TIMEOUT';
      err.status = 0;
      throw err;
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
  }
}

async function parseJson(res) {
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      const looksHtml = /<b>Fatal error|<!DOCTYPE|<html/i.test(text || '');
      const snippet = String(text || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
      const err = new Error(
        looksHtml
          ? `API ตอบไม่ใช่ JSON (HTTP ${res.status})${snippet ? ` — ${snippet}` : ' — อัปไฟล์ PHP ที่เกี่ยวข้องขึ้น cPanel'}`
          : res.ok
            ? 'เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON'
            : `เซิร์ฟเวอร์ผิดพลาด (HTTP ${res.status})`
      );
      err.status = res.status;
      err.code = 'BAD_RESPONSE';
      throw err;
    }
  }
  if (!data || typeof data !== 'object') {
    const err = new Error(`เซิร์ฟเวอร์ไม่ตอบข้อมูล (HTTP ${res.status})`);
    err.status = res.status;
    err.code = 'EMPTY_RESPONSE';
    throw err;
  }
  if (!data.ok) {
    const msg = data.message || data.error || 'request failed';
    const err = new Error(msg);
    err.code =
      /1142|denied|access violation/i.test(String(msg))
        ? 'DB_PRIVILEGE'
        : data.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

// แปลง Date → "YYYY-MM-DD" (เวลาท้องถิ่น)
export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TH_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function parseYmd(str) {
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3] };
}

export function fmtThaiDate(str) {
  const p = parseYmd(str);
  if (!p) return str || '';
  return `${p.d} ${TH_MONTHS_SHORT[p.mo - 1]} ${p.y + 543}`;
}

export function fmtDateTime(str) {
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}:\d{2}))?/);
  if (!m) return str || '';
  const be = +m[1] + 543;
  const datePart = `${+m[3]}/${m[2]}/${be}`;
  return m[4] ? `${datePart} ${m[4]}` : datePart;
}

async function fetchRepairsForDay(dateStr) {
  const q = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '?date=latest';
  const res = await apiFetch(`${API_BASE}/list_repair.php${q}`);
  return parseJson(res);
}

export async function fetchTechnicians() {
  const res = await apiFetch(`${API_BASE}/technician_list.php?limit=500`);
  const data = await parseJson(res);
  return data.rows || [];
}

/** One request for a date range (avoids N day round-trips). */
export async function fetchRepairs(start, end) {
  if (!start) return fetchRepairsForDay(null);

  const startDate = start instanceof Date ? start : new Date(`${start}T00:00:00`);
  const endDate = end
    ? end instanceof Date
      ? end
      : new Date(`${end}T00:00:00`)
    : startDate;
  const startStr = fmtDate(startDate);
  const endStr = fmtDate(endDate);

  if (startStr === endStr) return fetchRepairsForDay(startStr);

  const qs = new URLSearchParams({
    start: startStr,
    end: endStr,
    limit: '10000',
  });
  const res = await apiFetch(`${API_BASE}/list_repair.php?${qs.toString()}`);
  const data = await parseJson(res);
  return {
    ok: data.ok !== false,
    date: data.date || `${startStr}..${endStr}`,
    total: data.total ?? (data.rows || []).length,
    rows: data.rows || [],
  };
}

export async function fetchPending() {
  const res = await apiFetch(`${API_BASE}/backlog.php`);
  return parseJson(res);
}

/** Open jobs: all, one technician, or unnamed. */
export async function fetchPendingJobs(tech) {
  const name = tech == null ? null : String(tech).trim();

  // Named tech — works on current production backlog.php
  if (name && name !== 'ไม่ระบุช่าง') {
    const qs = new URLSearchParams({ tech: name, limit: '2000' });
    const res = await fetch(`${API_BASE}/backlog.php?${qs.toString()}`);
    return parseJson(res);
  }

  const qs = new URLSearchParams({ jobs: '1', limit: '2000' });
  if (name === '' || name === 'ไม่ระบุช่าง') qs.set('none', '1');

  const res = await fetch(`${API_BASE}/backlog.php?${qs.toString()}`);
  const data = await parseJson(res);
  const rows = data.rows || [];

  // Older server without jobs=1 returns count rows {name,pending} — fan-out by tech
  if (rows.length && rows[0].r_id == null && rows[0].pending != null) {
    if (qs.get('none')) return { ok: true, rows: [] };
    const parts = await Promise.all(
      rows
        .filter((r) => r.name)
        .map(async (r) => {
          const partRes = await fetch(
            `${API_BASE}/backlog.php?tech=${encodeURIComponent(r.name)}&limit=2000`
          );
          return parseJson(partRes);
        })
    );
    return { ok: true, rows: parts.flatMap((p) => p.rows || []) };
  }

  return data;
}

export async function getVehicle(id) {
  const res = await fetch(`${API_BASE}/vehicle_get.php?id=${encodeURIComponent(id)}`);
  const data = await parseJson(res);
  return data.row || null;
}

export async function searchVehicles(term) {
  const t = String(term || '').trim();
  if (!t) return [];

  let rows = [];
  // Prefer search.php (model/brand + compact match after API deploy)
  try {
    const data = await globalSearch({ q: t, type: 'vehicle', limit: 50, sort: 'name' });
    rows = data.vehicles || [];
  } catch (_) {
    rows = [];
  }

  if (!rows.length) {
    try {
      const res = await fetch(
        `${API_BASE}/vehicle_search.php?name=${encodeURIComponent(t)}&limit=50`
      );
      const data = await parseJson(res);
      rows = data.rows || [];
    } catch (_) {
      rows = [];
    }
  }

  if (/^\d+$/.test(t)) {
    try {
      const row = await getVehicle(t);
      if (row && !rows.some((v) => String(v.v_id) === String(row.v_id))) {
        rows = [row, ...rows];
      }
    } catch (_) {
      /* skip */
    }
  }
  return rows;
}

/** Global search across repairs + vehicles */
export async function globalSearch({
  q = '',
  type = 'all',
  dateStart,
  dateEnd,
  technicianId,
  technician,
  status,
  jobKind,
  sort = 'date_desc',
  limit = 50,
  offset = 0,
} = {}) {
  const run = async (query) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (type) params.set('type', type);
    if (dateStart) params.set('date_start', dateStart);
    if (dateEnd) params.set('date_end', dateEnd);
    if (technicianId) params.set('technician_id', String(technicianId));
    if (technician) params.set('technician', technician);
    if (status) params.set('status', status);
    if (jobKind) params.set('job_kind', jobKind);
    if (sort) params.set('sort', sort);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const res = await fetch(`${API_BASE}/search.php?${params}`);
    return parseJson(res);
  };

  let data = await run(q);
  // "euro5" → also try "euro 5" when no hits (จน API compact อัปขึ้นเซิร์ฟเวอร์)
  if ((data.total || 0) === 0 && q) {
    const spaced = String(q)
      .replace(/([A-Za-z\u0E00-\u0E7F])(\d)/g, '$1 $2')
      .replace(/(\d)([A-Za-z\u0E00-\u0E7F])/g, '$1 $2');
    if (spaced !== q) data = await run(spaced);
  }
  return data;
}

export async function getRepair(id) {
  const res = await fetch(`${API_BASE}/repair_get.php?id=${encodeURIComponent(id)}`);
  const data = await parseJson(res);
  return data.row || null;
}

export async function createRepair(payload) {
  const res = await fetch(`${API_BASE}/repair_create.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateRepair(payload) {
  const res = await fetch(`${API_BASE}/repair_update.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteRepair(rId) {
  const res = await fetch(`${API_BASE}/repair_delete.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ r_id: rId }),
  });
  return parseJson(res);
}

export async function fetchRepairImages(rId) {
  const res = await fetch(`${API_BASE}/repair_images.php?r_id=${encodeURIComponent(rId)}`);
  const data = await parseJson(res);
  return data.rows || [];
}

async function appendImageToForm(form, uri, fileName, mime) {
  // RN Web: FormData needs a Blob/File. Native: { uri, name, type }.
  if (typeof window !== 'undefined' && typeof fetch === 'function' && uri && !uri.startsWith('file:')) {
    try {
      const blobRes = await fetch(uri);
      const blob = await blobRes.blob();
      const type = mime || blob.type || 'image/jpeg';
      form.append('image', blob, fileName || 'photo.jpg');
      return;
    } catch (_) {
      /* fall through */
    }
  }
  form.append('image', {
    uri,
    name: fileName || 'photo.jpg',
    type: mime || 'image/jpeg',
  });
}

export async function uploadRepairImage(rId, uri, fileName = 'photo.jpg', mime = 'image/jpeg') {
  const form = new FormData();
  form.append('r_id', String(rId));
  await appendImageToForm(form, uri, fileName, mime);
  const res = await fetch(`${API_BASE}/upload_image.php`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  return parseJson(res);
}

export async function deleteRepairImage(imageId) {
  const res = await fetch(`${API_BASE}/delete_image.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: imageId }),
  });
  return parseJson(res);
}

export async function createPublicRepair(payload) {
  const res = await fetch(`${API_BASE}/report_public.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function fetchTrackByToken(token) {
  const res = await fetch(`${API_BASE}/track.php?token=${encodeURIComponent(token)}`);
  return parseJson(res);
}

export async function fetchRepairTracking(rId) {
  const res = await fetch(`${API_BASE}/repair_tracking.php?r_id=${encodeURIComponent(rId)}`, {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function updateRepairStatus({ r_id, status, note = '' }) {
  const res = await fetch(`${API_BASE}/repair_status.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ r_id, status, note }),
  });
  return parseJson(res);
}

export async function uploadPublicRepairImage(rId, trackToken, uri, fileName = 'photo.jpg', mime = 'image/jpeg') {
  const form = new FormData();
  form.append('r_id', String(rId));
  form.append('track_token', trackToken);
  await appendImageToForm(form, uri, fileName, mime);
  const res = await fetch(`${API_BASE}/upload_image_public.php`, {
    method: 'POST',
    body: form,
  });
  return parseJson(res);
}

export async function fetchVehicleHistory({ vehicle, vId, vName, vPlate, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (vehicle) params.set('vehicle', vehicle);
  if (vId) params.set('v_id', String(vId));
  if (vName) params.set('v_name', vName);
  if (vPlate) params.set('v_plate', vPlate);
  params.set('limit', String(limit));
  const res = await fetch(`${API_BASE}/vehicle_history.php?${params}`);
  return parseJson(res);
}

export async function login(username, pin) {
  const user = String(username || '').trim();
  const pass = String(pin || '');
  if (!user || !pass) {
    const err = new Error('กรอกชื่อผู้ใช้และรหัสผ่าน');
    err.code = 'MISSING_CREDENTIALS';
    throw err;
  }

  // ระบบเดิม: login.php รับ inpUser / inpPass (member.m_user + m_pass bcrypt)
  const form = new URLSearchParams();
  form.set('inpUser', user);
  form.set('inpPass', pass);
  const res = await fetch(`${API_BASE}/login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = await parseJson(res);
  const profile = data.user || {};
  // session ฝั่ง client — login.php ไม่ออก token
  const tokenPayload = {
    u: {
      id: profile.id,
      username: profile.username || user,
      level: profile.level,
      role: profile.level,
      fname: profile.fname || '',
      lname: profile.lname || '',
      job: profile.job || '',
    },
    t: Date.now(),
  };
  let token = '';
  try {
    token =
      'local:' +
      (typeof btoa === 'function'
        ? btoa(unescape(encodeURIComponent(JSON.stringify(tokenPayload))))
        : Buffer.from(JSON.stringify(tokenPayload), 'utf8').toString('base64'));
  } catch (_) {
    token = 'local:' + JSON.stringify(tokenPayload);
  }

  return {
    ok: true,
    token,
    expires: null,
    user: tokenPayload.u,
  };
}

export async function logout() {
  try {
    if (_authToken && !String(_authToken).startsWith('local:')) {
      const res = await fetch(`${API_BASE}/auth.php`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'logout' }),
      });
      await parseJson(res);
    }
  } catch (_) {
    /* ignore */
  }
}

function decodeLocalSession(token) {
  const raw = String(token || '');
  if (!raw.startsWith('local:')) return null;
  const body = raw.slice(6);
  try {
    const json =
      typeof atob === 'function'
        ? decodeURIComponent(escape(atob(body)))
        : Buffer.from(body, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload?.u || null;
  } catch (_) {
    try {
      return JSON.parse(body)?.u || null;
    } catch (__) {
      return null;
    }
  }
}

export async function fetchMe() {
  if (_authToken && String(_authToken).startsWith('local:')) {
    const user = decodeLocalSession(_authToken);
    if (!user) {
      const err = new Error('SESSION_EXPIRED');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    return { ok: true, user };
  }
  const res = await fetch(`${API_BASE}/auth.php?action=me`, {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function fetchBoard() {
  const res = await fetch(`${API_BASE}/board_list.php`);
  const data = await parseJson(res);
  return data.rows || [];
}

export async function createBoardNote(payload) {
  const res = await fetch(`${API_BASE}/board_create.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateBoardNote(payload) {
  const res = await fetch(`${API_BASE}/board_update.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteBoardNote(id) {
  const res = await fetch(`${API_BASE}/board_delete.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id }),
  });
  return parseJson(res);
}

export async function fetchBreakdowns({ q = '', status = '', limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  params.set('limit', String(limit));
  const res = await apiFetch(`${API_BASE}/breakdown_list.php?${params}`);
  return parseJson(res);
}

export async function fetchLocations(vId) {
  const q = vId ? `?v_id=${encodeURIComponent(vId)}` : '';
  const res = await fetch(`${API_BASE}/location_list.php${q}`);
  const data = await parseJson(res);
  return data.rows || [];
}

export async function saveLocation(payload) {
  const res = await fetch(`${API_BASE}/location_save.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteLocation(id) {
  const res = await fetch(`${API_BASE}/location_delete.php`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id }),
  });
  return parseJson(res);
}

/** Match repair row to technician by id first, then name */
export function repairMatchesTech(repair, tech) {
  if (!tech) return true;
  const wantId = tech.id != null ? String(tech.id) : '';
  const wantName = (tech.queryName ?? tech.name ?? '').trim();
  const rowId = repair.r_technician_id != null ? String(repair.r_technician_id) : '';
  const rowName = (repair.r_technician || '').trim();

  if (wantName === '' || wantName === 'ไม่ระบุช่าง') {
    return !rowName && !rowId;
  }
  if (wantId && rowId && wantId === rowId) return true;
  if (wantId && rowId) return false;
  return rowName === wantName;
}

export function isOpenRepair(r) {
  return !r.r_close || r.r_close === '0' || r.r_close === 0;
}

/** งานเสียกลางทาง — r_job_subtype_id = 2 (ตามระบบเดิม) */
export const BREAKDOWN_SUBTYPE_ID = '2';

export function isBreakdownRepair(r) {
  if (!r) return false;
  if (String(r.r_job_subtype_id) === BREAKDOWN_SUBTYPE_ID) return true;
  const t = String(r.r_type || '').toLowerCase();
  if (t === 'breakdown' || t === 'roadside') return true;
  return String(r.r_repair_list || '').includes('เสียกลางทาง');
}
