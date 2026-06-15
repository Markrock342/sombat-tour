// Mock data standing in for the API. Counts map to the bar lengths in the sketch.

export const routineJobs = [
  { id: 't1', name: 'ช่าง A', count: 8 },
  { id: 't2', name: 'ช่าง B', count: 6 },
  { id: 't3', name: 'ช่าง C', count: 9 },
  { id: 't4', name: 'ช่าง D', count: 4 },
  { id: 't5', name: 'ช่าง E', count: 2 },
];

export const pendingJobs = [
  { id: 't1', name: 'ช่าง A', count: 10 },
  { id: 't2', name: 'ช่าง B', count: 12 },
  { id: 't3', name: 'ช่าง C', count: 15 },
  { id: 't4', name: 'ช่าง D', count: 5 },
  { id: 't5', name: 'ช่าง E', count: 3 },
];

export const filterOptions = ['เลือกตามช่าง', 'งานทั้งหมด', 'งานวันนี้', 'งานสัปดาห์นี้'];

// Jobs shown on the detail screen when a technician is tapped.
export function getJobsForTechnician(name) {
  return [
    {
      id: 1,
      title: 'ติดตั้งระบบแอร์ — อาคาร A',
      code: 'JOB-1042',
      status: 'กำลังดำเนินการ',
      detail: 'รายละเอียด Job · ตรวจสอบและติดตั้งคอยล์เย็น ชั้น 3',
    },
    {
      id: 2,
      title: 'ซ่อมบำรุงเครื่องสูบน้ำ',
      code: 'JOB-1043',
      status: 'รอตรวจรับ',
      detail: 'รายละเอียด Job · เปลี่ยนซีลและทดสอบแรงดัน',
    },
    {
      id: 3,
      title: 'ตรวจเช็คระบบไฟฟ้า',
      code: 'JOB-1044',
      status: 'งานค้าง',
      detail: 'รายละเอียด Job · ตรวจตู้ควบคุมและสายเมน',
    },
  ].map((j) => ({ ...j, technician: name }));
}
