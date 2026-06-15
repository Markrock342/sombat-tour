// Mock data — ~19 technicians, several with no jobs today (shown dimmed).
// `today` = งานประจำวัน, `pending` = งานค้างซ่อม.
export const technicians = [
  { id: 'T01', name: 'ช่างหมู', today: 14, pending: 6 },
  { id: 'T02', name: 'ช่างเครื่องเสียง', today: 12, pending: 4 },
  { id: 'T03', name: 'อู่เชียงราย', today: 11, pending: 8 },
  { id: 'T04', name: 'ช่างโจ้', today: 9, pending: 5 },
  { id: 'T05', name: 'ช่างเอก', today: 8, pending: 3 },
  { id: 'T06', name: 'ช่างบอย', today: 8, pending: 7 },
  { id: 'T07', name: 'ช่างนัท', today: 7, pending: 2 },
  { id: 'T08', name: 'อู่สมบัติ', today: 6, pending: 9 },
  { id: 'T09', name: 'ช่างต่อ', today: 6, pending: 4 },
  { id: 'T10', name: 'ช่างกฤษ', today: 5, pending: 1 },
  { id: 'T11', name: 'ช่างวิน', today: 4, pending: 3 },
  { id: 'T12', name: 'ช่างปอนด์', today: 4, pending: 2 },
  { id: 'T13', name: 'ช่างเบียร์', today: 3, pending: 5 },
  { id: 'T14', name: 'ช่างกอล์ฟ', today: 2, pending: 1 },
  { id: 'T15', name: 'ช่างเอ็ม', today: 2, pending: 0 },
  { id: 'T16', name: 'อู่ลำปาง', today: 0, pending: 2 },
  { id: 'T17', name: 'ช่างตี๋', today: 0, pending: 1 },
  { id: 'T18', name: 'ช่างหนุ่ม', today: 0, pending: 0 },
  { id: 'T19', name: 'ช่างป้อม', today: 0, pending: 0 },
];

// Sorted views (most jobs first).
export const routineJobs = [...technicians].sort((a, b) => b.today - a.today);
export const pendingJobs = [...technicians].sort((a, b) => b.pending - a.pending);

export const totalToday = technicians.reduce((sum, t) => sum + t.today, 0);
export const activeToday = technicians.filter((t) => t.today > 0).length;

const JOB_TITLES = [
  'ติดตั้งระบบแอร์',
  'ซ่อมบำรุงเครื่องสูบน้ำ',
  'ตรวจเช็คระบบไฟฟ้า',
  'เปลี่ยนคอมเพรสเซอร์',
  'ล้างทำความสะอาดคอยล์',
  'ซ่อมระบบทำความเย็น',
  'ตรวจรอยรั่วน้ำยา',
  'เปลี่ยนอะไหล่มอเตอร์',
  'ติดตั้งตู้ควบคุม',
  'ตรวจเช็คประจำปี',
];
const STATUSES = ['กำลังดำเนินการ', 'รอตรวจรับ', 'งานค้าง', 'เสร็จสิ้น'];

// Build a job list for a technician — `count` jobs (defaults to their daily load).
export function getJobsForTechnician(name, count = 10) {
  const n = Math.max(1, count);
  return Array.from({ length: n }, (_, i) => {
    const idx = i + 1;
    return {
      id: idx,
      code: `JOB-${String(1040 + idx)}`,
      title: JOB_TITLES[i % JOB_TITLES.length],
      status: STATUSES[i % STATUSES.length],
      detail: `รายละเอียด Job · ${JOB_TITLES[i % JOB_TITLES.length]} (รายการที่ ${idx})`,
      technician: name,
    };
  });
}
