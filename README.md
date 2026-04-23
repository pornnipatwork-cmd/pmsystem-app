# PM System — Preventive Maintenance Management

ระบบบริหารจัดการงาน Preventive Maintenance (PM) สำหรับโครงการอสังหาริมทรัพย์ ทั้งแนวสูง (High-Rise) และแนวราบ (Low-Rise) สร้างด้วย Next.js 14 App Router พร้อม Turso (libSQL) และ Vercel deployment

---

## สารบัญ

- [ภาพรวมระบบ](#ภาพรวมระบบ)
- [Tech Stack](#tech-stack)
- [โครงสร้างหน้าและ Features](#โครงสร้างหน้าและ-features)
- [บทบาทผู้ใช้งาน (Roles)](#บทบาทผู้ใช้งาน-roles)
- [API Routes](#api-routes)
- [Database Schema](#database-schema)
- [ติดตั้งและรันในเครื่อง](#ติดตั้งและรันในเครื่อง)
- [Environment Variables](#environment-variables)
- [Deploy บน Vercel](#deploy-บน-vercel)
- [รูปแบบไฟล์ Excel สำหรับ Import](#รูปแบบไฟล์-excel-สำหรับ-import)
- [Line Notify Integration](#line-notify-integration)

---

## ภาพรวมระบบ

PM System ช่วยให้ทีมช่างและผู้จัดการโครงการสามารถ:

- **วางแผน** — นำเข้าแผนงาน PM รายเดือนจากไฟล์ Excel (EE และ ME)
- **ติดตาม** — ดูสถานะงานรายวัน รายเดือน ผ่านปฏิทินและตารางงาน
- **Check-in** — บันทึกผลการตรวจพร้อมรูปภาพและหมายเหตุ
- **แจ้งเตือน** — ส่งสรุปงานผ่าน Line ทุกวันเวลา 09:00 น.
- **รายงาน** — ออกรายงาน PM รายเดือนแบบ Detail และ Summary พร้อม export PDF

### ประเภทอุปกรณ์
| ประเภท | ความหมาย | ตัวอย่าง |
|--------|-----------|----------|
| **EE** | Electrical & Communication | ตู้ MDB, Generator, UPS, หลอดไฟ |
| **ME** | Mechanical | Chiller, ปั๊มน้ำ, ลิฟต์, ปั๊มดับเพลิง |

### สถานะงาน
| Status | ความหมาย |
|--------|----------|
| `UPCOMING` | งานที่ยังไม่ถึงกำหนด |
| `TODAY` | งานที่ครบกำหนดวันนี้ |
| `DONE` | ตรวจสอบแล้ว (PASS / FAIL) |
| `OVERDUE` | เกินกำหนดและยังไม่ได้ตรวจ |
| `RESCHEDULED` | เลื่อนนัดแล้ว |

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database (dev) | SQLite (`dev.db`) |
| Database (production) | Turso / libSQL |
| ORM | Prisma 5.22 + `@prisma/adapter-libsql` |
| Auth | NextAuth.js 4.24 (JWT, 8 ชั่วโมง) |
| State | Zustand 5 (project store + persist) |
| Data Fetching | SWR 2.2 |
| Excel | ExcelJS 4.4, XLSX 0.18 |
| PDF | PDFKit 0.18, jsPDF 4.2, html2canvas 1.4 |
| รูปภาพ | Sharp (compress) + ImgBB API (host) |
| Notification | Line Messaging API |
| Cron | Vercel Cron Jobs (`vercel.json`) |
| Deploy | Vercel Hobby (free tier) |

---

## โครงสร้างหน้าและ Features

### หน้าสำหรับผู้ใช้ทั่วไป

#### `/dashboard` — แดชบอร์ดปฏิทิน
- ปฏิทินรายเดือนแสดงจำนวนงานแต่ละวัน
- กรองตามประเภท EE / ME
- แสดง metric: วันนี้, เสร็จแล้ว, เกินกำหนด, ทั้งหมด
- คลิกวันเพื่อดูรายการงานด้านข้าง
- Check-in ได้จากแดชบอร์ดโดยตรง

#### `/schedule` — ตารางงาน PM
- ตาราง 3 ระดับ: Type → Category → SubCategory
- กรองตาม: เดือน/ปี, ประเภท EE/ME, สถานะ, วันที่
- Check-in inline: บันทึกผล PASS/FAIL, หมายเหตุ, รูปภาพสูงสุด 3 รูป
- ช่อง Engineer Comment สำหรับบันทึกข้อสังเกตผิดปกติ

#### `/overdue` — งานค้าง
- แสดงเฉพาะงานที่เกินกำหนด
- แสดงจำนวนวันที่ค้างชำระ
- เลื่อนนัด (Reschedule) พร้อมระบุเหตุผล

#### `/report` — รายงาน
- **Detail Report** — ตารางครบทุกรายการพร้อมผล, หมายเหตุ, รูปภาพ
- **Summary Report** — สรุปจำนวน Pass/Fail รายหมวดหมู่
- Export เป็น PDF / พิมพ์โดยตรง
- เลือกเดือน/ปีย้อนหลังได้

#### `/import` — นำเข้า Excel
- อัปโหลดไฟล์ Excel (EE Sheet + ME Sheet)
- ระบบอ่านเดือน/ปีจากชื่อไฟล์อัตโนมัติ
- แสดงประวัติการนำเข้าทั้งหมด
- ตรวจจับไฟล์ซ้ำ ป้องกันนำเข้าสองครั้ง

---

### หน้า Admin (ADMIN / SUPER_ADMIN เท่านั้น)

#### `/admin/overview` — ภาพรวมระบบ
- สถิติรวม: โครงการทั้งหมด, ผู้ใช้งาน
- การ์ดสถานะแต่ละโครงการ (Line Notify On/Off)
- ปุ่ม Manual Trigger: "อัปเดต Overdue" สำหรับบังคับอัปเดตสถานะ

#### `/admin/projects` — จัดการโครงการ
- เพิ่ม / แก้ไข / ลบโครงการ
- Import/Export Excel
- กำหนดประเภท: HIGHRISE, LOWRISE_AP, LOWRISE_NONAP
- ตั้งค่า Line Group ID และเวลาแจ้งเตือน

#### `/admin/users` — จัดการผู้ใช้งาน
- เพิ่ม / แก้ไข / ลบผู้ใช้งาน
- กำหนด Role และ assign โครงการ
- Import/Export Excel
- ลบได้เฉพาะ ADMIN และ SUPER_ADMIN

#### `/admin/line` — ตั้งค่า Line Notify
- กำหนด Line Channel Access Token ต่อโครงการ
- ทดสอบการส่ง notification
- ปรับเวลาแจ้งเตือน

#### `/admin/data` — จัดการข้อมูล
- ล้างข้อมูล URL รูปภาพจาก Database
- Export ข้อมูลทั้งหมด

---

## บทบาทผู้ใช้งาน (Roles)

| Role | ความหมาย | Check-in | Comment | Admin Panel | โครงการที่เข้าถึงได้ |
|------|-----------|:--------:|:-------:|:-----------:|-------------------|
| `SUPER_ADMIN` | ผู้ดูแลระบบสูงสุด | ✅ | ✅ | ✅ | ทั้งหมด |
| `ADMIN` | ผู้ดูแลระบบ | ✅ | ✅ | ✅ | ทั้งหมด |
| `TECHNICIAN` | ช่างเทคนิค | ✅ | ✅ | ❌ | ที่ถูก assign |
| `ENGINEER` | วิศวกร | ❌ | ✅ | ❌ | ที่ถูก assign |
| `ASSIST_ADMIN` | ผู้ช่วยแอดมิน | ❌ | ❌ | ❌ | ที่ถูก assign |
| `BMVM` | BM / VM | ❌ | ❌ | ❌ | ที่ถูก assign |

---

## API Routes

### PM Schedules
| Method | Path | คำอธิบาย |
|--------|------|----------|
| `GET` | `/api/pm-schedules` | ดึงตารางงานตาม projectId, month, year, type, status |
| `PUT` | `/api/pm-schedules/[id]/checkin` | บันทึกผลการตรวจ (PASS/FAIL + รูป) |
| `PUT` | `/api/pm-schedules/[id]/reschedule` | เลื่อนนัด |
| `GET` | `/api/pm-schedules/counts` | จำนวนงานแต่ละสถานะ |

### Projects
| Method | Path | คำอธิบาย |
|--------|------|----------|
| `GET` | `/api/projects` | ดึงโครงการทั้งหมด (admin) หรือที่ assign (อื่นๆ) |
| `POST` | `/api/projects` | สร้างโครงการใหม่ |
| `PUT` | `/api/projects/[id]` | แก้ไขโครงการ |
| `DELETE` | `/api/projects/[id]` | ลบโครงการ (cascade ลบข้อมูลทั้งหมด) |
| `POST` | `/api/projects/import` | Import โครงการจาก Excel |
| `GET` | `/api/projects/export` | Export โครงการเป็น Excel |

### Users
| Method | Path | คำอธิบาย |
|--------|------|----------|
| `GET` | `/api/users` | ดึงรายชื่อผู้ใช้ทั้งหมด |
| `POST` | `/api/users` | สร้างผู้ใช้ใหม่ |
| `PUT` | `/api/users/[id]` | แก้ไขผู้ใช้ |
| `DELETE` | `/api/users/[id]` | ลบผู้ใช้ (admin เท่านั้น) |
| `POST` | `/api/users/import` | Import ผู้ใช้จาก Excel |
| `GET` | `/api/users/export` | Export ผู้ใช้เป็น Excel |

### Import & Report
| Method | Path | คำอธิบาย |
|--------|------|----------|
| `POST` | `/api/import` | นำเข้าแผน PM จาก Excel |
| `GET` | `/api/import/history` | ประวัติการนำเข้า |
| `GET` | `/api/report` | ดึงข้อมูลรายงาน |
| `GET/POST` | `/api/subcategory-comments` | Engineer comments |

### Line Notify
| Method | Path | คำอธิบาย |
|--------|------|----------|
| `POST` | `/api/line-notify/test/[projectId]` | ทดสอบส่ง notification |
| `POST` | `/api/line-notify/manual-daily` | ส่ง daily summary ทันที |
| `POST` | `/api/line-notify/manual-overdue` | ส่ง overdue alert ทันที |
| `PUT` | `/api/line-settings/[projectId]` | ตั้งค่า Line token + เวลา |

### Admin & Cron
| Method | Path | คำอธิบาย |
|--------|------|----------|
| `POST` | `/api/admin/trigger-overdue` | บังคับอัปเดตสถานะ OVERDUE ทั้งหมด |
| `GET` | `/api/cron/daily-tasks` | Vercel Cron endpoint (ต้องมี `CRON_SECRET`) |

---

## Database Schema

```
Project
├── id, code (unique), name, type
├── location, description, color
├── lineChannelToken, lineGroupId, lineNotifyTime
└── → UserProject[], PMItem[], ImportFile[]

User
├── id, username (unique), password (bcrypt)
├── name, employeeId, role
└── → UserProject[], PMSchedule (checked/rescheduled)

UserProject (join)
├── userId → User
└── projectId → Project

PMItem
├── id, projectId → Project
├── type (EE|ME), category, subCategory
├── no, name, number (unique per project+type)
├── location, period
└── → PMSchedule[]

PMSchedule
├── id, pmItemId → PMItem
├── scheduledDate, status
├── result (PASS|FAIL), remark
├── photoUrl (JSON array, ImgBB URLs)
├── checkedAt, checkedById → User
└── rescheduledDate, rescheduledRemark, rescheduledById → User

PMSubCategoryComment
├── id, projectId, type, category, subCategory
├── month, year, comment
└── createdById → User

ImportFile
├── id, projectId, fileName
├── month, year, importedById → User
└── status (PENDING|SUCCESS|FAILED), errorMsg

SystemSetting
└── key (PK), value
```

---

## ติดตั้งและรันในเครื่อง

### ความต้องการ
- Node.js 20+
- npm

### ขั้นตอน

```bash
# 1. Clone repository
git clone https://github.com/pornnipatwork-cmd/pmsystem-app.git
cd pmsystem-app

# 2. ติดตั้ง dependencies
npm install

# 3. สร้างไฟล์ .env จาก example
cp .env.local.example .env

# 4. Generate Prisma Client
npx prisma generate

# 5. สร้าง database และตาราง
npx prisma db push

# 6. เพิ่มข้อมูลตัวอย่าง
npx tsx prisma/seed.ts

# 7. รัน development server
npm run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:3000`

### Scripts ที่ใช้บ่อย

```bash
npm run dev          # รัน development server
npm run build        # build สำหรับ production
npm run start        # รัน production server
npx prisma studio    # เปิด database GUI
npx tsx prisma/seed.ts  # seed ข้อมูลตัวอย่าง
```

### บัญชีทดสอบ (หลัง seed)

| Username | Password | Role | โครงการ |
|----------|----------|------|---------|
| `superadmin` | `admin1234` | Super Admin | ทั้งหมด |
| `bm_anya` | `1234` | BM/VM | PROJ-001, PROJ-003 |
| `vm_somsak` | `1234` | BM/VM | PROJ-002 |
| `admin_tom` | `1234` | Assist Admin | PROJ-001, PROJ-003 |
| `admin_noi` | `1234` | Assist Admin | PROJ-002 |
| `tech_chai` | `1234` | Technician | PROJ-001, PROJ-003 |
| `tech_pan` | `1234` | Technician | PROJ-001 |
| `tech_wit` | `1234` | Technician | PROJ-002 |

---

## Environment Variables

สร้างไฟล์ `.env` ที่ root ของโปรเจกต์:

```env
# ─── Database ───────────────────────────────────────────
# Local development (SQLite)
DATABASE_URL="file:./dev.db"

# Production (Turso)
TURSO_DATABASE_URL="libsql://[db-name]-[org].turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"

# ─── NextAuth ────────────────────────────────────────────
NEXTAUTH_SECRET="your-random-secret-min-32-chars"
NEXTAUTH_URL="https://your-domain.vercel.app"

# ─── Cron Job (Vercel) ───────────────────────────────────
CRON_SECRET="your-random-cron-secret"

# ─── Image Hosting ───────────────────────────────────────
IMGBB_API_KEY="your-imgbb-api-key"

# ─── Line Notify ─────────────────────────────────────────
LINE_CHANNEL_ACCESS_TOKEN="your-line-channel-token"
```

> **หมายเหตุ:** ไฟล์ `.env` อยู่ใน `.gitignore` แล้ว ห้าม commit ขึ้น GitHub เด็ดขาด

### สร้าง Secret แบบสุ่ม (Windows)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Deploy บน Vercel

### ขั้นตอน

1. **Push code ขึ้น GitHub**
   ```bash
   git push origin main
   ```

2. **เชื่อม Vercel**
   - ไปที่ [vercel.com](https://vercel.com) → New Project
   - Import repository `pmsystem-app`

3. **ตั้งค่า Environment Variables** ใน Vercel Dashboard (Settings → Environment Variables)

   | Variable | ค่า |
   |----------|-----|
   | `TURSO_DATABASE_URL` | URL จาก Turso Dashboard |
   | `TURSO_AUTH_TOKEN` | Token จาก Turso Dashboard |
   | `NEXTAUTH_SECRET` | random string (32+ chars) |
   | `NEXTAUTH_URL` | `https://your-app.vercel.app` |
   | `CRON_SECRET` | random string |
   | `IMGBB_API_KEY` | จาก [api.imgbb.com](https://api.imgbb.com) |
   | `LINE_CHANNEL_ACCESS_TOKEN` | จาก Line Developers Console |

4. **Seed ข้อมูลเริ่มต้น** (ครั้งแรก)
   ```bash
   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx tsx prisma/seed.ts
   ```

### Cron Job

ไฟล์ `vercel.json` กำหนด cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-tasks",
      "schedule": "0 2 * * *"
    }
  ]
}
```

- รันทุกวัน **02:00 UTC** = **09:00 น. (Bangkok)**
- งานที่รัน: ส่ง daily summary, ตรวจ overdue, ส่ง monthly report (วันที่กำหนด)
- ต้องตั้ง `CRON_SECRET` เพื่อป้องกันการเรียก endpoint จากภายนอก

### Roadmap การขยายระบบ

| ขั้น | จำนวนโครงการ | สิ่งที่ต้องทำ | ค่าใช้จ่าย |
|------|-------------|--------------|-----------|
| ปัจจุบัน | ~20 | ตาม setup นี้ | **$0/เดือน** |
| กลางทาง | ~200 | เพิ่ม Cloudflare R2 แทน ImgBB | ~$2/เดือน |
| เต็มระบบ | 600 | Vercel Pro + Cloudflare R2 | ~$65/เดือน |

---

## รูปแบบไฟล์ Excel สำหรับ Import

ไฟล์ Excel ต้องมี **2 Sheet**: `EE` และ `ME`

### รูปแบบ Column
| คอลัมน์ | ความหมาย | ตัวอย่าง |
|---------|----------|---------|
| Category | หมวดหมู่ | ระบบไฟฟ้ากำลัง |
| Sub Category | หมวดย่อย | ตู้ MDB |
| No. | ลำดับ | 1 |
| Name | ชื่ออุปกรณ์ | ตู้ MDB ชั้น B1 |
| Number | รหัสอุปกรณ์ | MDB-B1 |
| Location | ตำแหน่ง | ชั้น B1 |
| 1–31 | วันที่ในเดือน | ● = มีกำหนดตรวจ |

### ชื่อไฟล์ (อ่านเดือน/ปีอัตโนมัติ)
```
PM_2025_01.xlsx          → มกราคม 2025
PM Monthly Plan 2025-03.xlsx  → มีนาคม 2025
PM_Apr_2025.xlsx         → เมษายน 2025
```

### Import ผู้ใช้ (Excel)
| Column | ความหมาย | จำเป็น |
|--------|----------|:------:|
| `username` | ชื่อผู้ใช้ | ✅ |
| `name` | ชื่อ-สกุล | ✅ |
| `password` | รหัสผ่าน | ✅ (user ใหม่) |
| `role` | บทบาท | (default: TECHNICIAN) |
| `employeeId` | รหัสพนักงาน | - |
| `projectCodes` | รหัสโครงการ คั่นด้วย `,` | - |

### Import โครงการ (Excel)
| Column | ความหมาย | จำเป็น |
|--------|----------|:------:|
| `code` | รหัสโครงการ | ✅ |
| `name` | ชื่อโครงการ | ✅ |
| `type` | HIGHRISE / LOWRISE_AP / LOWRISE_NONAP | (default: HIGHRISE) |
| `location` | ที่อยู่ | - |
| `color` | สี hex เช่น `#1D9E75` | - |

---

## Line Notify Integration

ระบบส่งการแจ้งเตือนผ่าน **Line Messaging API**:

### ประเภทการแจ้งเตือน
1. **Daily Summary** (09:00 ทุกวัน) — สรุปงานวันนี้ + งานค้าง
2. **Monthly Report** (วันที่กำหนดในระบบ) — รายงานสรุปประจำเดือน
3. **Overdue Alert** — แจ้งเตือนงานที่เกินกำหนดและยังไม่ได้ตรวจ

### การตั้งค่า
1. สร้าง Line Official Account และ Messaging API Channel
2. Copy **Channel Access Token** จาก Line Developers Console
3. ตั้งค่าใน `/admin/line` → เลือกโครงการ → ใส่ Token + Line Group ID
4. กด "ทดสอบ" เพื่อยืนยันการเชื่อมต่อ

### Manual Trigger
นอกจาก cron อัตโนมัติ สามารถส่ง notification ด้วยตนเองได้ที่ `/admin/overview`
