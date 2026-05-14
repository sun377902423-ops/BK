import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

const UPLOAD_DIR = '/app/uploads/avatars';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;
const AVATAR_SIZE = 200;
const AVATAR_QUALITY = 80;

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

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

  fastify.post('/users/avatar', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).userId;
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: '请选择要上传的图片' });
    }

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({ error: '仅支持 JPG、PNG、GIF、WebP 格式' });
    }

    const fileBuffer = await data.toBuffer();
    if (fileBuffer.length > MAX_SIZE) {
      return reply.status(400).send({ error: '图片大小不能超过 5MB' });
    }

    ensureUploadDir();

    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(fileBuffer)
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'center' })
        .webp({ quality: AVATAR_QUALITY })
        .toBuffer();
    } catch {
      return reply.status(400).send({ error: '图片处理失败，请更换图片重试' });
    }

    const filename = `${userId}_${crypto.randomBytes(8).toString('hex')}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    fs.writeFileSync(filepath, processedBuffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    if (existingUser?.avatarUrl) {
      const oldPath = path.join('/app', existingUser.avatarUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath) && oldPath.startsWith(UPLOAD_DIR)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    return { avatarUrl };
  });

  fastify.put('/users/profile', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const userId = (request.user as any).userId;
    const data = request.body as any;
    const updateData: any = {};
    if (data.realName !== undefined) updateData.realName = data.realName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.oldPassword && data.newPassword) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return { error: '用户不存在' };
      const valid = await bcrypt.compare(data.oldPassword, user.passwordHash);
      if (!valid) return { error: '原密码错误' };
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { role: true },
    });
    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role.name,
      hospitalId: user.hospitalId,
    };
  });
}
