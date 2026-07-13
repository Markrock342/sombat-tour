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
- Dashboard งานประจำวัน + งานค้างซ่อม (ตามช่วงวันที่จากปฏิทิน) + ปุ่ม **ดูทั้งหมด**
- Pull-to-refresh + รีเฟรชเมื่อกลับเข้าแอป / วันที่เครื่องเปลี่ยน + กดโลโก้รีเฟรช Home
- กดช่าง → รายการแจ้งซ่อม + ปฏิทิน + ฟิลเตอร์สถานะ + ค้นในแถว + เรียงวันเวลาใหม่→เก่า
- จับคู่ช่างด้วย `r_technician_id` (fallback เป็นชื่อ)
- ค้นหารวม (งานซ่อม + รถ) พร้อมฟิลเตอร์ประเภท/สถานะ
- แจ้งซ่อมออนไลน์ + เสียกลางทาง + อัปโหลดรูป
- ประวัติแจ้งซ่อมรายคัน (ในหน้าข้อมูลรถ)
- บอร์ดข่าวไวท์บอร์ด + ตำแหน่งรถจอด
- Login / สิทธิ์ (admin, staff, technician, viewer) — ราคาอะไหล่เห็นเฉพาะ staff+

### API เดิมที่แอปยังเรียก

| Endpoint | ตาราง | ใช้ทำอะไร |
|----------|-------|-----------|
| `GET list_repair.php?date=YYYY-MM-DD` | `repair` | งานแจ้งซ่อม (รวมช่วงหลายวันฝั่ง client) |
| `GET technician_list.php?limit=500` | ช่าง | รายชื่อช่าง |
| `GET vehicle_search.php?name=...` | `vihicle` | ค้นหารถ (autocomplete ฟอร์ม) |
| `GET vehicle_get.php?id=...` | `vihicle` | ดึงรถจาก ID |

### API ใหม่ (อัปโหลดโฟลเดอร์ `api/` ขึ้น cPanel)

| Endpoint | วิธี | ใช้ทำอะไร |
|----------|------|-----------|
| `search.php` | GET | ค้นหารวม repair + vihicle |
| `auth.php` | POST/GET | login / logout / me |
| `repair_create.php` | POST | แจ้งซ่อม (ต้อง token) |
| `repair_update.php` | POST | ปิดงาน / แก้ (ต้อง token) |
| `repair_get.php` | GET | ดึงงาน 1 ใบ |
| `upload_image.php` | POST multipart | อัปโหลดรูปงาน |
| `repair_images.php` | GET | รายการรูปของงาน |
| `vehicle_history.php` | GET | ประวัติซ่อมรายคัน |
| `board_list/create/update/delete.php` | GET/POST | บอร์ดข่าว |
| `breakdown_list.php` | GET | เสียกลางทาง |
| `location_list/save/delete.php` | GET/POST | ตำแหน่งรถจอด |
| `schema.sql` | — | สร้างตารางเสริม (หรือให้ `ensure_schema` สร้างอัตโนมัติ) |

**Deploy API:** คัดลอกไฟล์ใน `api/` (ยกเว้น `config.php` ที่มีรหัสผ่าน) ขึ้น `425store.com/api/` ให้ `db.php` ชี้ `config.php` ของโฮสต์เหมือนเดิม  
สร้างโฟลเดอร์ `uploads/repair/` ให้เว็บเขียนได้ (chmod 755/775)

**บัญชีเริ่มต้น:** `admin` / PIN `1234` — **เปลี่ยนทันทีหลัง deploy**

### Assets จากระบบเดิม (425store.vercel.app)

| ไฟล์ | ใช้ทำอะไร |
|------|-----------|
| `assets/sombatlogobg.png` | ไอคอนโลโก้ header (500×500) |
| `assets/sombattourbg.png` | แบนเนอร์โลโก้ + loading (858×291) |

## โครงสร้างโปรเจกต์

```
sombat-tour/
├── App.js
├── src/
│   ├── auth/AuthContext.js
│   ├── data/api.js
│   ├── screens/          # Dashboard, Search, Repair*, Board, Breakdown, Locations, ...
│   ├── components/
│   └── theme.js
├── api/                  # PHP endpoints — อัปขึ้น cPanel (ไม่ deploy บน Vercel)
│   ├── bootstrap.php
│   ├── schema.sql
│   └── backup/sombat_backup.sh
└── vercel.json
```

## Deploy

### Dashboard (Vercel — repo เรา)
- Push `main` → Vercel auto deploy
- Build: `npx expo export --platform web`
- Output: `dist/`

### API (cPanel)
- อัปไฟล์ PHP ใน `api/` ไปที่ `/api/` บนเซิร์ฟเวอร์
- **อย่า commit password / db credentials ลง GitHub**

### Backup (mysqldump รายวัน)

1. คัดลอก [`api/backup/sombat_backup.sh`](api/backup/sombat_backup.sh) ไปนอก web root เช่น `$HOME/backup/sombat_backup.sh`
2. ตั้งค่า env หรือแก้ `DB_HOST/DB_NAME/DB_USER/DB_PASS` ในสคริปต์
3. `chmod +x sombat_backup.sh`
4. เพิ่ม Cron ใน cPanel เช่นทุกวัน 02:15:

```
15 2 * * * /home/USER/backup/sombat_backup.sh >> /home/USER/backup/backup.log 2>&1
```

5. สคริปต์เก็บไฟล์ `.sql.gz` ย้อนหลัง **14 วัน** แล้วลบของเก่าอัตโนมัติ

**Restore ตัวอย่าง:**

```bash
gunzip -c sombat_YYYYMMDD_HHMMSS.sql.gz | mysql -h HOST -u USER -p DB_NAME
```

## งานที่ยังค้าง / เชื่อมต่อภายหลัง

- สต็อกอะไหล่ + แสดงราคาตามสิทธิ์ (การ์ดบน Dashboard พร้อมแล้ว แต่ยังไม่มี API สต็อก)
- GPS จริง / น้ำมัน / ยอดผู้โดยสาร — รอ API จากผู้ให้บริการ GPS ของลูกค้า

## คำสั่ง dev

```bash
npm install
npm run web        # localhost
npm run start      # Expo
```

## ข้อควรระวัง

1. **รหัสผ่าน** — เปลี่ยน PIN admin และรหัส cPanel/GitHub หลัง setup
2. **ช่วงวันที่** — `list_repair.php` รองรับทีละวัน; ช่วงหลายวันรวมฝั่ง client ใน `fetchRepairs()`
3. **คอลัมน์เสริม** (`r_technician_id`, `r_type`, `r_tank_m`) — `ensure_schema()` พยายาม ALTER; ถ้าโฮสต์ไม่อนุญาต ให้รัน SQL ใน `schema.sql` ด้วยมือ
4. Endpoint ฝั่งเขียนต้องส่ง header `Authorization: Bearer <token>`

## Contact / ส่งมอบลูกค้า

- ทดสอบบนมือถือจริง (thumb zone ปุ่มกลับล่าง)
- เทียบตัวเลขกับระบบเดิม 425store.vercel.app ช่วงวันที่เดียวกัน
- UAT วันที่ลูกค้าแนะนำ: 31/5/2569 (งานไม่มีผู้ซ่อม), 9–15/6/2569 (ช่วงสัปดาห์)
- หลังอัป API ใหม่: ทดสอบ login → แจ้งซ่อม → อัปโหลดรูป → บอร์ด → ค้นหารวม
