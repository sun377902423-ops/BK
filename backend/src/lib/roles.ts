import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS, PERMISSION_GROUPS, ROLE_PERMISSIONS } from '../lib/permissions.js';

export async function roleRoutes(fastify: FastifyInstance) {
  fastify.get('/roles', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_ASSIGN_ROLE)],
  }, async () => {
    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { id: 'asc' },
    });
    return roles.map((role) => ({
      ...role,
      permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions,
    }));
  });

  fastify.get('/roles/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_ASSIGN_ROLE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const role = await prisma.role.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { users: true } } },
    });
    if (!role) return reply.status(404).send({ error: '角色不存在' });
    return {
      ...role,
      permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions,
    };
  });

  fastify.post('/roles', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_ASSIGN_ROLE)],
  }, async (request, reply) => {
    const data = request.body as { name: string; displayName: string; permissions: string[] };
    const existing = await prisma.role.findFirst({
      where: { displayName: data.displayName },
    });
    if (existing) return reply.status(400).send({ error: '角色名称已存在' });

    const role = await prisma.role.create({
      data: {
        name: data.name as any,
        displayName: data.displayName,
        permissions: JSON.stringify(data.permissions || []),
        isSystem: false,
      },
    });
    return {
      ...role,
      permissions: data.permissions || [],
    };
  });

  fastify.put('/roles/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_ASSIGN_ROLE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as { displayName?: string; permissions?: string[] };

    const role = await prisma.role.findUnique({ where: { id: parseInt(id) } });
    if (!role) return reply.status(404).send({ error: '角色不存在' });
    if (role.isSystem && data.displayName) {
      return reply.status(400).send({ error: '系统角色不允许修改名称' });
    }

    const updateData: any = {};
    if (data.displayName) updateData.displayName = data.displayName;
    if (data.permissions) updateData.permissions = JSON.stringify(data.permissions);

    const updated = await prisma.role.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    return {
      ...updated,
      permissions: data.permissions || (typeof updated.permissions === 'string' ? JSON.parse(updated.permissions) : updated.permissions),
    };
  });

  fastify.delete('/roles/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_ASSIGN_ROLE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const role = await prisma.role.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { users: true } } },
    });
    if (!role) return reply.status(404).send({ error: '角色不存在' });
    if (role.isSystem) return reply.status(400).send({ error: '系统角色不允许删除' });
    if (role._count.users > 0) return reply.status(400).send({ error: '角色下还有用户，不允许删除' });

    await prisma.role.delete({ where: { id: parseInt(id) } });
    return { success: true };
  });

  fastify.get('/permissions/groups', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_ASSIGN_ROLE)],
  }, async () => {
    return PERMISSION_GROUPS;
  });

  fastify.get('/permissions/templates', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.USER_ASSIGN_ROLE)],
  }, async () => {
    return ROLE_PERMISSIONS;
  });
}
