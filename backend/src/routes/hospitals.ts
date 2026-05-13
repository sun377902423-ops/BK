import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';

export async function hospitalRoutes(fastify: FastifyInstance) {
  fastify.get('/hospitals', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.HOSPITAL_LIST)],
  }, async () => {
    const hospitals = await prisma.hospital.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return hospitals;
  });

  fastify.get('/hospitals/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.HOSPITAL_LIST)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const hospital = await prisma.hospital.findUnique({
      where: { id: parseInt(id) },
      include: {
        users: {
          include: { role: true },
        },
        _count: {
          select: { patients: true },
        },
      },
    });
    return hospital;
  });

  fastify.post('/hospitals', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.HOSPITAL_CREATE)],
  }, async (request) => {
    const data = request.body as any;
    const hospital = await prisma.hospital.create({
      data: {
        name: data.name,
        country: data.country,
        city: data.city,
        address: data.address,
        phone: data.phone,
        isEdgeSite: data.isEdgeSite,
      },
    });
    return hospital;
  });

  fastify.put('/hospitals/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.HOSPITAL_UPDATE)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const hospital = await prisma.hospital.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        country: data.country,
        city: data.city,
        address: data.address,
        phone: data.phone,
        isEdgeSite: data.isEdgeSite,
      },
    });
    return hospital;
  });
}
