import { FastifyInstance } from 'fastify';
import { ConsultationStatus, ParticipantRole, ParticipantStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { v4 as uuidv4 } from 'uuid';
import { AccessToken } from 'livekit-server-sdk';

const VALID_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['INVITED', 'SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  INVITED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

async function notifyUser(userId: number, type: string, title: string, body: string, resourceType?: string, resourceId?: number) {
  await prisma.notification.create({
    data: { userId, type, title, body, resourceType, resourceId },
  });
}

export async function consultationRoutes(fastify: FastifyInstance) {
  fastify.get('/consultations', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_LIST)],
  }, async (request) => {
    const query = request.query as { status?: string; mine?: string };
    const userId = request.user.userId;
    const userRole = request.user.role;
    const hospitalId = request.user.hospitalId;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (userRole !== 'ADMIN' && hospitalId) {
      where.hospitalId = hospitalId;
    }
    if (query.mine === 'true') {
      where.participants = { some: { userId } };
    }

    const consultations = await prisma.consultation.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        createdBy: { select: { id: true, realName: true, username: true, avatarUrl: true } },
        participants: {
          include: {
            user: { select: { id: true, realName: true, username: true, avatarUrl: true, role: { select: { name: true } } } },
          },
        },
        study: { select: { id: true, orthancStudyId: true, modality: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return consultations;
  });

  fastify.get('/consultations/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_LIST)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const consultation = await prisma.consultation.findUnique({
      where: { id: parseInt(id) },
      include: {
        patient: true,
        study: true,
        hospital: true,
        createdBy: { select: { id: true, realName: true, username: true, avatarUrl: true } },
        participants: {
          include: {
            user: { select: { id: true, realName: true, username: true, avatarUrl: true, role: { select: { name: true, displayName: true } } } },
          },
          orderBy: { role: 'asc' },
        },
        messages: {
          include: {
            user: { select: { id: true, realName: true, username: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        reports: {
          include: {
            signedBy: { select: { id: true, realName: true } },
          },
        },
      },
    });
    if (!consultation) return reply.status(404).send({ error: '会诊不存在' });
    return consultation;
  });

  fastify.get('/consultations/:id/video-token', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_JOIN)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;
    const consultationId = parseInt(id);

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) return reply.status(404).send({ error: '会诊不存在' });

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL || 'ws://livekit:7880';

    if (!apiKey || !apiSecret) {
      return reply.status(500).send({ error: 'LiveKit 配置缺失' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { realName: true, username: true },
    });

    const participantIdentity = `user_${userId}`;
    const participantName = user?.realName || user?.username || `User ${userId}`;

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    token.addGrant({ roomJoin: true, room: consultation.jitsiRoomName });

    return { token: await token.toJwt(), url: livekitUrl };
  });

  fastify.post('/consultations', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_CREATE)],
  }, async (request) => {
    const userId = request.user.userId;
    const hospitalId = request.user.hospitalId;
    const data = request.body as {
      title: string;
      description?: string;
      patientId: number;
      studyId?: number;
      scheduledAt?: string;
      participants?: { userId: number; role: ParticipantRole }[];
    };

    const consultation = await prisma.consultation.create({
      data: {
        jitsiRoomName: uuidv4(),
        title: data.title,
        description: data.description,
        patientId: data.patientId,
        studyId: data.studyId,
        hospitalId,
        createdById: userId,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        status: data.participants && data.participants.length > 0 ? 'INVITED' : 'CREATED',
        participants: {
          create: [
            { userId, role: 'INITIATOR', status: 'ACCEPTED', respondedAt: new Date() },
            ...(data.participants || []).map((p) => ({
              userId: p.userId,
              role: p.role || 'EXPERT',
              status: 'INVITED' as ParticipantStatus,
            })),
          ],
        },
      },
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        createdBy: { select: { id: true, realName: true, username: true, avatarUrl: true } },
        participants: {
          include: {
            user: { select: { id: true, realName: true, username: true, avatarUrl: true } },
          },
        },
      },
    });

    if (data.participants && data.participants.length > 0) {
      for (const p of data.participants) {
        await notifyUser(
          p.userId,
          'CONSULTATION_INVITE',
          '会诊邀请',
          `${request.user.username} 邀请您参加会诊「${data.title}」`,
          'CONSULTATION',
          consultation.id,
        );
      }
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        resourceType: 'CONSULTATION',
        resourceId: consultation.id,
        detail: { title: data.title },
      },
    });

    return consultation;
  });

  fastify.put('/consultations/:id/status', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_JOIN)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;
    const data = request.body as { status: ConsultationStatus };
    const consultationId = parseInt(id);

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { participants: true, createdBy: { select: { realName: true, username: true } } },
    });

    if (!consultation) return reply.status(404).send({ error: '会诊不存在' });

    const allowed = VALID_TRANSITIONS[consultation.status] || [];
    if (!allowed.includes(data.status)) {
      return reply.status(400).send({
        error: `不允许从 ${consultation.status} 转换到 ${data.status}`,
        allowedTransitions: allowed,
      });
    }

    const isInitiator = consultation.createdById === userId;
    const isParticipant = consultation.participants.some(
      (p) => p.userId === userId && (p.role === 'INITIATOR' || p.role === 'EXPERT')
    );

    if (data.status === 'CANCELLED' && !isInitiator && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '只有发起人才能取消会诊' });
    }

    if (data.status === 'IN_PROGRESS' && !isInitiator && !isParticipant) {
      return reply.status(403).send({ error: '只有参与人才能开始会诊' });
    }

    if (data.status === 'ARCHIVED' && !isInitiator && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '只有发起人才能归档会诊' });
    }

    const updateData: any = { status: data.status };

    if (data.status === 'IN_PROGRESS') {
      updateData.startedAt = new Date();
      const participant = consultation.participants.find((p) => p.userId === userId);
      if (participant && participant.status === 'ACCEPTED') {
        await prisma.consultationParticipant.update({
          where: { id: participant.id },
          data: { status: 'JOINED', joinedAt: new Date() },
        });
      }
    } else if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
      updateData.endedAt = new Date();
    } else if (data.status === 'ARCHIVED') {
      updateData.archivedAt = new Date();
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: updateData,
      include: {
        patient: { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, realName: true, avatarUrl: true } } } },
      },
    });

    for (const p of consultation.participants) {
      if (p.userId !== userId) {
        const statusLabel = data.status === 'IN_PROGRESS' ? '已开始' :
          data.status === 'COMPLETED' ? '已结束' : '已取消';
        await notifyUser(
          p.userId,
          'CONSULTATION_STATUS',
          '会诊状态变更',
          `会诊「${consultation.title}」${statusLabel}`,
          'CONSULTATION',
          consultationId,
        );
      }
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: data.status === 'IN_PROGRESS' ? 'START_CONSULTATION' :
          data.status === 'COMPLETED' ? 'END_CONSULTATION' : 'UPDATE',
        resourceType: 'CONSULTATION',
        resourceId: consultationId,
        detail: { from: consultation.status, to: data.status },
      },
    });

    return updated;
  });

  fastify.put('/consultations/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_MANAGE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;
    const data = request.body as { title?: string; description?: string; scheduledAt?: string };
    const consultationId = parseInt(id);

    const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation) return reply.status(404).send({ error: '会诊不存在' });
    if (consultation.createdById !== userId && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '只有发起人才能编辑会诊' });
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        title: data.title,
        description: data.description,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    });
    return updated;
  });

  fastify.post('/consultations/:id/participants/invite', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_CREATE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;
    const data = request.body as { participants: { userId: number; role: ParticipantRole }[] };
    const consultationId = parseInt(id);

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { participants: true },
    });

    if (!consultation) return reply.status(404).send({ error: '会诊不存在' });
    if (consultation.createdById !== userId && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '只有发起人才能邀请参与人' });
    }

    if (consultation.status !== 'CREATED' && consultation.status !== 'INVITED' && consultation.status !== 'SCHEDULED') {
      return reply.status(400).send({ error: '当前状态不允许邀请参与人' });
    }

    const existingUserIds = consultation.participants.map((p) => p.userId);
    const newParticipants = data.participants.filter((p) => !existingUserIds.includes(p.userId));

    if (newParticipants.length === 0) {
      return reply.status(400).send({ error: '没有新的参与人可邀请' });
    }

    await prisma.consultationParticipant.createMany({
      data: newParticipants.map((p) => ({
        consultationId,
        userId: p.userId,
        role: p.role || 'EXPERT',
        status: 'INVITED',
      })),
    });

    if (consultation.status === 'CREATED') {
      await prisma.consultation.update({
        where: { id: consultationId },
        data: { status: 'INVITED' },
      });
    }

    for (const p of newParticipants) {
      await notifyUser(
        p.userId,
        'CONSULTATION_INVITE',
        '会诊邀请',
        `${request.user.username} 邀请您参加会诊「${consultation.title}」`,
        'CONSULTATION',
        consultationId,
      );
    }

    const updated = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        participants: {
          include: { user: { select: { id: true, realName: true, username: true, avatarUrl: true } } },
        },
      },
    });
    return updated;
  });

  fastify.put('/consultations/:id/participants/:userId/respond', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_JOIN)],
  }, async (request, reply) => {
    const { id, userId: participantUserId } = request.params as { id: string; userId: string };
    const currentUserId = request.user.userId;
    const data = request.body as { status: 'ACCEPTED' | 'DECLINED' };
    const consultationId = parseInt(id);
    const pUserId = parseInt(participantUserId);

    if (currentUserId !== pUserId && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '只能响应自己的邀请' });
    }

    const participant = await prisma.consultationParticipant.findUnique({
      where: { consultationId_userId: { consultationId, userId: pUserId } },
      include: { consultation: { include: { createdBy: { select: { id: true, realName: true } } } } },
    });

    if (!participant) return reply.status(404).send({ error: '参与记录不存在' });
    if (participant.status !== 'INVITED') {
      return reply.status(400).send({ error: '当前状态不允许响应' });
    }

    await prisma.consultationParticipant.update({
      where: { id: participant.id },
      data: {
        status: data.status,
        respondedAt: new Date(),
      },
    });

    await notifyUser(
      participant.consultation.createdById,
      'CONSULTATION_RESPONSE',
      '会诊邀请回复',
      `用户已${data.status === 'ACCEPTED' ? '接受' : '拒绝'}会诊「${participant.consultation.title}」的邀请`,
      'CONSULTATION',
      consultationId,
    );

    return { success: true, status: data.status };
  });

  fastify.put('/consultations/:id/participants/:userId/join', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_JOIN)],
  }, async (request, reply) => {
    const { id, userId: participantUserId } = request.params as { id: string; userId: string };
    const currentUserId = request.user.userId;
    const consultationId = parseInt(id);
    const pUserId = parseInt(participantUserId);

    if (currentUserId !== pUserId && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '只能更新自己的状态' });
    }

    const participant = await prisma.consultationParticipant.findUnique({
      where: { consultationId_userId: { consultationId, userId: pUserId } },
    });

    if (!participant) return reply.status(404).send({ error: '参与记录不存在' });

    await prisma.consultationParticipant.update({
      where: { id: participant.id },
      data: { status: 'JOINED', joinedAt: new Date() },
    });

    return { success: true, status: 'JOINED' };
  });

  fastify.put('/consultations/:id/participants/:userId/leave', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_JOIN)],
  }, async (request, reply) => {
    const { id, userId: participantUserId } = request.params as { id: string; userId: string };
    const currentUserId = request.user.userId;
    const consultationId = parseInt(id);
    const pUserId = parseInt(participantUserId);

    if (currentUserId !== pUserId && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '只能更新自己的状态' });
    }

    const participant = await prisma.consultationParticipant.findUnique({
      where: { consultationId_userId: { consultationId, userId: pUserId } },
    });

    if (!participant) return reply.status(404).send({ error: '参与记录不存在' });

    await prisma.consultationParticipant.update({
      where: { id: participant.id },
      data: { status: 'LEFT' },
    });

    return { success: true, status: 'LEFT' };
  });

  fastify.delete('/consultations/:id/participants/:userId', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_MANAGE)],
  }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const consultationId = parseInt(id);

    const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation) return reply.status(404).send({ error: '会诊不存在' });
    if (consultation.createdById !== request.user.userId && request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: '只有发起人才能移除参与人' });
    }

    await prisma.consultationParticipant.deleteMany({
      where: { consultationId, userId: parseInt(userId) },
    });
    return { success: true };
  });

  fastify.get('/consultations/:id/messages', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_LIST)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const messages = await prisma.consultationMessage.findMany({
      where: { consultationId: parseInt(id) },
      include: {
        user: { select: { id: true, realName: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return messages;
  });

  fastify.post('/consultations/:id/messages', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.CONSULTATION_JOIN)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;
    const data = request.body as { content: string; type?: string };
    const consultationId = parseInt(id);

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) return reply.status(404).send({ error: '会诊不存在' });
    if (consultation.status !== 'IN_PROGRESS' && consultation.status !== 'INVITED' && consultation.status !== 'SCHEDULED') {
      return reply.status(400).send({ error: '当前状态不允许发送消息' });
    }

    const message = await prisma.consultationMessage.create({
      data: {
        consultationId,
        userId,
        content: data.content,
        type: data.type || 'TEXT',
      },
      include: {
        user: { select: { id: true, realName: true, username: true, avatarUrl: true } },
      },
    });
    return message;
  });
}
