import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';
import bcrypt from 'bcrypt';

function buildPatientWhere(userId: number, roleName: string, hospitalId: number | null) {
  if (roleName === 'ADMIN') return {};
  const conditions: any[] = [
    { createdById: userId },
    { accessGrants: { some: { userId } } },
  ];
  if (hospitalId) {
    conditions.push({ hospitalId });
  }
  return { OR: conditions };
}

const verifyAttempts = new Map<string, { count: number; firstAt: number }>();
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_MAX_ATTEMPTS = 5;

function recordVerifyAttempt(key: string, success: boolean): boolean {
  const now = Date.now();
  const entry = verifyAttempts.get(key);
  if (success) {
    verifyAttempts.delete(key);
    return true;
  }
  if (!entry || now - entry.firstAt > VERIFY_WINDOW_MS) {
    verifyAttempts.set(key, { count: 1, firstAt: now });
    return true;
  }
  entry.count += 1;
  if (entry.count > VERIFY_MAX_ATTEMPTS) return false;
  return true;
}

function isVerifyBlocked(key: string): boolean {
  const entry = verifyAttempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > VERIFY_WINDOW_MS) {
    verifyAttempts.delete(key);
    return false;
  }
  return entry.count >= VERIFY_MAX_ATTEMPTS;
}

export async function patientRoutes(fastify: FastifyInstance) {
  fastify.get('/patients', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.PATIENT_LIST)],
  }, async (request) => {
    const userId = request.user.userId;
    const userRole = request.user.role;
    const hospitalId = request.user.hospitalId;

    if (userRole === 'ADMIN') {
      const patients = await prisma.patient.findMany({
        include: { hospital: true, createdBy: { select: { id: true, realName: true, username: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return patients;
    }

    const patients = await prisma.patient.findMany({
      where: buildPatientWhere(userId, userRole, hospitalId),
      include: { hospital: true, createdBy: { select: { id: true, realName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return patients;
  });

  fastify.get('/patients/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.PATIENT_READ)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;
    const userRole = request.user.role;

    const patient = await prisma.patient.findUnique({
      where: { id: parseInt(id) },
      include: {
        hospital: true,
        createdBy: { select: { id: true, realName: true, username: true } },
        studies: true,
        consultations: { include: { participants: { include: { user: { select: { id: true, realName: true } } } } } },
        accessGrants: { where: { userId } },
      },
    });

    if (!patient) {
      return reply.status(404).send({ error: '患者不存在' });
    }

    const isOwner = patient.createdById === userId;
    const isAdmin = userRole === 'ADMIN';
    const hasAccess = patient.accessGrants && patient.accessGrants.length > 0;
    const userHospitalId = request.user.hospitalId;
    const sameHospital = !!userHospitalId && patient.hospitalId === userHospitalId;

    if (!isOwner && !isAdmin && !hasAccess && !sameHospital) {
      return reply.status(403).send({
        error: '无权访问该患者信息',
        hasCasePassword: !!patient.casePassword,
        creatorName: patient.createdBy?.realName || patient.createdBy?.username,
        requiresAccess: true,
      });
    }

    const { casePassword, ...safe } = patient as any;
    return { ...safe, hasCasePassword: !!casePassword };
  });

  fastify.post('/patients', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.PATIENT_CREATE)],
  }, async (request) => {
    const data = request.body as any;
    const userId = request.user.userId;

    const patient = await prisma.patient.create({
      data: {
        patientId: data.patientId,
        name: data.name,
        gender: data.gender,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        phone: data.phone,
        email: data.email,
        address: data.address,
        hospitalId: data.hospitalId,
        createdById: userId,
        casePassword: data.casePassword ? await bcrypt.hash(data.casePassword, 10) : null,
      },
      include: { hospital: true },
    });
    return patient;
  });

  fastify.put('/patients/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.PATIENT_UPDATE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = request.user.userId;
    const userRole = request.user.role;

    const patient = await prisma.patient.findUnique({ where: { id: parseInt(id) } });
    if (!patient) return reply.status(404).send({ error: '患者不存在' });
    if (patient.createdById !== userId && userRole !== 'ADMIN') {
      return reply.status(403).send({ error: '无权修改该患者信息' });
    }

    const updateData: any = {
      name: data.name,
      gender: data.gender,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      phone: data.phone,
      email: data.email,
      address: data.address,
      hospitalId: data.hospitalId,
    };

    if (data.casePassword) {
      updateData.casePassword = await bcrypt.hash(data.casePassword, 10);
    }

    const updated = await prisma.patient.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    return updated;
  });

  fastify.delete('/patients/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.PATIENT_DELETE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;
    const userRole = request.user.role;

    const patient = await prisma.patient.findUnique({ where: { id: parseInt(id) } });
    if (!patient) return reply.status(404).send({ error: '患者不存在' });
    if (patient.createdById !== userId && userRole !== 'ADMIN') {
      return reply.status(403).send({ error: '无权删除该患者' });
    }

    await prisma.patient.delete({ where: { id: parseInt(id) } });
    return { success: true };
  });

  fastify.post('/patients/:id/access-request', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.ACCESS_REQUEST_CREATE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = request.user.userId;

    const patient = await prisma.patient.findUnique({ where: { id: parseInt(id) } });
    if (!patient) return reply.status(404).send({ error: '患者不存在' });

    const existing = await prisma.patientAccessRequest.findFirst({
      where: { patientId: parseInt(id), requesterId: userId, status: 'PENDING' },
    });
    if (existing) return reply.status(400).send({ error: '已存在待审批的申请' });

    const accessRequest = await prisma.patientAccessRequest.create({
      data: {
        patientId: parseInt(id),
        requesterId: userId,
        reason: data.reason || '',
      },
      include: { patient: { select: { id: true, name: true, patientId: true } }, requester: { select: { id: true, realName: true, username: true } } },
    });
    return accessRequest;
  });

  fastify.get('/patients/access-requests', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.ACCESS_REQUEST_LIST)],
  }, async (request) => {
    const userId = request.user.userId;
    const userRole = request.user.role;
    const query = request.query as { type?: string };

    let where: any = {};
    if (query.type === 'sent') {
      where = { requesterId: userId };
    } else if (userRole !== 'ADMIN') {
      where = { patient: { createdById: userId } };
    }

    const requests = await prisma.patientAccessRequest.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        requester: { select: { id: true, realName: true, username: true } },
        reviewedBy: { select: { id: true, realName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return requests;
  });

  fastify.put('/patients/access-requests/:id/approve', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.ACCESS_REQUEST_REVIEW)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    const accessRequest = await prisma.patientAccessRequest.findUnique({
      where: { id: parseInt(id) },
      include: { patient: true },
    });
    if (!accessRequest) return reply.status(404).send({ error: '申请不存在' });
    if (accessRequest.patient.createdById !== userId && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '无权审批此申请' });
    }
    if (accessRequest.status !== 'PENDING') return reply.status(400).send({ error: '申请已处理' });

    const updated = await prisma.patientAccessRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'APPROVED', reviewedById: userId, reviewedAt: new Date() },
    });

    await prisma.patientAccess.upsert({
      where: { patientId_userId: { patientId: accessRequest.patientId, userId: accessRequest.requesterId } },
      create: { patientId: accessRequest.patientId, userId: accessRequest.requesterId, grantedById: userId, accessType: 'GRANTED' },
      update: { accessType: 'GRANTED', grantedById: userId },
    });

    return updated;
  });

  fastify.put('/patients/access-requests/:id/reject', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.ACCESS_REQUEST_REVIEW)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    const accessRequest = await prisma.patientAccessRequest.findUnique({
      where: { id: parseInt(id) },
      include: { patient: true },
    });
    if (!accessRequest) return reply.status(404).send({ error: '申请不存在' });
    if (accessRequest.patient.createdById !== userId && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '无权审批此申请' });
    }
    if (accessRequest.status !== 'PENDING') return reply.status(400).send({ error: '申请已处理' });

    const updated = await prisma.patientAccessRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED', reviewedById: userId, reviewedAt: new Date() },
    });
    return updated;
  });

  fastify.post('/patients/:id/verify-password', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.PATIENT_READ)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = request.user.userId;

    const rateKey = `${userId}:${id}`;
    if (isVerifyBlocked(rateKey)) {
      return reply.status(429).send({ error: '尝试次数过多，请稍后重试' });
    }

    const patient = await prisma.patient.findUnique({ where: { id: parseInt(id) } });
    if (!patient) return reply.status(404).send({ error: '患者不存在' });
    if (!patient.casePassword) return reply.status(400).send({ error: '该患者未设置病例密码' });

    const valid = await bcrypt.compare(data.password || '', patient.casePassword);
    if (!valid) {
      recordVerifyAttempt(rateKey, false);
      return reply.status(401).send({ error: '密码错误' });
    }

    recordVerifyAttempt(rateKey, true);

    await prisma.patientAccess.upsert({
      where: { patientId_userId: { patientId: parseInt(id), userId } },
      create: { patientId: parseInt(id), userId, accessType: 'PASSWORD' },
      update: { accessType: 'PASSWORD' },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'VIEW',
        resourceType: 'PATIENT_CASE_PASSWORD',
        resourceId: parseInt(id),
      },
    });

    return { success: true, message: '密码验证通过' };
  });

  fastify.put('/patients/:id/case-password', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.PATIENT_UPDATE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = request.user.userId;

    const patient = await prisma.patient.findUnique({ where: { id: parseInt(id) } });
    if (!patient) return reply.status(404).send({ error: '患者不存在' });
    if (patient.createdById !== userId && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '无权设置病例密码' });
    }

    if (data.password && (typeof data.password !== 'string' || data.password.length < 6)) {
      return reply.status(400).send({ error: '病例密码至少 6 位' });
    }

    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : null;
    await prisma.patient.update({
      where: { id: parseInt(id) },
      data: { casePassword: hashedPassword },
    });
    return { success: true };
  });
}
