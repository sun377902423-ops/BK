import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.get('/reports', { preHandler: [fastify.authenticate] }, async (request) => {
    const query = request.query as { status?: string; patientId?: string };
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.patientId) where.patientId = parseInt(query.patientId);

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

  fastify.get('/reports/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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

  fastify.post('/reports', { preHandler: [fastify.authenticate] }, async (request) => {
    const data = request.body as any;

    const report = await prisma.report.create({
      data: {
        patientId: data.patientId,
        consultationId: data.consultationId || null,
        studyId: data.studyId || null,
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

  fastify.put('/reports/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const report = await prisma.report.findUnique({ where: { id: parseInt(id) } });
    if (!report) return reply.status(404).send({ error: '报告不存在' });
    if (report.status !== 'DRAFT' && report.status !== 'SUBMITTED') {
      return reply.status(400).send({ error: '当前状态不允许编辑' });
    }

    const updated = await prisma.report.update({
      where: { id: parseInt(id) },
      data: {
        content: data.content !== undefined ? data.content : undefined,
        status: data.status || undefined,
        patientId: data.patientId || undefined,
        consultationId: data.consultationId !== undefined ? data.consultationId : undefined,
        studyId: data.studyId !== undefined ? data.studyId : undefined,
      },
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        consultation: { select: { id: true, title: true } },
        study: { select: { id: true, orthancStudyId: true, modality: true } },
      },
    });
    return updated;
  });

  fastify.post('/reports/:id/sign', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user.userId;

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
    return updated;
  });

  fastify.post('/reports/:id/submit', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const report = await prisma.report.findUnique({ where: { id: parseInt(id) } });
    if (!report) return reply.status(404).send({ error: '报告不存在' });
    if (report.status !== 'DRAFT') return reply.status(400).send({ error: '只有草稿状态的报告才能提交' });

    const updated = await prisma.report.update({
      where: { id: parseInt(id) },
      data: { status: 'SUBMITTED' },
    });
    return updated;
  });

  fastify.delete('/reports/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await prisma.report.findUnique({ where: { id: parseInt(id) } });
    if (!report) return reply.status(404).send({ error: '报告不存在' });
    if (report.status !== 'DRAFT') return reply.status(400).send({ error: '只能删除草稿报告' });

    await prisma.report.delete({ where: { id: parseInt(id) } });
    return { success: true };
  });
}
