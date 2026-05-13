import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';
import bcrypt from 'bcrypt';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/users', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_LIST)],
  }, async () => {
    const users = await prisma.user.findMany({
      include: { role: true, hospital: true },
      orderBy: { createdAt: 'desc' },
    });
    return users;
  });

  fastify.get('/users/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_LIST)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: { role: true, hospital: true },
    });
    return user;
  });

  fastify.post('/users', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_CREATE)],
  }, async (request) => {
    const data = request.body as any;
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        realName: data.realName,
        email: data.email,
        phone: data.phone,
        roleId: data.roleId,
        hospitalId: data.hospitalId,
      },
      include: { role: true },
    });
    return user;
  });

  fastify.put('/users/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_UPDATE)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const updateData: any = {
      realName: data.realName,
      email: data.email,
      phone: data.phone,
      roleId: data.roleId,
      hospitalId: data.hospitalId,
    };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: { role: true },
    });
    return user;
  });

  fastify.put('/users/:id/status', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_UPDATE)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
    });
    const newStatus = user?.status === 'active' ? 'inactive' : 'active';
    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status: newStatus },
      include: { role: true },
    });
    return updated;
  });
}
