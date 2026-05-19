import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || '/app/backups');

function dbUrlFromEnv(): URL | null {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

const DB_URL = dbUrlFromEnv();
const DB_HOST = DB_URL?.hostname || process.env.POSTGRES_HOST || 'postgres';
const DB_PORT = DB_URL?.port || process.env.POSTGRES_PORT || '5432';
const DB_NAME = DB_URL ? decodeURIComponent(DB_URL.pathname.replace(/^\//, '')) : (process.env.POSTGRES_DB || 'bksys_med');
const DB_USER = DB_URL?.username ? decodeURIComponent(DB_URL.username) : (process.env.POSTGRES_USER || 'bksys');
const DB_PASSWORD = DB_URL?.password ? decodeURIComponent(DB_URL.password) : (process.env.POSTGRES_PASSWORD || '');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeInsideBackupDir(target: string): boolean {
  const resolved = path.resolve(target);
  return resolved === BACKUP_DIR || resolved.startsWith(BACKUP_DIR + path.sep);
}

function getDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const res = spawnSync('du', ['-sb', dirPath], { encoding: 'utf-8' });
    const out = (res.stdout || '').trim().split(/\s+/)[0];
    return parseInt(out, 10) || 0;
  } catch {
    return 0;
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace(/[-T:]/g, '');
}

function sanitizeBackupConfigForResponse<T extends { remotePassword?: string | null }>(config: T | null): any {
  if (!config) return config;
  const { remotePassword, ...rest } = config as any;
  return {
    ...rest,
    remotePasswordSet: !!remotePassword,
  };
}

async function performBackup(config: any, triggerType: string): Promise<any> {
  const startedAt = new Date();
  const dateStr = formatDate(startedAt);
  const timestamp = formatDateTime(startedAt);

  const record = await prisma.backupRecord.create({
    data: {
      configId: config?.id || null,
      type: 'full',
      status: 'running',
      triggerType,
      startedAt,
    },
  });

  try {
    ensureDir(BACKUP_DIR);
    const backupName = `bksys_backup_${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    if (!safeInsideBackupDir(backupPath)) throw new Error('Invalid backup path');
    ensureDir(backupPath);

    const previousSize = config?.lastBackupSize || 0;

    const dbDumpFile = path.join(backupPath, 'database.sql.gz');
    {
      const pgArgs = [
        '-h', DB_HOST,
        '-p', DB_PORT,
        '-U', DB_USER,
        '-d', DB_NAME,
        '--no-owner',
        '--no-privileges',
      ];
      const out = fs.openSync(dbDumpFile, 'w');
      try {
        const dump = spawnSync('pg_dump', pgArgs, {
          env: { ...process.env, PGPASSWORD: DB_PASSWORD },
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 300000,
        });
        if (dump.status !== 0) throw new Error(`pg_dump failed: ${(dump.stderr || '').toString().slice(0, 300)}`);
        const gz = spawnSync('gzip', ['-c'], { input: dump.stdout, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 1024 });
        if (gz.status !== 0) throw new Error('gzip failed');
        fs.writeSync(out, gz.stdout);
      } finally {
        fs.closeSync(out);
      }
    }
    const databaseSize = fs.statSync(dbDumpFile).size;

    let orthancSize = 0;
    if (config?.includeOrthanc !== false) {
      const orthancDir = '/var/lib/orthanc/db';
      if (fs.existsSync(orthancDir)) {
        const target = path.join(backupPath, 'orthanc');
        ensureDir(target);
        const cp = spawnSync('cp', ['-r', orthancDir + '/.', target + '/'], { stdio: 'pipe' });
        if (cp.status !== 0) console.warn('orthanc copy non-zero exit');
        orthancSize = getDirSize(target);
      }
    }

    let uploadsSize = 0;
    if (config?.includeUploads !== false) {
      const uploadsDir = '/app/uploads';
      if (fs.existsSync(uploadsDir)) {
        const target = path.join(backupPath, 'uploads');
        ensureDir(target);
        const cp = spawnSync('cp', ['-r', uploadsDir + '/.', target + '/'], { stdio: 'pipe' });
        if (cp.status !== 0) console.warn('uploads copy non-zero exit');
        uploadsSize = getDirSize(target);
      }
    }

    const archivePath = path.join(BACKUP_DIR, `${backupName}.tar.gz`);
    if (!safeInsideBackupDir(archivePath)) throw new Error('Invalid archive path');
    const tar = spawnSync('tar', ['-czf', archivePath, '-C', BACKUP_DIR, backupName], { stdio: 'pipe' });
    if (tar.status !== 0) throw new Error('tar failed');

    const rm = spawnSync('rm', ['-rf', backupPath], { stdio: 'pipe' });
    if (rm.status !== 0) console.warn('rm tmp dir non-zero exit');

    const fileSize = fs.statSync(archivePath).size;

    let sizeVerified = true;
    if (previousSize > 0 && fileSize < previousSize * 0.5) {
      sizeVerified = false;
      console.warn(`Backup size ${fileSize} is suspiciously smaller than previous ${previousSize}`);
    }

    const completedAt = new Date();
    const duration = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        status: sizeVerified ? 'completed' : 'size_warning',
        filePath: archivePath,
        fileSize,
        previousSize,
        sizeVerified,
        databaseSize,
        orthancSize,
        uploadsSize,
        completedAt,
        duration,
      },
    });

    if (config?.id) {
      await prisma.backupConfig.update({
        where: { id: config.id },
        data: { lastBackupAt: completedAt, lastBackupSize: fileSize },
      });
    }

    if (config?.remoteHost && config?.remotePath) {
      try {
        const target = `${config.remoteUser || 'root'}@${config.remoteHost}:${config.remotePath}`;
        const args = ['-o', 'StrictHostKeyChecking=no'];
        if (config.remotePort) args.push('-P', String(parseInt(config.remotePort, 10) || 22));
        args.push(archivePath, target);
        const env = { ...process.env };
        let cmd = 'scp';
        let cmdArgs = args;
        if (config.remotePassword) {
          cmd = 'sshpass';
          cmdArgs = ['-e', 'scp', ...args];
          env.SSHPASS = config.remotePassword;
        }
        const r = spawnSync(cmd, cmdArgs, { env, stdio: 'pipe', timeout: 600000 });
        if (r.status !== 0) {
          console.error('Remote backup failed:', (r.stderr || '').toString().slice(0, 300));
        }
      } catch (e: any) {
        console.error('Remote backup failed:', e.message);
      }
    }

    return { success: true, recordId: record.id, fileSize, sizeVerified };
  } catch (error: any) {
    const completedAt = new Date();
    const duration = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        status: 'failed',
        errorMessage: error.message?.slice(0, 500),
        completedAt,
        duration,
      },
    });

    return { success: false, recordId: record.id, error: error.message };
  }
}

async function cleanupOldBackups(retentionDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const oldRecords = await prisma.backupRecord.findMany({
    where: {
      status: { in: ['completed', 'size_warning'] },
      completedAt: { lt: cutoff },
    },
  });

  for (const record of oldRecords) {
    if (record.filePath && fs.existsSync(record.filePath) && safeInsideBackupDir(record.filePath)) {
      fs.unlinkSync(record.filePath);
    }
    await prisma.backupRecord.delete({ where: { id: record.id } });
  }

  return oldRecords.length;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/\\/g, '_')
    .replace(/\//g, '_')
    .replace(/\.\./g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 200);
}

export async function backupRoutes(fastify: FastifyInstance) {
  fastify.get('/backups/config', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_CONFIG)],
  }, async () => {
    let config = await prisma.backupConfig.findFirst({ where: { name: 'default' } });
    if (!config) {
      config = await prisma.backupConfig.create({ data: { name: 'default' } });
    }
    return sanitizeBackupConfigForResponse(config);
  });

  fastify.put('/backups/config', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_CONFIG)],
  }, async (request) => {
    const body = (request.body || {}) as any;
    const allowedFields = [
      'enabled', 'includeOrthanc', 'includeUploads', 'scheduleTime', 'retentionDays',
      'remoteHost', 'remotePort', 'remoteUser', 'remotePassword', 'remotePath',
    ];
    const data: any = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (data.remotePassword === '') data.remotePassword = null;

    let config = await prisma.backupConfig.findFirst({ where: { name: 'default' } });
    if (!config) {
      config = await prisma.backupConfig.create({ data: { name: 'default', ...data } });
    } else {
      config = await prisma.backupConfig.update({
        where: { id: config.id },
        data,
      });
    }
    return sanitizeBackupConfigForResponse(config);
  });

  fastify.post('/backups/trigger', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_CREATE)],
  }, async (request) => {
    const body = (request.body || {}) as any;
    const triggerType = body?.triggerType === 'scheduled' ? 'scheduled' : 'manual';
    const config = await prisma.backupConfig.findFirst({ where: { name: 'default' } });
    const result = await performBackup(config, triggerType);
    return result;
  });

  fastify.get('/backups/records', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_LIST)],
  }, async (request) => {
    const query = request.query as any;
    const page = Math.max(parseInt(query?.page || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(query?.pageSize || '20', 10) || 20, 1), 100);
    const status = query?.status;

    const where = status ? { status } : {};
    const [records, total] = await Promise.all([
      prisma.backupRecord.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { config: { select: { name: true } } },
      }),
      prisma.backupRecord.count({ where }),
    ]);

    return { records, total, page, pageSize };
  });

  fastify.get('/backups/records/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_LIST)],
  }, async (request, reply) => {
    const { id } = request.params as any;
    const record = await prisma.backupRecord.findUnique({
      where: { id: parseInt(id, 10) },
      include: { config: true },
    });
    if (!record) return reply.status(404).send({ error: 'Record not found' });
    const sanitized = { ...record, config: sanitizeBackupConfigForResponse(record.config as any) };
    return sanitized;
  });

  fastify.get('/backups/download/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_LIST)],
  }, async (request, reply) => {
    const { id } = request.params as any;
    const record = await prisma.backupRecord.findUnique({ where: { id: parseInt(id, 10) } });
    if (!record || !record.filePath || !fs.existsSync(record.filePath)) {
      return reply.code(404).send({ error: 'Backup file not found' });
    }
    if (!safeInsideBackupDir(record.filePath)) {
      return reply.code(403).send({ error: '非法的备份路径' });
    }
    const stream = fs.createReadStream(record.filePath);
    reply.header('Content-Type', 'application/gzip');
    reply.header('Content-Disposition', `attachment; filename="${path.basename(record.filePath)}"`);
    return stream;
  });

  fastify.post('/backups/restore/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_RESTORE)],
  }, async (request, reply) => {
    const { id } = request.params as any;
    const record = await prisma.backupRecord.findUnique({ where: { id: parseInt(id, 10) } });
    if (!record || !record.filePath || !fs.existsSync(record.filePath)) {
      return reply.status(404).send({ success: false, error: 'Backup file not found' });
    }
    if (!safeInsideBackupDir(record.filePath)) {
      return reply.status(403).send({ success: false, error: '非法的备份路径' });
    }

    try {
      const restoreDir = path.join(BACKUP_DIR, `restore_${Date.now()}`);
      if (!safeInsideBackupDir(restoreDir)) throw new Error('Invalid restore path');
      ensureDir(restoreDir);
      const tar = spawnSync('tar', ['-xzf', record.filePath, '-C', restoreDir], { stdio: 'pipe' });
      if (tar.status !== 0) throw new Error('tar extract failed');

      const subdirs = fs.readdirSync(restoreDir).filter((n) => !n.includes('..'));
      if (subdirs.length === 0) throw new Error('Empty backup archive');
      const backupDir = path.join(restoreDir, subdirs[0]);
      if (!safeInsideBackupDir(backupDir)) throw new Error('Invalid backup dir');

      const sqlFile = path.join(backupDir, 'database.sql.gz');
      if (fs.existsSync(sqlFile)) {
        const gunzip = spawnSync('gunzip', ['-c', sqlFile]);
        if (gunzip.status !== 0) throw new Error('gunzip failed');
        const psql = spawnSync('psql', [
          '-h', DB_HOST,
          '-p', DB_PORT,
          '-U', DB_USER,
          '-d', DB_NAME,
        ], {
          env: { ...process.env, PGPASSWORD: DB_PASSWORD },
          input: gunzip.stdout,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 300000,
        });
        if (psql.status !== 0) throw new Error(`psql restore failed: ${(psql.stderr || '').toString().slice(0, 300)}`);
      }

      const uploadsBackup = path.join(backupDir, 'uploads');
      if (fs.existsSync(uploadsBackup)) {
        const cp = spawnSync('cp', ['-r', uploadsBackup + '/.', '/app/uploads/'], { stdio: 'pipe' });
        if (cp.status !== 0) console.warn('uploads restore non-zero exit');
      }

      spawnSync('rm', ['-rf', restoreDir], { stdio: 'pipe' });

      await prisma.auditLog.create({
        data: {
          userId: request.user.userId,
          action: 'UPDATE',
          resourceType: 'BACKUP_RESTORE',
          resourceId: record.id,
          detail: { filePath: record.filePath },
        },
      });

      return { success: true, message: 'Database restored successfully' };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  fastify.post('/backups/upload', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_RESTORE)],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const safeName = sanitizeFilename(data.filename);
    const uploadPath = path.join(BACKUP_DIR, safeName);
    if (!safeInsideBackupDir(uploadPath)) {
      return reply.status(400).send({ error: '非法的文件名' });
    }
    ensureDir(BACKUP_DIR);

    const buffer = await data.toBuffer();
    if (buffer.length > 5 * 1024 * 1024 * 1024) {
      return reply.status(413).send({ error: '备份文件过大（>5GB）' });
    }
    fs.writeFileSync(uploadPath, buffer);

    const fileSize = buffer.length;

    const record = await prisma.backupRecord.create({
      data: {
        type: 'imported',
        status: 'completed',
        triggerType: 'import',
        filePath: uploadPath,
        fileSize,
        sizeVerified: true,
        completedAt: new Date(),
        duration: 0,
      },
    });

    return { success: true, recordId: record.id, filePath: uploadPath };
  });

  fastify.delete('/backups/records/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_DELETE)],
  }, async (request, reply) => {
    const { id } = request.params as any;
    const record = await prisma.backupRecord.findUnique({ where: { id: parseInt(id, 10) } });
    if (!record) return reply.status(404).send({ error: 'Record not found' });

    if (record.filePath && fs.existsSync(record.filePath) && safeInsideBackupDir(record.filePath)) {
      fs.unlinkSync(record.filePath);
    }
    await prisma.backupRecord.delete({ where: { id: record.id } });
    return { success: true };
  });

  fastify.post('/backups/cleanup', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_DELETE)],
  }, async () => {
    const config = await prisma.backupConfig.findFirst({ where: { name: 'default' } });
    const retentionDays = config?.retentionDays || 30;
    const count = await cleanupOldBackups(retentionDays);
    return { cleaned: count, retentionDays };
  });

  fastify.get('/backups/status', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_LIST)],
  }, async () => {
    const config = await prisma.backupConfig.findFirst({ where: { name: 'default' } });
    const lastRecord = await prisma.backupRecord.findFirst({
      where: { status: { in: ['completed', 'size_warning'] } },
      orderBy: { completedAt: 'desc' },
    });

    const today = formatDate(new Date());
    const todayBackup = await prisma.backupRecord.findFirst({
      where: {
        status: { in: ['completed', 'size_warning'] },
        startedAt: { gte: new Date(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}`) },
      },
      orderBy: { startedAt: 'desc' },
    });

    const runningBackup = await prisma.backupRecord.findFirst({
      where: { status: 'running' },
    });

    const totalBackups = await prisma.backupRecord.count({
      where: { status: { in: ['completed', 'size_warning'] } },
    });

    let totalSize = 0;
    try {
      if (fs.existsSync(BACKUP_DIR)) {
        totalSize = getDirSize(BACKUP_DIR);
      }
    } catch {}

    return {
      config: sanitizeBackupConfigForResponse(config),
      lastBackup: lastRecord,
      todayBackup: !!todayBackup,
      isRunning: !!runningBackup,
      runningBackup,
      totalBackups,
      totalBackupSize: totalSize,
    };
  });

  fastify.post('/backups/export-usb', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.BACKUP_CREATE)],
  }, async (request, reply) => {
    const body = (request.body || {}) as any;
    const recordId = parseInt(body.recordId, 10);
    if (!Number.isFinite(recordId)) {
      return reply.status(400).send({ success: false, error: '记录 ID 非法' });
    }
    const record = await prisma.backupRecord.findUnique({ where: { id: recordId } });
    if (!record || !record.filePath || !fs.existsSync(record.filePath)) {
      return reply.status(404).send({ success: false, error: 'Backup file not found' });
    }
    if (!safeInsideBackupDir(record.filePath)) {
      return reply.status(403).send({ success: false, error: '非法的备份路径' });
    }

    const allowedMounts = (process.env.USB_MOUNTS || '/mnt/usb').split(',').map((s) => s.trim()).filter(Boolean);
    const requestedMount = typeof body.mountPoint === 'string' ? body.mountPoint : allowedMounts[0];
    const usbDir = path.resolve(requestedMount);
    if (!allowedMounts.some((m) => usbDir === path.resolve(m) || usbDir.startsWith(path.resolve(m) + path.sep))) {
      return reply.status(400).send({ success: false, error: '不允许的挂载点' });
    }

    try {
      if (!fs.existsSync(usbDir)) {
        return reply.status(400).send({ success: false, error: 'USB 挂载点不存在' });
      }
      const destPath = path.join(usbDir, path.basename(record.filePath));
      fs.copyFileSync(record.filePath, destPath);
      return { success: true, destination: destPath, size: record.fileSize };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
}

export async function startupBackupCheck() {
  try {
    const config = await prisma.backupConfig.findFirst({ where: { name: 'default' } });
    if (!config || !config.enabled) return;

    const today = formatDate(new Date());
    const todayStart = new Date(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}`);

    const todayBackup = await prisma.backupRecord.findFirst({
      where: {
        status: { in: ['completed', 'size_warning'] },
        startedAt: { gte: todayStart },
      },
    });

    if (!todayBackup) {
      console.log('No backup found for today, starting startup backup...');
      await performBackup(config, 'startup');
    }
  } catch (e) {
    console.error('Startup backup check failed:', e);
  }
}

export async function scheduleBackupCheck() {
  try {
    const config = await prisma.backupConfig.findFirst({ where: { name: 'default' } });
    if (!config || !config.enabled) return;

    const now = new Date();
    const scheduleTime = config.scheduleTime || '02:00';
    const [hour, minute] = scheduleTime.split(':').map(Number);
    const scheduled = new Date(now);
    scheduled.setHours(hour, minute, 0, 0);

    const diff = Math.abs(now.getTime() - scheduled.getTime());
    if (diff < 60000) {
      const today = formatDate(now);
      const todayStart = new Date(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}`);
      const todayBackup = await prisma.backupRecord.findFirst({
        where: {
          status: { in: ['completed', 'size_warning'] },
          startedAt: { gte: todayStart },
        },
      });

      if (!todayBackup) {
        console.log('Scheduled backup time reached, starting backup...');
        await performBackup(config, 'scheduled');
        if (config.retentionDays) {
          await cleanupOldBackups(config.retentionDays);
        }
      }
    }
  } catch (e) {
    console.error('Scheduled backup check failed:', e);
  }
}
