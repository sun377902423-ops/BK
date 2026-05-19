import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './prisma.js';

type AsyncCheck = (request: FastifyRequest, reply: FastifyReply) => Promise<boolean | { ok: false; status?: number; error?: string }>;

export function resourceAcl(check: AsyncCheck) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await check(request, reply);
    if (result === true) return;
    if (typeof result === 'object' && result && !result.ok) {
      return reply.status(result.status || 403).send({ error: result.error || '无权访问该资源' });
    }
    if (result === false) {
      return reply.status(403).send({ error: '无权访问该资源' });
    }
  };
}

function parseIdParam(request: FastifyRequest, key = 'id'): number | null {
  const value = (request.params as Record<string, string | undefined>)[key];
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const requireConsultationMember = resourceAcl(async (request, reply) => {
  const user = (request as any).user;
  if (!user) return { ok: false, status: 401, error: '未认证' };
  if (user.role === 'ADMIN') return true;

  const consultationId = parseIdParam(request, 'id');
  if (!consultationId) return { ok: false, status: 400, error: '会诊 ID 非法' };

  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    select: {
      id: true,
      createdById: true,
      hospitalId: true,
      participants: { where: { userId: user.userId }, select: { id: true } },
    },
  });
  if (!consultation) return { ok: false, status: 404, error: '会诊不存在' };
  if (consultation.createdById === user.userId) return true;
  if (consultation.participants.length > 0) return true;
  return { ok: false, error: '您不是该会诊的参与者' };
});

export const requireReportAccess = resourceAcl(async (request) => {
  const user = (request as any).user;
  if (!user) return { ok: false, status: 401, error: '未认证' };
  if (user.role === 'ADMIN') return true;

  const reportId = parseIdParam(request, 'id');
  if (!reportId) return { ok: false, status: 400, error: '报告 ID 非法' };

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      patient: {
        select: {
          createdById: true,
          hospitalId: true,
          accessGrants: { where: { userId: user.userId }, select: { id: true } },
        },
      },
      consultation: {
        select: {
          createdById: true,
          participants: { where: { userId: user.userId }, select: { id: true } },
        },
      },
    },
  });
  if (!report) return { ok: false, status: 404, error: '报告不存在' };

  if (report.patient?.createdById === user.userId) return true;
  if ((report.patient?.accessGrants?.length ?? 0) > 0) return true;
  if (report.consultation?.createdById === user.userId) return true;
  if ((report.consultation?.participants?.length ?? 0) > 0) return true;
  if (user.hospitalId && report.patient?.hospitalId === user.hospitalId) return true;
  return { ok: false, error: '无权访问该报告' };
});

export const requireStudyAccess = resourceAcl(async (request) => {
  const user = (request as any).user;
  if (!user) return { ok: false, status: 401, error: '未认证' };
  if (user.role === 'ADMIN') return true;

  const studyId = parseIdParam(request, 'id');
  if (!studyId) return { ok: false, status: 400, error: '检查 ID 非法' };

  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      hospitalId: true,
      patient: {
        select: {
          createdById: true,
          hospitalId: true,
          accessGrants: { where: { userId: user.userId }, select: { id: true } },
        },
      },
    },
  });
  if (!study) return { ok: false, status: 404, error: '检查不存在' };

  if (study.patient?.createdById === user.userId) return true;
  if ((study.patient?.accessGrants?.length ?? 0) > 0) return true;
  if (user.hospitalId && study.hospitalId === user.hospitalId) return true;
  if (user.hospitalId && study.patient?.hospitalId === user.hospitalId) return true;
  return { ok: false, error: '无权访问该检查' };
});

export const requirePatientAccess = resourceAcl(async (request) => {
  const user = (request as any).user;
  if (!user) return { ok: false, status: 401, error: '未认证' };
  if (user.role === 'ADMIN') return true;

  const patientId = parseIdParam(request, 'id');
  if (!patientId) return { ok: false, status: 400, error: '患者 ID 非法' };

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      createdById: true,
      hospitalId: true,
      accessGrants: { where: { userId: user.userId }, select: { id: true } },
    },
  });
  if (!patient) return { ok: false, status: 404, error: '患者不存在' };
  if (patient.createdById === user.userId) return true;
  if ((patient.accessGrants?.length ?? 0) > 0) return true;
  return { ok: false, error: '无权访问该患者' };
});
