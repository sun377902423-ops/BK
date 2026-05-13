import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

export async function authRoutes(fastify: FastifyInstance) {
  // 登录
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
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        resourceType: 'USER',
        resourceId: user.id,
      },
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        email: user.email,
        role: user.role.name,
      },
    };
  });

  // 获取当前用户信息
  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    return {
      id: user?.id,
      username: user?.username,
      realName: user?.realName,
      email: user?.email,
      role: user?.role.name,
      permissions: user?.role.permissions,
    };
  });
}
