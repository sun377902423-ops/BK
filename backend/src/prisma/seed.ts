import { PrismaClient, RoleName, AuditAction } from '@prisma/client';
import bcrypt from 'bcrypt';
import { ROLE_PERMISSIONS } from '../lib/permissions.js';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据库...');

  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: { permissions: JSON.stringify(ROLE_PERMISSIONS.ADMIN) },
    create: {
      name: RoleName.ADMIN,
      displayName: '系统管理员',
      permissions: JSON.stringify(ROLE_PERMISSIONS.ADMIN),
      isSystem: true,
    },
  });

  const localDoctorRole = await prisma.role.upsert({
    where: { name: RoleName.DOCTOR_LOCAL },
    update: { permissions: JSON.stringify(ROLE_PERMISSIONS.DOCTOR_LOCAL) },
    create: {
      name: RoleName.DOCTOR_LOCAL,
      displayName: '本地医生',
      permissions: JSON.stringify(ROLE_PERMISSIONS.DOCTOR_LOCAL),
      isSystem: true,
    },
  });

  const remoteDoctorRole = await prisma.role.upsert({
    where: { name: RoleName.DOCTOR_REMOTE },
    update: { permissions: JSON.stringify(ROLE_PERMISSIONS.DOCTOR_REMOTE) },
    create: {
      name: RoleName.DOCTOR_REMOTE,
      displayName: '远程专家',
      permissions: JSON.stringify(ROLE_PERMISSIONS.DOCTOR_REMOTE),
      isSystem: true,
    },
  });

  const technicianRole = await prisma.role.upsert({
    where: { name: RoleName.TECHNICIAN },
    update: { permissions: JSON.stringify(ROLE_PERMISSIONS.TECHNICIAN) },
    create: {
      name: RoleName.TECHNICIAN,
      displayName: '技师',
      permissions: JSON.stringify(ROLE_PERMISSIONS.TECHNICIAN),
      isSystem: true,
    },
  });

  // 创建默认用户
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      realName: '系统管理员',
      email: 'admin@bksys.com',
      roleId: adminRole.id,
      status: 'active',
    },
  });

  const localDoctor = await prisma.user.upsert({
    where: { username: 'doctor_local' },
    update: {},
    create: {
      username: 'doctor_local',
      passwordHash,
      realName: '本地医生',
      email: 'doctor_local@bksys.com',
      roleId: localDoctorRole.id,
      status: 'active',
    },
  });

  const remoteDoctor = await prisma.user.upsert({
    where: { username: 'doctor_remote' },
    update: {},
    create: {
      username: 'doctor_remote',
      passwordHash,
      realName: '远程专家',
      email: 'doctor_remote@bksys.com',
      roleId: remoteDoctorRole.id,
      status: 'active',
    },
  });

  const technician = await prisma.user.upsert({
    where: { username: 'technician' },
    update: {},
    create: {
      username: 'technician',
      passwordHash,
      realName: '技师',
      email: 'technician@bksys.com',
      roleId: technicianRole.id,
      status: 'active',
    },
  });

  // 创建示例医院
  const hospital = await prisma.hospital.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'BKSYS 中心医院',
      country: '布基纳法索',
      city: '瓦加杜古',
      isEdgeSite: false,
    },
  });

  // 创建示例患者
  const patient = await prisma.patient.upsert({
    where: { patientId: 'P0001' },
    update: {},
    create: {
      patientId: 'P0001',
      name: '张三',
      gender: '男',
      phone: '1234567890',
      hospitalId: hospital.id,
    },
  });

  console.log('数据库初始化完成！');
  console.log('默认账号:');
  console.log('  管理员: admin / admin123');
  console.log('  本地医生: doctor_local / admin123');
  console.log('  远程专家: doctor_remote / admin123');
  console.log('  技师: technician / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
