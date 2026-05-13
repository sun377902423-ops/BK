import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { PERMISSIONS } from '../lib/permissions.js';

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://orthanc:8042';

export async function studyRoutes(fastify: FastifyInstance) {
  fastify.get('/studies', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_LIST)],
  }, async (request) => {
    const query = request.query as {
      patientId?: string;
      modality?: string;
    };
    const userRole = request.user.role;
    const hospitalId = request.user.hospitalId;

    const where: any = {};
    if (query.patientId) where.patientId = parseInt(query.patientId);
    if (query.modality) where.modality = query.modality;

    if (userRole !== 'ADMIN' && hospitalId) {
      where.hospitalId = hospitalId;
    }

    const studies = await prisma.study.findMany({
      where,
      include: {
        patient: true,
        hospital: true,
        device: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return studies;
  });

  fastify.get('/studies/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_READ)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const study = await prisma.study.findUnique({
      where: { id: parseInt(id) },
      include: {
        patient: true,
        hospital: true,
        device: true,
        consultations: true,
        reports: true,
      },
    });
    return study;
  });

  fastify.post('/studies', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_UPLOAD)],
  }, async (request) => {
    const data = request.body as any;
    const study = await prisma.study.create({
      data: {
        orthancStudyId: data.orthancStudyId,
        patientId: data.patientId,
        modality: data.modality,
        studyDate: data.studyDate ? new Date(data.studyDate) : null,
        accessionNumber: data.accessionNumber,
        studyDescription: data.studyDescription,
        seriesCount: data.seriesCount,
        hospitalId: data.hospitalId,
        deviceId: data.deviceId,
      },
    });
    return study;
  });

  fastify.put('/studies/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_UPLOAD)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const study = await prisma.study.update({
      where: { id: parseInt(id) },
      data: {
        modality: data.modality,
        studyDate: data.studyDate ? new Date(data.studyDate) : undefined,
        accessionNumber: data.accessionNumber,
        studyDescription: data.studyDescription,
        seriesCount: data.seriesCount,
        hospitalId: data.hospitalId,
        deviceId: data.deviceId,
      },
    });
    return study;
  });

  fastify.delete('/studies/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_DELETE)],
  }, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.study.delete({
      where: { id: parseInt(id) },
    });
    return { success: true };
  });

  fastify.post('/studies/upload', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_UPLOAD)],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: '请选择要上传的文件' });
    }

    const fields = data.fields;
    const patientId = (fields as any)?.patientId?.value;
    const hospitalId = (fields as any)?.hospitalId?.value;
    const studyDescription = (fields as any)?.studyDescription?.value;

    if (!patientId) {
      return reply.status(400).send({ error: '请选择患者' });
    }

    const fileBuffer = await data.toBuffer();
    const filename = data.filename;

    try {
      const orthancResp = await fetch(`${ORTHANC_URL}/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/dicom' },
        body: fileBuffer,
      });

      if (!orthancResp.ok) {
        const errText = await orthancResp.text();
        fastify.log.error(`Orthanc upload failed: ${orthancResp.status} ${errText}`);
        return reply.status(502).send({ error: 'Orthanc上传失败，请确认文件为有效DICOM格式' });
      }

      const orthancResult = await orthancResp.json() as any;
      const orthancId = orthancResult.ID;
      const parentStudy = orthancResult.ParentStudy;

      let studyInfo: any = {};
      if (parentStudy) {
        try {
          const studyResp = await fetch(`${ORTHANC_URL}/studies/${parentStudy}`);
          if (studyResp.ok) {
            studyInfo = await studyResp.json() as any;
          }
        } catch (e) {
          fastify.log.warn(`Failed to fetch study info from Orthanc: ${e}`);
        }
      }

      const mainDicomTags = studyInfo.MainDicomTags || {};
      const patientTags = studyInfo.PatientMainDicomTags || {};

      const orthancStudyId = parentStudy || orthancId;
      const modality = mainDicomTags.Modality || data.mimetype === 'application/dicom' ? 'DICOM' : 'FILE';
      const studyDateStr = mainDicomTags.StudyDate;
      let studyDate: Date | null = null;
      if (studyDateStr && studyDateStr.length === 8) {
        studyDate = new Date(
          parseInt(studyDateStr.substring(0, 4)),
          parseInt(studyDateStr.substring(4, 6)) - 1,
          parseInt(studyDateStr.substring(6, 8))
        );
      }

      const existingStudy = await prisma.study.findUnique({
        where: { orthancStudyId },
      });

      if (existingStudy) {
        await prisma.study.update({
          where: { id: existingStudy.id },
          data: { seriesCount: { increment: 1 } },
        });
        return {
          success: true,
          studyId: existingStudy.id,
          orthancStudyId,
          orthancInstanceId: orthancId,
          message: '文件已上传到已有检查',
        };
      }

      const study = await prisma.study.create({
        data: {
          orthancStudyId,
          patientId: parseInt(patientId),
          modality: modality || 'OT',
          studyDate,
          studyDescription: studyDescription || mainDicomTags.StudyDescription || filename,
          accessionNumber: mainDicomTags.AccessionNumber,
          seriesCount: 1,
          hospitalId: hospitalId ? parseInt(hospitalId) : null,
        },
        include: { patient: true, hospital: true },
      });

      return {
        success: true,
        studyId: study.id,
        orthancStudyId,
        orthancInstanceId: orthancId,
        message: '影像上传成功',
      };
    } catch (error: any) {
      fastify.log.error(`Upload error: ${error.message}`);
      return reply.status(500).send({ error: '影像上传失败: ' + error.message });
    }
  });
}
