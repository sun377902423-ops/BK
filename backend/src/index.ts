import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { prisma } from './lib/prisma.js';
import { authorize } from './lib/authorize.js';
import { PERMISSIONS } from './lib/permissions.js';
import { authRoutes } from './routes/auth.js';
import { patientRoutes } from './routes/patients.js';
import { studyRoutes } from './routes/studies.js';
import { consultationRoutes } from './routes/consultations.js';
import { hospitalRoutes } from './routes/hospitals.js';
import { userRoutes } from './routes/users.js';
import { reportRoutes } from './routes/reports.js';
import { roleRoutes } from './routes/roles.js';
import { notificationRoutes } from './routes/notifications.js';
import { logRoutes } from './routes/logs.js';
import { deviceRoutes } from './routes/devices.js';
import { backupRoutes, startupBackupCheck, scheduleBackupCheck } from './routes/backups.js';
import { syncAllOrthancStudies } from './routes/studies.js';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32 || jwtSecret === 'dev-secret-change-me') {
  console.error('[FATAL] JWT_SECRET 未设置或长度不足 32 字符。请在环境变量中提供强随机密钥。');
  process.exit(1);
}

const corsOriginsRaw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
const corsOrigins = corsOriginsRaw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowAllCors = corsOrigins.length === 0 || corsOrigins.includes('*');

const fastify = Fastify({ logger: true });

fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: '未认证' });
  }
});

await fastify.register(cors, {
  origin: (origin, cb) => {
    if (allowAllCors) {
      cb(null, true);
      return;
    }
    if (!origin) {
      cb(null, true);
      return;
    }
    if (corsOrigins.includes(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error('CORS 来源不被允许'), false);
  },
  credentials: true,
});

await fastify.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

await fastify.register(rateLimit, {
  max: 120,
  timeWindow: '1 minute',
});

await fastify.register(jwt, {
  secret: jwtSecret,
  sign: {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },
});

await fastify.register(multipart, {
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_BYTES || `${100 * 1024 * 1024}`, 10),
  },
});

const uploadsDir = '/app/uploads/avatars';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

await fastify.register(staticPlugin, {
  root: path.resolve('/app/uploads'),
  prefix: '/uploads/',
  decorateReply: false,
});

await fastify.register(authRoutes, { prefix: '/api' });
await fastify.register(patientRoutes, { prefix: '/api' });
await fastify.register(studyRoutes, { prefix: '/api' });
await fastify.register(consultationRoutes, { prefix: '/api' });
await fastify.register(hospitalRoutes, { prefix: '/api' });
await fastify.register(userRoutes, { prefix: '/api' });
await fastify.register(reportRoutes, { prefix: '/api' });
await fastify.register(roleRoutes, { prefix: '/api' });
await fastify.register(notificationRoutes, { prefix: '/api' });
await fastify.register(logRoutes, { prefix: '/api' });
await fastify.register(deviceRoutes, { prefix: '/api' });
await fastify.register(backupRoutes, { prefix: '/api' });

fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/api/dashboard/stats', {
  preHandler: [fastify.authenticate, authorize(PERMISSIONS.SYSTEM_AUDIT)],
}, async () => {
  const [userCount, patientCount, studyCount, consultationCount] = await Promise.all([
    prisma.user.count(),
    prisma.patient.count(),
    prisma.study.count(),
    prisma.consultation.count(),
  ]);

  return { userCount, patientCount, studyCount, consultationCount };
});

fastify.get('/api/dashboard/recent-activities', {
  preHandler: [fastify.authenticate, authorize(PERMISSIONS.SYSTEM_AUDIT)],
}, async () => {
  const activities = await prisma.auditLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          realName: true,
        },
      },
    },
  });
  return activities;
});

fastify.get('/api/dashboard/pending', { preHandler: [fastify.authenticate] }, async (request) => {
  const user = (request as any).user;
  const userId = user.userId;
  const userRole = user.role;
  const hospitalId = user.hospitalId;

  const baseFilter: any = {};
  if (userRole !== 'ADMIN') {
    baseFilter.OR = [
      { createdById: userId },
      { participants: { some: { userId } } },
    ];
    if (hospitalId) baseFilter.OR.push({ hospitalId });
  }

  const reportFilter: any = {};
  if (userRole !== 'ADMIN' && hospitalId) {
    reportFilter.patient = { hospitalId };
  }

  const [pendingConsultations, draftReports] = await Promise.all([
    prisma.consultation.findMany({
      where: { status: 'CREATED', ...baseFilter },
      include: { patient: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.report.findMany({
      where: { status: 'DRAFT', ...reportFilter },
      include: { patient: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return { pendingConsultations, draftReports };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ host: '0.0.0.0', port });
    console.log(`Server running on http://0.0.0.0:${port}`);

    setTimeout(() => startupBackupCheck(), 10000);

    setInterval(() => scheduleBackupCheck(), 60000);

    setInterval(async () => {
      try {
        const result = await syncAllOrthancStudies();
        if (result.synced > 0) {
          console.log(`Auto-sync: ${result.synced} new studies, ${result.patientsCreated} patients created`);
        }
      } catch (e) {
        console.error('Auto-sync failed:', e);
      }
    }, 5 * 60 * 1000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
