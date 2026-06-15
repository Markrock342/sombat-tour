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
// หมายเหตุ: ใช้ backlog.php (โฮสต์บล็อก URL ที่มีคำว่า "pending")
export async function fetchPending() {
  const res = await fetch(`${API_BASE}/backlog.php`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'backlog failed');
  return data;
}

// รายการงานค้างของช่างคนเดียว → { rows: [...] }
export async function fetchPendingJobs(tech) {
  const res = await fetch(`${API_BASE}/backlog.php?tech=${encodeURIComponent(tech)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'backlog jobs failed');
  return data;
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
