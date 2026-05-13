import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './prisma.js';
import { ROLE_PERMISSIONS, type Permission } from './permissions.js';

const rolePermissionsCache = new Map<number, Permission[]>();

async function getUserPermissions(userId: number, roleName: string): Promise<Permission[]> {
  if (ROLE_PERMISSIONS[roleName]) {
    return ROLE_PERMISSIONS[roleName];
  }

  const cached = rolePermissionsCache.get(userId);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user?.role?.permissions) return [];

  let perms: Permission[];
  try {
    perms = typeof user.role.permissions === 'string'
      ? JSON.parse(user.role.permissions)
      : user.role.permissions;
  } catch {
    perms = [];
  }

  rolePermissionsCache.set(userId, perms);
  return perms;
}

export function clearPermissionsCache(userId?: number) {
  if (userId) {
    rolePermissionsCache.delete(userId);
  } else {
    rolePermissionsCache.clear();
  }
}

export function authorize(...requiredPermissions: Permission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ error: '未认证' });
    }

    const roleName = user.role as string;
    if (roleName === 'ADMIN') return;

    const userPermissions = await getUserPermissions(user.userId, roleName);

    const hasPermission = requiredPermissions.some((perm) =>
      userPermissions.includes(perm)
    );

    if (!hasPermission) {
      return reply.status(403).send({ error: '权限不足' });
    }
  };
}
