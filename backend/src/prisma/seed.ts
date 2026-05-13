import { PrismaClient, RoleName, AuditAction } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据库...');

  // 创建角色
  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: {
      name: RoleName.ADMIN,
      displayName: '系统管理员',
      permissions: JSON.stringify([
        'user:create', 'user:read', 'user:update', 'user:delete',
        'patient:create', 'patient:read', 'patient:update', 'patient:delete',
        'study:read', 'consultation:create', 'consultation:read', 'consultation:update',
        'report:create', 'report:read', 'report:update', 'report:sign',
        'audit:read', 'system:manage'
      ]),
      isSystem: true,
    },
  });

  const localDoctorRole = await prisma.role.upsert({
    where: { name: RoleName.DOCTOR_LOCAL },
    update: {},
    create: {
      name: RoleName.DOCTOR_LOCAL,
      displayName: '本地医生',
      permissions: JSON.stringify([
        'patient:read', 'patient:update', 'study:read',
        'consultation:create', 'consultation:read', 'consultation:update',
        'report:create', 'report:read', 'report:update'
      ]),
      isSystem: true,
    },
  });

  const remoteDoctorRole = await prisma.role.upsert({
    where: { name: RoleName.DOCTOR_REMOTE },
    update: {},
    create: {
      name: RoleName.DOCTOR_REMOTE,
      displayName: '远程专家',
      permissions: JSON.stringify([
        'patient:read', 'study:read', 'consultation:read', 'consultation:update',
        'report:read', 'report:update', 'report:sign'
      ]),
      isSystem: true,
    },
  });

  const technicianRole = await prisma.role.upsert({
    where: { name: RoleName.TECHNICIAN },
    update: {},
    create: {
      name: RoleName.TECHNICIAN,
      displayName: '技师',
      permissions: JSON.stringify([
        'patient:create', 'patient:read', 'patient:update', 'study:read'
      ]),
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
