import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './prisma.js';
import { ROLE_PERMISSIONS, type Permission } from './permissions.js';

interface CacheEntry {
  permissions: Permission[];
  expiresAt: number;
}

const PERM_CACHE_TTL_MS = 60_000;
const rolePermissionsCache = new Map<number, CacheEntry>();

async function getUserPermissions(userId: number, roleName: string): Promise<Permission[]> {
  if (ROLE_PERMISSIONS[roleName]) {
    return ROLE_PERMISSIONS[roleName];
  }

  const now = Date.now();
  const cached = rolePermissionsCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.permissions;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user?.role?.permissions) {
    rolePermissionsCache.set(userId, { permissions: [], expiresAt: now + PERM_CACHE_TTL_MS });
    return [];
  }

  let perms: Permission[];
  try {
    perms = typeof user.role.permissions === 'string'
      ? JSON.parse(user.role.permissions)
      : (user.role.permissions as unknown as Permission[]);
    if (!Array.isArray(perms)) perms = [];
  } catch {
    perms = [];
  }

  rolePermissionsCache.set(userId, { permissions: perms, expiresAt: now + PERM_CACHE_TTL_MS });
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
