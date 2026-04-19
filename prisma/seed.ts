import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'

function createPrisma() {
  if (process.env.TURSO_DATABASE_URL) {
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }
  return new PrismaClient()
}

const prisma = createPrisma()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Clean existing data ─────────────────────────────────────────────────────
  await prisma.pMSchedule.deleteMany()
  await prisma.pMItem.deleteMany()
  await prisma.importFile.deleteMany()
  await prisma.userProject.deleteMany()
  await prisma.user.deleteMany()
  await prisma.project.deleteMany()

  // ─── Projects ────────────────────────────────────────────────────────────────
  const project1 = await prisma.project.create({
    data: {
      code: 'PROJ-001',
      name: 'Life Rama4',
      type: 'HIGHRISE',
      location: 'ถนนพระราม 4 กรุงเทพฯ',
      description: 'อาคารชุดพักอาศัย High Rise 35 ชั้น',
      lineGroupId: '',
      lineNotifyTime: '08:00',
      color: '#1D9E75',
    },
  })

  const project2 = await prisma.project.create({
    data: {
      code: 'PROJ-002',
      name: 'Life Sukhumvit',
      type: 'LOWRISE_AP',
      location: 'สุขุมวิท กรุงเทพฯ',
      description: 'อาคารชุดพักอาศัย Low Rise 8 ชั้น',
      lineGroupId: '',
      lineNotifyTime: '09:00',
      color: '#185FA5',
    },
  })

  const project3 = await prisma.project.create({
    data: {
      code: 'PROJ-003',
      name: 'Grand Ville',
      type: 'LOWRISE_NONAP',
      location: 'ลาดพร้าว กรุงเทพฯ',
      description: 'หมู่บ้านจัดสรร 200 ยูนิต',
      lineGroupId: '',
      lineNotifyTime: '09:00',
      color: '#BA7517',
    },
  })

  console.log('✅ Projects created')

  // ─── Users ───────────────────────────────────────────────────────────────────
  const hashPassword = async (pw: string) => bcrypt.hash(pw, 10)

  const superAdmin = await prisma.user.create({
    data: {
      username: 'superadmin',
      password: await hashPassword('admin1234'),
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  })

  const bmAnya = await prisma.user.create({
    data: {
      username: 'bm_anya',
      password: await hashPassword('1234'),
      name: 'อัญชา สุวรรณ',
      role: 'BMVM',
    },
  })

  const vmSomsak = await prisma.user.create({
    data: {
      username: 'vm_somsak',
      password: await hashPassword('1234'),
      name: 'สมศักดิ์ ชัยวงค์',
      role: 'BMVM',
    },
  })

  const adminTom = await prisma.user.create({
    data: {
      username: 'admin_tom',
      password: await hashPassword('1234'),
      name: 'ธนกร มาลัย',
      role: 'ASSIST_ADMIN',
    },
  })

  const adminNoi = await prisma.user.create({
    data: {
      username: 'admin_noi',
      password: await hashPassword('1234'),
      name: 'น้อย ศรีวงษ์',
      role: 'ASSIST_ADMIN',
    },
  })

  const techChai = await prisma.user.create({
    data: {
      username: 'tech_chai',
      password: await hashPassword('1234'),
      name: 'ชัย อินทร์เฉลิม',
      role: 'TECHNICIAN',
    },
  })

  const techPan = await prisma.user.create({
    data: {
      username: 'tech_pan',
      password: await hashPassword('1234'),
      name: 'ปาน กลิ่นหอม',
      role: 'TECHNICIAN',
    },
  })

  const techWit = await prisma.user.create({
    data: {
      username: 'tech_wit',
      password: await hashPassword('1234'),
      name: 'วิทย์ สมบูรณ์',
      role: 'TECHNICIAN',
    },
  })

  console.log('✅ Users created')

  // ─── Assign Users to Projects ─────────────────────────────────────────────
  await prisma.userProject.createMany({
    data: [
      { userId: bmAnya.id, projectId: project1.id },
      { userId: adminTom.id, projectId: project1.id },
      { userId: techChai.id, projectId: project1.id },
      { userId: techPan.id, projectId: project1.id },
    ],
  })

  await prisma.userProject.createMany({
    data: [
      { userId: vmSomsak.id, projectId: project2.id },
      { userId: adminNoi.id, projectId: project2.id },
      { userId: techWit.id, projectId: project2.id },
    ],
  })

  await prisma.userProject.createMany({
    data: [
      { userId: bmAnya.id, projectId: project3.id },
      { userId: adminTom.id, projectId: project3.id },
      { userId: techChai.id, projectId: project3.id },
    ],
  })

  console.log('✅ User-Project assignments created')

  // ─── PM Items for Project 1 ───────────────────────────────────────────────
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1 // 1-12

  await prisma.pMItem.createMany({
    data: [
      { projectId: project1.id, type: 'EE', category: 'ระบบไฟฟ้ากำลัง', no: 1, name: 'ตู้ MDB ชั้น B1', number: 'MDB-B1', location: 'ชั้น B1', period: 'MONTHLY' },
      { projectId: project1.id, type: 'EE', category: 'ระบบไฟฟ้ากำลัง', no: 2, name: 'ตู้ MDB ชั้น 1', number: 'MDB-01', location: 'ชั้น 1', period: 'MONTHLY' },
      { projectId: project1.id, type: 'EE', category: 'ระบบไฟฟ้ากำลัง', no: 3, name: 'ตู้ DB ชั้น 5', number: 'DB-05', location: 'ชั้น 5', period: 'MONTHLY' },
      { projectId: project1.id, type: 'EE', category: 'ระบบแสงสว่าง', no: 4, name: 'หลอด LED บันได', number: 'LED-ST-01', location: 'บันไดหนีไฟ', period: 'MONTHLY' },
      { projectId: project1.id, type: 'EE', category: 'ระบบแสงสว่าง', no: 5, name: 'หลอด LED ล็อบบี้', number: 'LED-LB-01', location: 'ล็อบบี้ชั้น 1', period: 'MONTHLY' },
      { projectId: project1.id, type: 'EE', category: 'ระบบสำรองไฟ', no: 6, name: 'Generator ชุดที่ 1', number: 'GEN-01', location: 'ชั้น B2', period: 'MONTHLY' },
      { projectId: project1.id, type: 'EE', category: 'ระบบสำรองไฟ', no: 7, name: 'UPS ห้อง Server', number: 'UPS-01', location: 'ชั้น 3', period: 'MONTHLY' },
    ],
  })

  await prisma.pMItem.createMany({
    data: [
      { projectId: project1.id, type: 'ME', category: 'ระบบปรับอากาศ', no: 1, name: 'Chiller Unit 1', number: 'CH-01', location: 'ดาดฟ้า', period: 'MONTHLY' },
      { projectId: project1.id, type: 'ME', category: 'ระบบปรับอากาศ', no: 2, name: 'Chiller Unit 2', number: 'CH-02', location: 'ดาดฟ้า', period: 'MONTHLY' },
      { projectId: project1.id, type: 'ME', category: 'ระบบปรับอากาศ', no: 3, name: 'AHU ชั้น B1', number: 'AHU-B1', location: 'ชั้น B1', period: 'MONTHLY' },
      { projectId: project1.id, type: 'ME', category: 'ระบบประปา', no: 4, name: 'ปั๊มน้ำประปา 1', number: 'PWP-01', location: 'ชั้น B1', period: 'MONTHLY' },
      { projectId: project1.id, type: 'ME', category: 'ระบบประปา', no: 5, name: 'ถังพักน้ำหลังคา', number: 'WT-R01', location: 'ดาดฟ้า', period: 'MONTHLY' },
      { projectId: project1.id, type: 'ME', category: 'ระบบลิฟต์', no: 6, name: 'ลิฟต์โดยสาร 1', number: 'LFT-01', location: 'ทุกชั้น', period: 'MONTHLY' },
      { projectId: project1.id, type: 'ME', category: 'ระบบลิฟต์', no: 7, name: 'ลิฟต์โดยสาร 2', number: 'LFT-02', location: 'ทุกชั้น', period: 'MONTHLY' },
      { projectId: project1.id, type: 'ME', category: 'ระบบดับเพลิง', no: 8, name: 'ปั๊มดับเพลิงหลัก', number: 'FP-01', location: 'ชั้น B1', period: 'MONTHLY' },
    ],
  })

  console.log('✅ PM Items created')

  // ─── PM Schedules for current month ──────────────────────────────────────
  const allItems = await prisma.pMItem.findMany({ where: { projectId: project1.id } })
  const scheduleDates = [3, 7, 10, 14, 17, 21, 24, 28]

  const scheduleData: {
    pmItemId: string
    scheduledDate: Date
    status: string
    result: string | null
    checkedAt: Date | null
    checkedById: string | null
  }[] = []

  for (const item of allItems) {
    // Give each item 2-3 schedule dates this month
    const numDates = Math.floor(Math.random() * 2) + 2
    const selectedDates = scheduleDates.slice(0, numDates)

    for (const day of selectedDates) {
      // Make sure the day exists in the month
      const daysInMonth = new Date(year, month, 0).getDate()
      if (day > daysInMonth) continue

      const schedDate = new Date(year, month - 1, day)
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

      let status: string
      let result: string | null = null
      let checkedAt: Date | null = null
      let checkedById: string | null = null

      if (schedDate.getTime() === todayDate.getTime()) {
        status = 'TODAY'
      } else if (schedDate < todayDate) {
        // 70% chance DONE, 30% OVERDUE
        if (Math.random() < 0.7) {
          status = 'DONE'
          result = Math.random() < 0.9 ? 'PASS' : 'FAIL'
          checkedAt = new Date(schedDate.getTime() + 2 * 60 * 60 * 1000)
          checkedById = techChai.id
        } else {
          status = 'OVERDUE'
        }
      } else {
        status = 'UPCOMING'
      }

      scheduleData.push({
        pmItemId: item.id,
        scheduledDate: schedDate,
        status,
        result,
        checkedAt,
        checkedById,
      })
    }
  }

  await prisma.pMSchedule.createMany({ data: scheduleData })

  console.log(`✅ PM Schedules created (${scheduleData.length} records)`)
  console.log('')
  console.log('🎉 Seed completed!')
  console.log('')
  console.log('Test accounts:')
  console.log('  superadmin / admin1234  (Super Admin - all projects)')
  console.log('  bm_anya    / 1234       (BM/VM - projects 1,3)')
  console.log('  vm_somsak  / 1234       (BM/VM - project 2)')
  console.log('  admin_tom  / 1234       (Assist Admin - projects 1,3)')
  console.log('  admin_noi  / 1234       (Assist Admin - project 2)')
  console.log('  tech_chai  / 1234       (Technician - projects 1,3)')
  console.log('  tech_pan   / 1234       (Technician - project 1)')
  console.log('  tech_wit   / 1234       (Technician - project 2)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
