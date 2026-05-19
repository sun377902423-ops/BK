import { FastifyInstance } from 'fastify';
import * as http from 'http';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';

const DOCKER_SOCKET = '/var/run/docker.sock';

const LOG_SERVICES = [
  { id: 'backend', name: '后端服务', container: 'bksys-backend' },
  { id: 'nginx', name: 'Nginx 网关', container: 'bksys-nginx' },
  { id: 'livekit', name: 'LiveKit 视频服务', container: 'bksys-livekit' },
  { id: 'orthanc', name: 'Orthanc 影像服务', container: 'bksys-orthanc' },
  { id: 'frontend', name: '前端服务', container: 'bksys-frontend' },
  { id: 'postgres', name: 'PostgreSQL 数据库', container: 'bksys-postgres' },
  { id: 'redis', name: 'Redis 缓存', container: 'bksys-redis' },
];

const ERROR_PATTERNS = /\b(error|err|fatal|panic|crit|alert|emerg|fail|exception|warn|warning)\b/i;

const SENSITIVE_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /(password|passwd|pwd|secret|token|api[_-]?key|authorization)\s*[:=]\s*['"]?[^\s'"]+['"]?/gi, replacement: '$1=***' },
  { re: /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, replacement: '***JWT***' },
  { re: /(postgres(?:ql)?:\/\/)[^:]+:[^@]+@/gi, replacement: '$1***:***@' },
  { re: /(Bearer\s+)[A-Za-z0-9._-]+/gi, replacement: '$1***' },
  { re: /(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/g, replacement: '*.*.*.*' },
];

function sanitize(line: string): string {
  let result = line;
  for (const { re, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(re, replacement);
  }
  return result;
}

function dockerRequest(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      socketPath: DOCKER_SOCKET,
      path,
      method: 'GET',
      headers: { 'Host': 'localhost' },
    };
    const req = http.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Docker API request timed out'));
    });
    req.end();
  });
}

function parseDockerLogStream(buffer: Buffer): string[] {
  const lines: string[] = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset + 4);
    offset += 8;
    if (offset + length > buffer.length) break;
    const content = buffer.subarray(offset, offset + length).toString('utf-8').trim();
    if (content) lines.push(content);
    offset += length;
  }
  return lines;
}

export async function logRoutes(fastify: FastifyInstance) {
  fastify.get('/logs/services', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.SYSTEM_AUDIT)],
  }, async () => {
    return LOG_SERVICES.map((s) => ({ id: s.id, name: s.name }));
  });

  fastify.get('/logs/:service', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.SYSTEM_AUDIT)],
  }, async (request, reply) => {
    const { service } = request.params as { service: string };
    const query = request.query as { lines?: string; errors?: string };
    const lines = Math.min(Math.max(parseInt(query.lines || '200', 10) || 0, 10), 2000);
    const errorsOnly = query.errors === 'true';

    const svc = LOG_SERVICES.find((s) => s.id === service);
    if (!svc) {
      return reply.status(404).send({ error: '服务不存在' });
    }

    try {
      const encodedContainer = encodeURIComponent(svc.container);
      const dockerPath = `/containers/${encodedContainer}/logs?stdout=true&stderr=true&tail=${lines}`;
      const rawBuffer = await dockerRequest(dockerPath);

      const logLines = parseDockerLogStream(rawBuffer);

      if (logLines.length === 0) {
        return { service: svc.id, name: svc.name, lines: [], total: 0 };
      }

      const filtered = errorsOnly
        ? logLines.filter((line) => ERROR_PATTERNS.test(line))
        : logLines;

      const result = filtered.map((content, index) => {
        const safe = sanitize(content);
        return {
          index,
          content: safe,
          isError: ERROR_PATTERNS.test(content),
        };
      });

      return {
        service: svc.id,
        name: svc.name,
        lines: result,
        total: result.length,
      };
    } catch (err: any) {
      return reply.status(500).send({
        error: `无法获取 ${svc.name} 日志: ${err.message || '未知错误'}`,
      });
    }
  });
}
