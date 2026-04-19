# PM System — Preventive Maintenance

ระบบบริหารจัดการงาน Preventive Maintenance สำหรับโครงการอสังหาริมทรัพย์

## Quick Start

### ขั้นตอนหลังติดตั้ง Node.js

```bash
# 1. เข้าไปในโฟลเดอร์โปรเจค
cd "D:/PM System/pm-system"

# 2. ติดตั้ง dependencies
npm install

# 3. สร้างไฟล์ .env.local
copy .env.local.example .env.local
# แก้ไข DATABASE_URL และ NEXTAUTH_SECRET ใน .env.local

# 4. สร้าง database (ต้องมี PostgreSQL ก่อน)
npm run db:migrate

# 5. ใส่ข้อมูลตัวอย่าง
npm run db:seed

# 6. รัน development server
npm run dev
```

เปิดเบราว์เซอร์ที่ http://localhost:3000

### Docker (แนะนำสำหรับ Production)

```bash
# สร้างและรัน
docker compose up -d

# รัน migration + seed ครั้งแรก
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed
```

## Test Accounts

| Username | Password | Role |
|----------|----------|------|
| superadmin | admin1234 | Super Admin |
| bm_anya | 1234 | BM/VM |
| tech_chai | 1234 | Technician |
| admin_tom | 1234 | Assist Admin |

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (JWT)
- **Excel**: ExcelJS
- **Notifications**: Line Notify API
- **Cron**: node-cron

## Excel Import Format

ไฟล์ชื่อรูปแบบ: `MMM_YYYY[ชื่อโครงการ].xls`
ตัวอย่าง: `Jan_2025 PM Monthly Plan-Life Rama4.xls`

- Sheet ที่รองรับ: **EE** และ **ME**
- เครื่องหมาย **●** ในช่องวันที่ = กำหนดตรวจวันนั้น
