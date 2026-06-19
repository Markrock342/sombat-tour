// เชื่อมต่อ API จริงของ 425store
export const API_BASE = 'https://425store.com/api';

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

// "2026-06-09" → "9 มิ.ย. 2569"
export function fmtThaiDate(str) {
  const p = parseYmd(str);
  if (!p) return str || '';
  return `${p.d} ${TH_MONTHS_SHORT[p.mo - 1]} ${p.y + 543}`;
}

// "2026-06-09 07:07:01" → "9/06/2569 07:07:01" (แบบระบบต้นทาง)
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

const dayCache = new Map();
let techCache = null;
let techPromise = null;
let rangeApiSupported = null;

// ตรวจว่าเซิร์ฟเวอร์รองรับ ?start=&end= แล้วหรือยัง (หลังแก้ list_repair.php บน cPanel)
export function probeRangeApiOnce() {
  if (rangeApiSupported !== null) return;
  const today = fmtDate(startOfDay(new Date()));
  fetch(
    `${API_BASE}/list_repair.php?start=${encodeURIComponent(today)}&end=${encodeURIComponent(today)}`
  )
    .then((res) => res.json())
    .then((data) => {
      rangeApiSupported = !!(data.ok && data.date === `${today}..${today}`);
    })
    .catch(() => {
      rangeApiSupported = false;
    });
}

async function fetchRepairsForDay(dateStr) {
  const key = dateStr || 'latest';
  if (dayCache.has(key)) return dayCache.get(key);

  const promise = (async () => {
    const q = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '?date=latest';
    const res = await fetch(`${API_BASE}/list_repair.php${q}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'list_repair failed');
    return data;
  })();

  dayCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    dayCache.delete(key);
    throw e;
  }
}

async function fetchRepairsForRange(startStr, endStr) {
  if (!rangeApiSupported) return null;
  try {
    const res = await fetch(
      `${API_BASE}/list_repair.php?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
    );
    const data = await res.json();
    if (!data.ok || data.date !== `${startStr}..${endStr}`) {
      rangeApiSupported = false;
      return null;
    }
    rangeApiSupported = true;
    return data;
  } catch (_) {
    rangeApiSupported = false;
    return null;
  }
}

function mergeRepairRows(parts) {
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
  return rows;
}

// โหลดช่วงวันที่ล่วงหน้า (ตอนเปิดปฏิทิน / กด preset)
export function prefetchRepairRange(start, end) {
  if (!start) return;
  const startDate = start instanceof Date ? start : new Date(`${start}T00:00:00`);
  const endDate = end
    ? end instanceof Date
      ? end
      : new Date(`${end}T00:00:00`)
    : startDate;
  eachDayInRange(startDate, endDate).forEach((d) => {
    fetchRepairsForDay(d).catch(() => null);
  });
}

// โหลดวันอื่น ๆ ไว้ล่วงหน้า (ไม่บล็อก UI) — เปลี่ยนช่วงวันที่จะเร็วขึ้นมาก
export function warmRepairCache(daysBack = 29) {
  const today = startOfDay(new Date());
  const dates = eachDayInRange(addDays(today, -daysBack), today);
  let i = 0;
  const runBatch = () => {
    const batch = dates.slice(i, i + 8);
    i += 8;
    if (!batch.length) return;
    Promise.all(batch.map((d) => fetchRepairsForDay(d).catch(() => null))).finally(() => {
      if (i < dates.length) runBatch();
    });
  };
  runBatch();
}

// รายชื่อช่างทั้งหมด → [{ id, name, v_sort }]
export async function fetchTechnicians() {
  if (techCache) return techCache;
  if (!techPromise) {
    techPromise = (async () => {
      const res = await fetch(`${API_BASE}/technician_list.php?limit=500`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'technician_list failed');
      techCache = data.rows || [];
      return techCache;
    })().catch((e) => {
      techPromise = null;
      throw e;
    });
  }
  return techPromise;
}

// งานแจ้งซ่อมของวันที่ระบุ (หรือช่วงวันที่) → { date, total, rows: [...] }
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

  const ranged = await fetchRepairsForRange(startStr, endStr);
  if (ranged) return ranged;

  const parts = await Promise.all(eachDayInRange(startDate, endDate).map(fetchRepairsForDay));
  const rows = mergeRepairRows(parts);
  return { ok: true, date: `${startStr}..${endStr}`, total: rows.length, rows };
}

// งานค้างซ่อม นับต่อช่าง → { total, rows: [{ name, pending }] }
// หมายเหตุ: ใช้ backlog.php (โฮสต์บล็อก URL ที่มีคำว่า "pending")
export async function fetchPending() {
  const res = await fetch(`${API_BASE}/backlog.php`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'backlog failed');
  return data;
}

// รายการงานค้างของช่างคนเดียว (รวมทั้งหมด) → { rows: [...] }
function isRepairRow(row) {
  return row && (row.r_id || row.r_job_num);
}

async function fetchUnassignedPendingFallback() {
  const end = startOfDay(new Date());
  const start = addDays(end, -365);
  const rep = await fetchRepairs(start, end);
  const rows = (rep.rows || []).filter((r) => {
    if (r.r_close && r.r_close !== '0') return false;
    return !(r.r_technician || '').trim();
  });
  return { ok: true, tech: '', rows };
}

export async function fetchPendingJobs(tech) {
  const techKey = tech ?? '';
  const res = await fetch(`${API_BASE}/backlog.php?tech=${encodeURIComponent(techKey)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'backlog jobs failed');

  const rows = data.rows || [];
  // เซิร์ฟเวอร์เก่า: ?tech= ส่งรายชื่อช่างแทนรายการงาน → ใช้ fallback
  if (rows.length && !isRepairRow(rows[0])) {
    if (techKey === '') return fetchUnassignedPendingFallback();
    throw new Error('backlog returned summary instead of job rows');
  }
  return data;
}

// คืนค่าแรกที่ไม่ว่างจากชื่อคอลัมน์ที่เป็นไปได้หลายแบบ (กันชื่อฟิลด์ใน DB ต่างจากที่คาด)
function pickField(row, keys, dflt = '') {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return dflt;
}

// รายการเบิกอะไหล่ของงาน 1 ใบ (ตาราง used_parts) → [{ id, dt, partId, code, name, lotId, qty, unit }]
export async function fetchJobParts(jobId) {
  if (!jobId) return [];
  const res = await fetch(`${API_BASE}/used_parts.php?job_id=${encodeURIComponent(jobId)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || data.error || 'used_parts failed');
  return (data.rows || []).map((r, i) => ({
    seq: i + 1,
    id: pickField(r, ['up_id', 'id']),
    dt: pickField(r, ['up_dt_rec', 'up_dt', 'up_date', 'up_datetime', 'up_time']),
    partId: pickField(r, ['up_parts_id', 'up_p_id', 'up_part_id']),
    code: pickField(r, ['up_parts_num', 'up_parts_code', 'up_p_code', 'up_code', 'up_part_code']),
    name: pickField(r, ['up_parts_name', 'up_p_name', 'up_name', 'up_part_name']),
    lotId: pickField(r, ['up_lot_id', 'up_lot']),
    qty: pickField(r, ['up_qty', 'up_amount', 'up_num', 'up_quantity']),
    unit: pickField(r, ['up_unit', 'up_uom']),
  }));
}

// รายการค่าใช้จ่ายอื่นๆ ของงาน 1 ใบ (ตาราง other_cost) → [{ id, dt, name, qty, unit }]
export async function fetchJobOtherCosts(jobId) {
  if (!jobId) return [];
  const res = await fetch(`${API_BASE}/other_cost.php?job_id=${encodeURIComponent(jobId)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || data.error || 'other_cost failed');
  return (data.rows || []).map((r, i) => ({
    seq: i + 1,
    id: pickField(r, ['oc_id', 'id']),
    dt: pickField(r, ['oc_dt_rec', 'oc_dt', 'oc_date', 'oc_datetime', 'oc_time']),
    name: pickField(r, ['oc_listname', 'oc_list', 'oc_name', 'oc_detail', 'oc_desc', 'oc_item', 'oc_title']),
    qty: pickField(r, ['oc_qty', 'oc_amount', 'oc_num', 'oc_quantity']),
    unit: pickField(r, ['oc_unit', 'oc_uom']),
  }));
}

// ดึงรถ 1 คันจาก v_id (ตาราง vihicle)
export async function getVehicle(id) {
  const res = await fetch(`${API_BASE}/vehicle_get.php?id=${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'vehicle get failed');
  return data.row || null;
}

// ค้นหารถจาก ID/เบอร์รถ (v_name) — ไม่ค้นทะเบียน
// คืน rows จากตาราง vihicle: [{ v_id, v_name, v_plate, v_brand, v_model, ... }]
export async function searchVehicles(term) {
  const res = await fetch(
    `${API_BASE}/vehicle_search.php?name=${encodeURIComponent(term)}&limit=50`
  );
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'search failed');
  let rows = data.rows || [];

  // ถ้าพิมพ์เป็นตัวเลขล้วน ลองหา v_id ตรง ๆ แล้วเอามาไว้บนสุด
  if (/^\d+$/.test(term)) {
    try {
      const row = await getVehicle(term);
      if (row && !rows.some((v) => String(v.v_id) === String(row.v_id))) {
        rows = [row, ...rows];
      }
    } catch (_) {
      /* ไม่พบก็ข้าม */
    }
  }
  return rows;
}

// แปลงแถว repair → object สำหรับ JobSummaryModal
export function mapRepairRow(r, i = 0) {
  return {
    id: i + 1,
    rawId: r.r_id || r.r_job_num || '',
    jobNum: r.r_job_num || '',
    code: r.r_job_num ? `#${r.r_job_num}` : r.r_id ? `#${r.r_id}` : '—',
    title: r.r_repair_list || 'งานแจ้งซ่อม',
    repairList: r.r_repair_list || '',
    closed: r.r_close && r.r_close !== '0',
    vehicleNo: r.r_v_name || '',
    plate: r.r_v_plate || '',
    chassis: r.r_v_chassis || '',
    model: [r.r_v_brand, r.r_v_model].filter(Boolean).join(' • '),
    vBrand: r.r_v_brand || '',
    vModel: r.r_v_model || '',
    meter: r.r_v_metr || '',
    mile: Number(r.r_mile) || 0,
    company: r.r_v_company || r.r_inv_com || '',
    billing: r.r_inv_com || '',
    technician: (r.r_technician || '').trim() || 'ไม่ระบุช่าง',
    recorder: (r.r_recorder || '').trim(),
    datetime: r.r_dt_rec || '',
    closeDatetime: r.r_dt_close || '',
    workReport: r.r_work_report || '',
  };
}

// โหลดงานตามเลข job สำหรับ preview layout (?previewJob=120516)
export async function fetchJobByNumber(jobNum) {
  const id = String(jobNum || '').trim();
  if (!id) return null;
  const tryFind = (rows) =>
    rows.find((r) => String(r.r_job_num) === id || String(r.r_id) === id);

  const today = startOfDay(new Date());
  const ranges = [
    [addDays(today, -7), today],
    [new Date(2026, 5, 1), new Date(2026, 5, 30)],
    [addDays(today, -90), today],
  ];

  for (const [start, end] of ranges) {
    const rep = await fetchRepairs(start, end);
    const row = tryFind(rep.rows || []);
    if (row) return mapRepairRow(row);
  }
  return null;
}
