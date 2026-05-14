import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { prisma } from './lib/prisma.js';
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

dotenv.config();

const fastify = Fastify({ logger: true });

fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
});

await fastify.register(helmet);

await fastify.register(rateLimit, {
  max: 60,
  timeWindow: '1 minute',
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
});

await fastify.register(websocket);

await fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024,
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

fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/api/dashboard/stats', { preHandler: [fastify.authenticate] }, async () => {
  const [userCount, patientCount, studyCount, consultationCount] = await Promise.all([
    prisma.user.count(),
    prisma.patient.count(),
    prisma.study.count(),
    prisma.consultation.count(),
  ]);

  return { userCount, patientCount, studyCount, consultationCount };
});

fastify.get('/api/dashboard/recent-activities', { preHandler: [fastify.authenticate] }, async () => {
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

fastify.get('/api/dashboard/pending', { preHandler: [fastify.authenticate] }, async () => {
  const [pendingConsultations, draftReports] = await Promise.all([
    prisma.consultation.findMany({
      where: { status: 'CREATED' },
      include: { patient: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.report.findMany({
      where: { status: 'DRAFT' },
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
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
