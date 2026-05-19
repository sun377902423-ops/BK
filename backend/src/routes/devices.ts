import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://orthanc:8042';
const ORTHANC_USER = process.env.ORTHANC_USERNAME || 'orthanc';
const ORTHANC_PASS = process.env.ORTHANC_PASSWORD || 'orthanc';
const ORTHANC_AUTH = 'Basic ' + Buffer.from(`${ORTHANC_USER}:${ORTHANC_PASS}`).toString('base64');

async function syncOrthancModality(device: any, action: 'add' | 'remove') {
  try {
    const modalityId = device.aeTitle.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (action === 'add') {
      await fetch(`${ORTHANC_URL}/modalities/${modalityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ORTHANC_AUTH,
        },
        body: JSON.stringify({
          AET: device.aeTitle,
          Host: device.host,
          Port: device.port,
        }),
      });
    } else {
      await fetch(`${ORTHANC_URL}/modalities/${modalityId}`, {
        method: 'DELETE',
        headers: { Authorization: ORTHANC_AUTH },
      });
    }
  } catch (e) {
    console.error('Failed to sync Orthanc modality:', e);
  }
}

async function syncAllOrthancModalities() {
  try {
    const devices = await prisma.imagingDevice.findMany({
      where: { status: 'active' },
    });
    for (const device of devices) {
      const modalityId = device.aeTitle.toUpperCase().replace(/[^A-Z0-9]/g, '');
      await fetch(`${ORTHANC_URL}/modalities/${modalityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ORTHANC_AUTH,
        },
        body: JSON.stringify({
          AET: device.aeTitle,
          Host: device.host,
          Port: device.port,
        }),
      });
    }
  } catch (e) {
    console.error('Failed to sync all Orthanc modalities:', e);
  }
}

export async function deviceRoutes(fastify: FastifyInstance) {
  fastify.get('/devices', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.DEVICE_LIST)],
  }, async (request) => {
    const query = request.query as { hospitalId?: string; status?: string };
    const userRole = request.user.role;
    const userHospitalId = request.user.hospitalId;
    const where: any = {};
    if (userRole === 'ADMIN') {
      if (query.hospitalId) where.hospitalId = parseInt(query.hospitalId);
    } else if (userHospitalId) {
      where.hospitalId = userHospitalId;
    } else {
      return [];
    }
    if (query.status) where.status = query.status;

    const devices = await prisma.imagingDevice.findMany({
      where,
      include: {
        hospital: true,
        _count: { select: { studies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return devices;
  });

  fastify.get('/devices/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.DEVICE_LIST)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await prisma.imagingDevice.findUnique({
      where: { id: parseInt(id) },
      include: {
        hospital: true,
        studies: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { patient: true },
        },
      },
    });
    if (!device) return reply.status(404).send({ error: '设备不存在' });
    if (request.user.role !== 'ADMIN' && request.user.hospitalId && device.hospitalId !== request.user.hospitalId) {
      return reply.status(403).send({ error: '无权访问该设备' });
    }
    return device;
  });

  fastify.post('/devices', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.DEVICE_CREATE)],
  }, async (request, reply) => {
    const data = request.body as any;
    const existing = await prisma.imagingDevice.findFirst({
      where: { aeTitle: data.aeTitle },
    });
    if (existing) {
      return reply.status(400).send({ error: 'AE Title 已存在，请使用不同的 AE Title' });
    }

    const device = await prisma.imagingDevice.create({
      data: {
        name: data.name,
        modality: data.modality,
        aeTitle: data.aeTitle,
        host: data.host,
        port: data.port || 104,
        hospitalId: data.hospitalId,
        manufacturer: data.manufacturer,
        model: data.model,
        serialNumber: data.serialNumber,
        localIp: data.localIp,
        routerMappingPort: data.routerMappingPort,
        description: data.description,
        status: data.status || 'active',
      },
      include: { hospital: true },
    });

    if (device.status === 'active') {
      await syncOrthancModality(device, 'add');
    }

    return device;
  });

  fastify.put('/devices/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.DEVICE_UPDATE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const existing = await prisma.imagingDevice.findUnique({
      where: { id: parseInt(id) },
    });
    if (!existing) return reply.status(404).send({ error: '设备不存在' });

    if (data.aeTitle && data.aeTitle !== existing.aeTitle) {
      const dup = await prisma.imagingDevice.findFirst({
        where: { aeTitle: data.aeTitle, id: { not: parseInt(id) } },
      });
      if (dup) return reply.status(400).send({ error: 'AE Title 已存在' });
      await syncOrthancModality(existing, 'remove');
    }

    const device = await prisma.imagingDevice.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        modality: data.modality,
        aeTitle: data.aeTitle,
        host: data.host,
        port: data.port,
        hospitalId: data.hospitalId,
        manufacturer: data.manufacturer,
        model: data.model,
        serialNumber: data.serialNumber,
        localIp: data.localIp,
        routerMappingPort: data.routerMappingPort,
        description: data.description,
        status: data.status,
      },
      include: { hospital: true },
    });

    if (device.status === 'active') {
      await syncOrthancModality(device, 'add');
    } else {
      await syncOrthancModality(device, 'remove');
    }

    return device;
  });

  fastify.delete('/devices/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.DEVICE_DELETE)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await prisma.imagingDevice.findUnique({
      where: { id: parseInt(id) },
    });
    if (!device) return reply.status(404).send({ error: '设备不存在' });

    await syncOrthancModality(device, 'remove');
    await prisma.imagingDevice.delete({ where: { id: parseInt(id) } });
    return { success: true };
  });

  fastify.put('/devices/:id/status', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.DEVICE_UPDATE)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const device = await prisma.imagingDevice.findUnique({
      where: { id: parseInt(id) },
    });
    if (!device) return { error: '设备不存在' };

    const updated = await prisma.imagingDevice.update({
      where: { id: parseInt(id) },
      data: { status: data.status },
      include: { hospital: true },
    });

    if (data.status === 'active') {
      await syncOrthancModality(updated, 'add');
    } else {
      await syncOrthancModality(updated, 'remove');
    }

    return updated;
  });

  fastify.post('/devices/sync-orthanc', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.DEVICE_UPDATE)],
  }, async () => {
    await syncAllOrthancModalities();
    return { success: true, message: 'Orthanc DICOM节点已同步' };
  });

  fastify.post('/devices/:id/echo', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.DEVICE_LIST)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await prisma.imagingDevice.findUnique({
      where: { id: parseInt(id) },
    });
    if (!device) return reply.status(404).send({ error: '设备不存在' });

    const modalityId = device.aeTitle.toUpperCase().replace(/[^A-Z0-9]/g, '');
    try {
      const resp = await fetch(`${ORTHANC_URL}/modalities/${modalityId}/echo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ORTHANC_AUTH,
        },
        body: JSON.stringify({}),
      });

      if (resp.ok) {
        await prisma.imagingDevice.update({
          where: { id: device.id },
          data: { lastConnectedAt: new Date() },
        });
        return { success: true, message: 'DICOM Echo 成功，设备连接正常' };
      } else {
        return { success: false, message: `DICOM Echo 失败: HTTP ${resp.status}` };
      }
    } catch (e: any) {
      return { success: false, message: `DICOM Echo 失败: ${e.message}` };
    }
  });

  fastify.get('/devices/network-info', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.SYSTEM_CONFIG)],
  }, async () => {
    const orthancInfo: any = {};
    try {
      const resp = await fetch(`${ORTHANC_URL}/system`, {
        headers: { Authorization: ORTHANC_AUTH },
      });
      if (resp.ok) {
        const system = await resp.json() as any;
        orthancInfo.system = {
          Version: system?.Version,
          ApiVersion: system?.ApiVersion,
          DicomAet: system?.DicomAet,
        };
      }

      const modalitiesResp = await fetch(`${ORTHANC_URL}/modalities`, {
        headers: { Authorization: ORTHANC_AUTH },
      });
      if (modalitiesResp.ok) orthancInfo.modalities = await modalitiesResp.json();
    } catch {}

    return {
      orthanc: orthancInfo,
      serverPublicIp: process.env.SERVER_PUBLIC_IP || null,
      dicomPort: parseInt(process.env.DICOM_PORT || '4242', 10),
      orthancAet: process.env.ORTHANC_AET || 'BKSYSPACS',
      networkMode: process.env.NETWORK_MODE || 'STANDARD',
    };
  });
}
