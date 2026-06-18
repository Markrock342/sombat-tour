# ส่งต่องาน — Sombat Tour Dashboard

บรีฟสำหรับทีมที่รับงานต่อจาก `Markrock342/sombat-tour`

## ลิงก์สำคัญ

| รายการ | URL |
|--------|-----|
| Repo เรา (Dashboard) | https://github.com/Markrock342/sombat-tour |
| Repo ลูกค้า (425store API + ระบบเดิม) | https://github.com/Sombattour/425store *(private — ขอ access จากลูกค้า)* |
| Deploy Dashboard (Vercel) | https://sombat-tour-sepia.vercel.app |
| ระบบเดิม (อ้างอิง UI) | https://425store.vercel.app |
| API Base | https://425store.com/api/ |
| cPanel โฮสต์ API | https://425store.com:2083/ *(credentials แยกจากลูกค้า — อย่า commit ลง git)* |

## สิ่งที่ทำแล้ว

### ฟีเจอร์หลัก
- Dashboard งานประจำวัน + งานค้างซ่อม (ตามช่วงวันที่จากปฏิทิน)
- กดช่าง → รายการแจ้งซ่อม + ปฏิทิน + ฟิลเตอร์สถานะ + เรียงวันเวลาใหม่→เก่า
- งานที่ไม่มีผู้ซ่อม → แถบ **ไม่ระบุช่าง**
- ค้นหารถ / ดูข้อมูลรถ
- มือถือ: ปุ่มกลับ sticky ล่างซ้าย
- Header: โลโก้ + **สมบัติทัวร์**

### API ที่แอปเรียกใช้จริง (4 ตัว)

| Endpoint | ตาราง | ใช้ทำอะไร |
|----------|-------|-----------|
| `GET list_repair.php?date=YYYY-MM-DD` | `repair` | งานแจ้งซ่อม (รวมช่วงหลายวันฝั่ง client) |
| `GET technician_list.php?limit=500` | ช่าง | รายชื่อช่าง |
| `GET vehicle_search.php?name=...` | `vihicle` | ค้นหารถ |
| `GET vehicle_get.php?id=...` | `vihicle` | ดึงรถจาก ID |

**หมายเหตุ:** `backlog.php` มีใน repo ลูกค้าและใน `api/backlog.php` ของเรา แต่ **Dashboard ไม่เรียกแล้ว** — งานค้างซ่อมคำนวณจาก `list_repair` ที่ `r_close = 0` ในช่วงวันที่เลือก

### Assets จากระบบเดิม (425store.vercel.app)

| ไฟล์ | ใช้ทำอะไร |
|------|-----------|
| `assets/sombatlogobg.png` | ไอคอนโลโก้ header (500×500) |
| `assets/sombattourbg.png` | แบนเนอร์โลโก้ + loading (858×291) |

## โครงสร้างโปรเจกต์

```
sombat-tour/
├── App.js                 # Navigation stack
├── src/
│   ├── data/api.js        # เรียก 425store API
│   ├── screens/           # Dashboard, JobDetail, VehicleSearch, VehicleDetail
│   ├── components/        # Card, DateRangePicker, BackNavigation, LoadingView, ...
│   └── theme.js           # สี navy + card ขาว
├── assets/                # โลโก้
├── api/                   # สำเนา backlog.php + db.php (ไม่ได้ deploy บน Vercel dashboard)
└── vercel.json            # expo export web → dist/
```

## Deploy

### Dashboard (Vercel — repo เรา)
- Push `main` → Vercel auto deploy
- Build: `npx expo export --platform web`
- Output: `dist/`

### API (cPanel — repo ลูกค้า)
- ลูกค้าต้องการให้เอา repo `425store` ขึ้นโฮสต์ `425store.com`
- ไฟล์ PHP อยู่ที่ `/api/` บนเซิร์ฟเวอร์
- **อย่า commit password / db credentials ลง GitHub**

## งานที่ยังไม่ทำ (Placeholder บน Dashboard)

- ประวัติแจ้งซ่อมรายคัน
- สต็อกอะไหล่
- ข้อมูลด้านอื่น ๆ

## คำสั่ง dev

```bash
npm install
npm run web        # localhost
npm run start      # Expo
```

## ข้อควรระวัง

1. **รหัสผ่าน** — ลูกค้าส่ง GitHub/cPanel มาแล้ว ควรเปลี่ยนรหัสหลัง setup และเก็บใน password manager เท่านั้น
2. **ช่วงวันที่** — `list_repair.php` รองรับทีละวัน; ช่วงหลายวันรวมฝั่ง client ใน `fetchRepairs()`
3. **575 vs 81** — 575 = งานรวมทุกช่าง, 81 = งานของช่างคนเดียว (ไม่ใช่ bug)
4. **Console warning บน web** — `useNativeDriver`, `aria-hidden` จาก Modal ปฏิทิน — ไม่กระทบการใช้งาน

## Contact / ส่งมอบลูกค้า

- ทดสอบบนมือถือจริง (thumb zone ปุ่มกลับล่าง)
- เทียบตัวเลขกับระบบเดิม 425store.vercel.app ช่วงวันที่เดียวกัน
- UAT วันที่ลูกค้าแนะนำ: 31/5/2569 (งานไม่มีผู้ซ่อม), 9–15/6/2569 (ช่วงสัปดาห์)
