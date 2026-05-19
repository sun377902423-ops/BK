import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { requireReportAccess } from '../lib/resource-acl.js';
import { PERMISSIONS } from '../lib/permissions.js';

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.get('/reports', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.REPORT_LIST)],
  }, async (request) => {
    const query = request.query as { status?: string; patientId?: string };
    const userId = request.user.userId;
    const userRole = request.user.role;
    const hospitalId = request.user.hospitalId;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.patientId) where.patientId = parseInt(query.patientId);

    if (userRole !== 'ADMIN') {
      const scope: any[] = [
        { patient: { createdById: userId } },
        { patient: { accessGrants: { some: { userId } } } },
        { consultation: { createdById: userId } },
        { consultation: { participants: { some: { userId } } } },
      ];
      if (hospitalId) {
        scope.push({ patient: { hospitalId } });
      }
      where.OR = scope;
    }

    const reports = await prisma.report.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        consultation: { select: { id: true, title: true } },
        study: { select: { id: true, orthancStudyId: true, modality: true } },
        signedBy: { select: { id: true, realName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reports;
  });

  fastify.get('/reports/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.REPORT_LIST), requireReportAccess],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await prisma.report.findUnique({
      where: { id: parseInt(id) },
      include: {
        patient: true,
        consultation: { include: { participants: { include: { user: { select: { id: true, realName: true } } } } } },
        study: true,
        signedBy: { select: { id: true, realName: true, username: true } },
        attachments: true,
      },
    });
    if (!report) return reply.status(404).send({ error: '报告不存在' });
    return report;
  });

  fastify.post('/reports', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.REPORT_CREATE)],
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = request.user.userId;
    const userRole = request.user.role;
    const patientId = parseInt(data.patientId);
    if (!Number.isFinite(patientId)) {
      return reply.status(400).send({ error: '患者 ID 非法' });
    }

    if (userRole !== 'ADMIN') {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: {
          createdById: true,
          hospitalId: true,
          accessGrants: { where: { userId }, select: { id: true } },
        },
      });
      if (!patient) return reply.status(404).send({ error: '患者不存在' });
      const allowed = patient.createdById === userId
        || (patient.accessGrants?.length ?? 0) > 0
        || (request.user.hospitalId && patient.hospitalId === request.user.hospitalId);
      if (!allowed) {
        return reply.status(403).send({ error: '无权对该患者创建报告' });
      }
    }

    const report = await prisma.report.create({
      data: {
        patientId,
        consultationId: data.consultationId ? parseInt(data.consultationId) : null,
        studyId: data.studyId ? parseInt(data.studyId) : null,
        content: data.content || {},
        status: 'DRAFT',
      },
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        consultation: { select: { id: true, title: true } },
        study: { select: { id: true, orthancStudyId: true, modality: true } },
      },
    });
    return report;
  });

  fastify.put('/reports/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.REPORT_UPDATE), requireReportAccess],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const report = await prisma.report.findUnique({ where: { id: parseInt(id) } });
    if (!report) return reply.status(404).send({ error: '报告不存在' });
    if (report.status !== 'DRAFT' && report.status !== 'SUBMITTED') {
      return reply.status(400).send({ error: '当前状态不允许编辑' });
    }

    const updatePayload: any = {};
    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.consultationId !== undefined) {
      updatePayload.consultationId = data.consultationId ? parseInt(data.consultationId) : null;
    }
    if (data.studyId !== undefined) {
      updatePayload.studyId = data.studyId ? parseInt(data.studyId) : null;
    }

    const updated = await prisma.report.update({
      where: { id: parseInt(id) },
      data: updatePayload,
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        consultation: { select: { id: true, title: true } },
        study: { select: { id: true, orthancStudyId: true, modality: true } },
      },
    });
    return updated;
  });

  fastify.post('/reports/:id/sign', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.REPORT_SIGN), requireReportAccess],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    const report = await prisma.report.findUnique({ where: { id: parseInt(id) } });
    if (!report) return reply.status(404).send({ error: '报告不存在' });
    if (report.status !== 'SUBMITTED') {
      return reply.status(400).send({ error: '只有已提交的报告才能签署' });
    }

    const updated = await prisma.report.update({
      where: { id: parseInt(id) },
      data: {
        status: 'APPROVED',
        signedById: userId,
        signedAt: new Date(),
      },
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        signedBy: { select: { id: true, realName: true, username: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SIGN',
        resourceType: 'REPORT',
        resourceId: report.id,
        detail: { from: 'SUBMITTED', to: 'APPROVED' },
      },
    });
    return updated;
  });

  fastify.post('/reports/:id/submit', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.REPORT_SUBMIT), requireReportAccess],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const report = await prisma.report.findUnique({ where: { id: parseInt(id) } });
    if (!report) return reply.status(404).send({ error: '报告不存在' });
    if (report.status !== 'DRAFT') return reply.status(400).send({ error: '只有草稿状态的报告才能提交' });

    const updated = await prisma.report.update({
      where: { id: parseInt(id) },
      data: { status: 'SUBMITTED' },
    });

    await prisma.auditLog.create({
      data: {
        userId: request.user.userId,
        action: 'UPDATE',
        resourceType: 'REPORT_SUBMIT',
        resourceId: report.id,
        detail: { from: 'DRAFT', to: 'SUBMITTED' },
      },
    });
    return updated;
  });

  fastify.delete('/reports/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.REPORT_DELETE), requireReportAccess],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await prisma.report.findUnique({ where: { id: parseInt(id) } });
    if (!report) return reply.status(404).send({ error: '报告不存在' });
    if (report.status !== 'DRAFT') return reply.status(400).send({ error: '只能删除草稿报告' });

    await prisma.report.delete({ where: { id: parseInt(id) } });
    return { success: true };
  });
}
