// เชื่อมต่อ API จริงของ 425store
export const API_BASE = 'https://425store.com/api';

// แปลง Date → "YYYY-MM-DD" (เวลาท้องถิ่น)
export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// รายชื่อช่างทั้งหมด → [{ id, name, v_sort }]
export async function fetchTechnicians() {
  const res = await fetch(`${API_BASE}/technician_list.php?limit=500`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'technician_list failed');
  return data.rows || [];
}

// งานแจ้งซ่อมของวันที่ระบุ → { date, total, rows: [...] }
export async function fetchRepairs(dateStr) {
  const q = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '?date=latest';
  const res = await fetch(`${API_BASE}/list_repair.php${q}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'list_repair failed');
  return data;
}

// งานค้างซ่อม นับต่อช่าง → { total, rows: [{ name, pending }] }
export async function fetchPending() {
  const res = await fetch(`${API_BASE}/pending.php`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'pending failed');
  return data;
}

// รายการงานค้างของช่างคนเดียว → { rows: [...] }
export async function fetchPendingJobs(tech) {
  const res = await fetch(`${API_BASE}/pending.php?tech=${encodeURIComponent(tech)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'pending jobs failed');
  return data;
}

// ค้นหารถจาก ID รถ / เบอร์รถ → [{ r_v_id, name, plate, brand, model, jobs }]
export async function searchVehicles(q) {
  const res = await fetch(`${API_BASE}/vehicle.php?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'search failed');
  return data.rows || [];
}

// ประวัติแจ้งซ่อมของรถคันเดียว → { vehicle, total, rows: [...] }
export async function fetchVehicleHistory(id) {
  const res = await fetch(`${API_BASE}/vehicle.php?id=${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'vehicle history failed');
  return data;
}
