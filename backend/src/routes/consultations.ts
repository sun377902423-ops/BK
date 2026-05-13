import { FastifyInstance } from 'fastify';
import { ConsultationStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { v4 as uuidv4 } from 'uuid';

export async function consultationRoutes(fastify: FastifyInstance) {
  fastify.get('/consultations', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_LIST)],
  }, async (request) => {
    const query = request.query as { status?: string };
    const userRole = request.user.role;
    const hospitalId = request.user.hospitalId;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (userRole !== 'ADMIN' && hospitalId) {
      where.hospitalId = hospitalId;
    }

    const consultations = await prisma.consultation.findMany({
      where,
      include: {
        patient: true,
        participants: {
          include: {
            user: {
              include: { role: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return consultations;
  });

  fastify.get('/consultations/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_LIST)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const consultation = await prisma.consultation.findUnique({
      where: { id: parseInt(id) },
      include: {
        patient: true,
        study: true,
        hospital: true,
        participants: {
          include: {
            user: {
              include: { role: true },
            },
          },
        },
      },
    });
    return consultation;
  });

  fastify.post('/consultations', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_CREATE)],
  }, async (request) => {
    const data = request.body as {
      title: string;
      patientId: number;
      studyId?: number;
      hospitalId?: number;
      participantIds?: number[];
    };

    const consultation = await prisma.consultation.create({
      data: {
        jitsiRoomName: uuidv4(),
        title: data.title,
        patientId: data.patientId,
        studyId: data.studyId,
        hospitalId: data.hospitalId,
        participants: data.participantIds
          ? {
              create: data.participantIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
    });
    return consultation;
  });

  fastify.put('/consultations/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_MANAGE)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as { title?: string; status?: ConsultationStatus };
    const consultation = await prisma.consultation.update({
      where: { id: parseInt(id) },
      data: {
        title: data.title,
        status: data.status,
      },
    });
    return consultation;
  });

  fastify.post('/consultations/:id/participants', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_JOIN)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as { userId: number; isHost?: boolean };
    const participant = await prisma.consultationParticipant.create({
      data: {
        consultationId: parseInt(id),
        userId: data.userId,
        isHost: data.isHost ?? false,
      },
      include: {
        user: true,
      },
    });
    return participant;
  });

  fastify.delete('/consultations/:id/participants/:userId', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_MANAGE)],
  }, async (request) => {
    const { id, userId } = request.params as { id: string; userId: string };
    await prisma.consultationParticipant.deleteMany({
      where: {
        consultationId: parseInt(id),
        userId: parseInt(userId),
      },
    });
    return { success: true };
  });

  fastify.put('/consultations/:id/status', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_CLOSE)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as { status: ConsultationStatus };
    const updateData: any = { status: data.status as ConsultationStatus };

    if (data.status === 'IN_PROGRESS') {
      updateData.startAt = new Date();
    } else if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
      updateData.endAt = new Date();
    }

    const consultation = await prisma.consultation.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    return consultation;
  });
}
