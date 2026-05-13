import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { ROLE_PERMISSIONS, type Permission } from '../lib/permissions.js';
import bcrypt from 'bcrypt';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };

    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user) {
      return reply.status(401).send({ error: '用户名或密码错误' });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return reply.status(401).send({ error: '用户名或密码错误' });
    }

    if (user.status !== 'active') {
      return reply.status(403).send({ error: '账号已被禁用' });
    }

    const token = fastify.jwt.sign({
      userId: user.id,
      username: user.username,
      role: user.role.name,
      hospitalId: user.hospitalId,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        resourceType: 'USER',
        resourceId: user.id,
      },
    });

    let permissions: Permission[] = ROLE_PERMISSIONS[user.role.name] || [];
    if (!permissions.length && user.role.permissions) {
      try {
        permissions = typeof user.role.permissions === 'string'
          ? JSON.parse(user.role.permissions)
          : user.role.permissions;
      } catch { /* empty */ }
    }

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        email: user.email,
        role: user.role.name,
        hospitalId: user.hospitalId,
        permissions,
      },
    };
  });

  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    let permissions: Permission[] = ROLE_PERMISSIONS[user?.role?.name || ''] || [];
    if (!permissions.length && user?.role?.permissions) {
      try {
        permissions = typeof user.role.permissions === 'string'
          ? JSON.parse(user.role.permissions)
          : user.role.permissions;
      } catch { /* empty */ }
    }

    return {
      id: user?.id,
      username: user?.username,
      realName: user?.realName,
      email: user?.email,
      role: user?.role.name,
      hospitalId: user?.hospitalId,
      permissions,
    };
  });
}
