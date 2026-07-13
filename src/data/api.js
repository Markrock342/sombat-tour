// เชื่อมต่อ API จริงของ 425store + endpoints ใหม่ใน repo นี้
export const API_BASE = 'https://425store.com/api';

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

async function parseJson(res) {
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      const err = new Error(
        res.ok
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

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => {
  const r = startOfDay(d);
  r.setDate(r.getDate() + n);
  return r;
};

function eachDayInRange(start, end) {
  const days = [];
  let d = startOfDay(start);
  const last = startOfDay(end);
  while (d <= last) {
    days.push(fmtDate(d));
    d = addDays(d, 1);
  }
  return days;
}

async function fetchRepairsForDay(dateStr) {
  const q = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '?date=latest';
  const res = await fetch(`${API_BASE}/list_repair.php${q}`);
  return parseJson(res);
}

export async function fetchTechnicians() {
  const res = await fetch(`${API_BASE}/technician_list.php?limit=500`);
  const data = await parseJson(res);
  return data.rows || [];
}

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

  const parts = await Promise.all(eachDayInRange(startDate, endDate).map(fetchRepairsForDay));
  const seen = new Set();
  const rows = [];
  for (const part of parts) {
    for (const row of part.rows || []) {
      const id = String(row.r_id || row.r_job_num || '');
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      rows.push(row);
    }
  }
  return { ok: true, date: `${startStr}..${endStr}`, total: rows.length, rows };
}

export async function fetchPending() {
  const res = await fetch(`${API_BASE}/backlog.php`);
  return parseJson(res);
}

export async function fetchPendingJobs(tech) {
  const res = await fetch(`${API_BASE}/backlog.php?tech=${encodeURIComponent(tech)}`);
  return parseJson(res);
}

export async function getVehicle(id) {
  const res = await fetch(`${API_BASE}/vehicle_get.php?id=${encodeURIComponent(id)}`);
  const data = await parseJson(res);
  return data.row || null;
}

export async function searchVehicles(term) {
  const res = await fetch(
    `${API_BASE}/vehicle_search.php?name=${encodeURIComponent(term)}&limit=50`
  );
  const data = await parseJson(res);
  let rows = data.rows || [];

  if (/^\d+$/.test(term)) {
    try {
      const row = await getVehicle(term);
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
  const params = new URLSearchParams();
  if (q) params.set('q', q);
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

export async function fetchRepairImages(rId) {
  const res = await fetch(`${API_BASE}/repair_images.php?r_id=${encodeURIComponent(rId)}`);
  const data = await parseJson(res);
  return data.rows || [];
}

export async function uploadRepairImage(rId, uri, fileName = 'photo.jpg', mime = 'image/jpeg') {
  const form = new FormData();
  form.append('r_id', String(rId));
  form.append('image', {
    uri,
    name: fileName,
    type: mime,
  });
  const res = await fetch(`${API_BASE}/upload_image.php`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
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
  form.append('image', {
    uri,
    name: fileName,
    type: mime,
  });
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
  const res = await fetch(`${API_BASE}/auth.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username, pin }),
  });
  return parseJson(res);
}

export async function logout() {
  try {
    const res = await fetch(`${API_BASE}/auth.php`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'logout' }),
    });
    await parseJson(res);
  } catch (_) {
    /* ignore */
  }
}

export async function fetchMe() {
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
  const res = await fetch(`${API_BASE}/breakdown_list.php?${params}`);
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
