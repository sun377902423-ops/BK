import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get('/notifications', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const query = request.query as { unreadOnly?: string };
    const where: any = { userId };
    if (query.unreadOnly === 'true') where.isRead = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return notifications;
  });

  fastify.get('/notifications/unread-count', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  });

  fastify.put('/notifications/:id/read', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const userId = request.user.userId;

    const notification = await prisma.notification.findUnique({
      where: { id: parseInt(id) },
    });

    if (!notification || notification.userId !== userId) {
      return { success: false };
    }

    await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  });

  fastify.put('/notifications/read-all', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  });
}
