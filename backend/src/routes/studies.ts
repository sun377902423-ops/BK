import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authorize } from '../lib/authorize.js';
import { requireStudyAccess } from '../lib/resource-acl.js';
import { PERMISSIONS } from '../lib/permissions.js';

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://orthanc:8042';
const ORTHANC_USER = process.env.ORTHANC_USERNAME || 'orthanc';
const ORTHANC_PASS = process.env.ORTHANC_PASSWORD || 'orthanc';
const ORTHANC_AUTH = 'Basic ' + Buffer.from(`${ORTHANC_USER}:${ORTHANC_PASS}`).toString('base64');
const ORTHANC_WEBHOOK_TOKEN = process.env.ORTHANC_WEBHOOK_TOKEN || '';

function normalizeName(name: string): string {
  return name
    .replace(/\^/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function parseDicomDate(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr.length !== 8) return null;
  const y = parseInt(dateStr.substring(0, 4), 10);
  const m = parseInt(dateStr.substring(4, 6), 10) - 1;
  const d = parseInt(dateStr.substring(6, 8), 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m, d);
}

function generatePatientId(): string {
  const prefix = 'P';
  const timestamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${rand}`;
}

async function resolveStudyInstanceUid(orthancStudyId: string): Promise<string | null> {
  try {
    const resp = await fetch(`${ORTHANC_URL}/studies/${orthancStudyId}`, {
      headers: { Authorization: ORTHANC_AUTH },
    });
    if (!resp.ok) return null;
    const info = await resp.json() as any;
    return info?.MainDicomTags?.StudyInstanceUID || null;
  } catch {
    return null;
  }
}

async function findOrCreatePatient(dicomPatientName: string, dicomPatientId?: string, dicomBirthDate?: string, dicomSex?: string): Promise<{ patient: any; created: boolean }> {
  const normalizedName = normalizeName(dicomPatientName);

  let patient = await prisma.patient.findFirst({
    where: {
      OR: [
        { name: normalizedName },
        { name: dicomPatientName },
        { name: { equals: dicomPatientName, mode: 'insensitive' } },
      ],
    },
  });

  if (!patient && dicomPatientId) {
    patient = await prisma.patient.findFirst({
      where: { patientId: dicomPatientId },
    });
  }

  if (patient) {
    return { patient, created: false };
  }

  const birthDate = parseDicomDate(dicomBirthDate);
  const gender = dicomSex === 'M' ? 'male' : dicomSex === 'F' ? 'female' : null;

  patient = await prisma.patient.create({
    data: {
      patientId: dicomPatientId || generatePatientId(),
      name: normalizedName,
      gender,
      birthDate,
    },
  });

  return { patient, created: true };
}

async function syncSingleStudy(orthancStudyId: string): Promise<{ study: any; patientCreated: boolean } | null> {
  try {
    const studyResp = await fetch(`${ORTHANC_URL}/studies/${orthancStudyId}`, {
      headers: { Authorization: ORTHANC_AUTH },
    });
    if (!studyResp.ok) return null;

    const studyInfo = await studyResp.json() as any;
    const mainTags = studyInfo.MainDicomTags || {};
    const patientTags = studyInfo.PatientMainDicomTags || {};

    const existingStudy = await prisma.study.findUnique({
      where: { orthancStudyId },
    });

    if (existingStudy) return null;

    const dicomPatientName = patientTags.PatientName || patientTags.PatientID || 'Unknown';
    const dicomPatientId = patientTags.PatientID;
    const dicomBirthDate = patientTags.PatientBirthDate;
    const dicomSex = patientTags.PatientSex;

    const { patient, created: patientCreated } = await findOrCreatePatient(
      dicomPatientName,
      dicomPatientId,
      dicomBirthDate,
      dicomSex
    );

    const modality = mainTags.Modality || 'OT';
    const studyDate = parseDicomDate(mainTags.StudyDate);
    const studyDescription = mainTags.StudyDescription || '';
    const accessionNumber = mainTags.AccessionNumber;
    const studyInstanceUid = mainTags.StudyInstanceUID;

    const seriesCount = studyInfo.Series ? studyInfo.Series.length : 0;

    let deviceId: number | null = null;
    if (mainTags.Manufacturer || mainTags.InstitutionName) {
      const device = await prisma.imagingDevice.findFirst({
        where: { status: 'active' },
      });
      if (device) deviceId = device.id;
    }

    const study = await prisma.study.create({
      data: {
        orthancStudyId,
        studyInstanceUid,
        patientId: patient.id,
        modality,
        studyDate,
        accessionNumber,
        studyDescription,
        seriesCount,
        deviceId,
      },
      include: { patient: true, hospital: true, device: true },
    });

    return { study, patientCreated };
  } catch (e) {
    console.error(`Failed to sync study ${orthancStudyId}:`, e);
    return null;
  }
}

export async function syncAllOrthancStudies(): Promise<{
  synced: number;
  skipped: number;
  patientsCreated: number;
  errors: number;
}> {
  try {
    const resp = await fetch(`${ORTHANC_URL}/studies`, {
      headers: { Authorization: ORTHANC_AUTH },
    });
    if (!resp.ok) throw new Error(`Orthanc returned ${resp.status}`);

    const studyIds = await resp.json() as string[];
    let synced = 0;
    let skipped = 0;
    let patientsCreated = 0;
    let errors = 0;

    for (const studyId of studyIds) {
      const result = await syncSingleStudy(studyId);
      if (result === null) {
        skipped++;
      } else {
        synced++;
        if (result.patientCreated) patientsCreated++;
      }
    }

    return { synced, skipped, patientsCreated, errors };
  } catch (e) {
    console.error('Failed to sync Orthanc studies:', e);
    return { synced: 0, skipped: 0, patientsCreated: 0, errors: 1 };
  }
}

export async function studyRoutes(fastify: FastifyInstance) {
  fastify.get('/studies', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_LIST)],
  }, async (request) => {
    const query = request.query as {
      patientId?: string;
      modality?: string;
      search?: string;
    };
    const userRole = request.user.role;
    const hospitalId = request.user.hospitalId;

    const where: any = {};
    if (query.patientId) where.patientId = parseInt(query.patientId);
    if (query.modality) where.modality = query.modality;

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { patient: { name: { contains: s, mode: 'insensitive' } } },
        { patient: { patientId: { contains: s, mode: 'insensitive' } } },
        { studyDescription: { contains: s, mode: 'insensitive' } },
        { orthancStudyId: { contains: s } },
        { studyInstanceUid: { contains: s } },
        { modality: { contains: s, mode: 'insensitive' } },
      ];
    }

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

  fastify.get('/studies/dicomweb-check', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_LIST)],
  }, async () => {
    const results: any = { orthancReachable: false, plugins: [], dicomWebEnabled: false, sampleStudy: null };
    try {
      const pluginsResp = await fetch(`${ORTHANC_URL}/plugins`, {
        headers: { Authorization: ORTHANC_AUTH },
      });
      if (pluginsResp.ok) {
        results.orthancReachable = true;
        results.plugins = await pluginsResp.json() as string[];
        results.dicomWebEnabled = results.plugins.includes('dicom-web');
      }
    } catch (e: any) {
      results.orthancError = e.message;
    }
    try {
      const studiesResp = await fetch(`${ORTHANC_URL}/studies`, {
        headers: { Authorization: ORTHANC_AUTH },
      });
      if (studiesResp.ok) {
        const ids = await studiesResp.json() as string[];
        if (ids.length > 0) {
          const uid = await resolveStudyInstanceUid(ids[0]);
          results.sampleStudy = { orthancId: ids[0], studyInstanceUid: uid };
        }
      }
    } catch {}
    try {
      const dwResp = await fetch(`${ORTHANC_URL}/dicom-web/studies?limit=1`, {
        headers: { Authorization: ORTHANC_AUTH },
      });
      results.dicomWebEndpointStatus = dwResp.status;
      if (dwResp.ok) {
        const dwData = await dwResp.json() as any[];
        results.dicomWebStudyCount = dwData.length;
      }
    } catch (e: any) {
      results.dicomWebError = e.message;
    }
    return results;
  });

  fastify.post('/studies/backfill-uids', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_LIST)],
  }, async () => {
    const studies = await prisma.study.findMany({
      where: { studyInstanceUid: null },
      select: { id: true, orthancStudyId: true },
    });
    let updated = 0;
    let failed = 0;
    for (const study of studies) {
      const uid = await resolveStudyInstanceUid(study.orthancStudyId);
      if (uid) {
        await prisma.study.update({
          where: { id: study.id },
          data: { studyInstanceUid: uid },
        });
        updated++;
      } else {
        failed++;
      }
    }
    return { total: studies.length, updated, failed };
  });

  fastify.get('/studies/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_READ), requireStudyAccess],
  }, async (request, reply) => {
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
    if (!study) return reply.status(404).send({ error: '检查不存在' });
    return study;
  });

  fastify.get('/studies/:id/ohif-url', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_READ), requireStudyAccess],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const study = await prisma.study.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, orthancStudyId: true, studyInstanceUid: true },
    });
    if (!study) return reply.status(404).send({ url: null, error: 'Study not found' });

    let uid = study.studyInstanceUid;
    if (!uid) {
      uid = await resolveStudyInstanceUid(study.orthancStudyId);
      if (uid) {
        await prisma.study.update({
          where: { id: study.id },
          data: { studyInstanceUid: uid },
        });
      }
    }

    if (!uid) return reply.status(404).send({ url: null, error: 'StudyInstanceUID not available' });
    if (!/^[0-9.]+$/.test(uid)) {
      return reply.status(400).send({ url: null, error: 'Invalid StudyInstanceUID format' });
    }
    return { url: `/ohif/viewer/${encodeURIComponent(uid)}`, studyInstanceUid: uid };
  });

  fastify.post('/studies', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_UPLOAD)],
  }, async (request) => {
    const data = request.body as any;
    const userHospitalId = request.user.hospitalId;
    const study = await prisma.study.create({
      data: {
        orthancStudyId: data.orthancStudyId,
        patientId: data.patientId,
        modality: data.modality,
        studyDate: data.studyDate ? new Date(data.studyDate) : null,
        accessionNumber: data.accessionNumber,
        studyDescription: data.studyDescription,
        seriesCount: data.seriesCount,
        hospitalId: request.user.role === 'ADMIN' ? (data.hospitalId ?? userHospitalId) : userHospitalId,
        deviceId: data.deviceId,
      },
    });
    return study;
  });

  fastify.put('/studies/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_UPLOAD), requireStudyAccess],
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const updateData: any = {
      modality: data.modality,
      studyDate: data.studyDate ? new Date(data.studyDate) : undefined,
      accessionNumber: data.accessionNumber,
      studyDescription: data.studyDescription,
      seriesCount: data.seriesCount,
      deviceId: data.deviceId,
      patientId: data.patientId,
    };
    if (request.user.role === 'ADMIN') {
      updateData.hospitalId = data.hospitalId;
    }
    const study = await prisma.study.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    return study;
  });

  fastify.delete('/studies/:id', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_DELETE), requireStudyAccess],
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

    const fileBuffer = await data.toBuffer();
    const originalFilename = data.filename;
    const filename = originalFilename.toLowerCase();

    const isZip = filename.endsWith('.zip');

    const processStudyFromOrthanc = async (parentStudy: string, orthancId: string, sourceName: string) => {
      let studyInfo: any = {};
      try {
        const studyResp = await fetch(`${ORTHANC_URL}/studies/${parentStudy}`, {
          headers: { Authorization: ORTHANC_AUTH },
        });
        if (studyResp.ok) studyInfo = await studyResp.json() as any;
      } catch {}

      const mainDicomTags = studyInfo.MainDicomTags || {};
      const patientTags = studyInfo.PatientMainDicomTags || {};

      const orthancStudyId = parentStudy || orthancId;
      const modality = mainDicomTags.Modality || 'OT';
      const studyDate = parseDicomDate(mainDicomTags.StudyDate);

      const existingStudy = await prisma.study.findUnique({
        where: { orthancStudyId },
      });

      if (existingStudy) {
        await prisma.study.update({
          where: { id: existingStudy.id },
          data: { seriesCount: { increment: 1 } },
        });
        return { studyId: existingStudy.id, orthancStudyId, updated: true };
      }

      let finalPatientId: number;
      if (patientId) {
        finalPatientId = parseInt(patientId);
      } else {
        const dicomPatientName = patientTags.PatientName || patientTags.PatientID || 'Unknown';
        const { patient } = await findOrCreatePatient(
          dicomPatientName,
          patientTags.PatientID,
          patientTags.PatientBirthDate,
          patientTags.PatientSex
        );
        finalPatientId = patient.id;
      }

      const study = await prisma.study.create({
        data: {
          orthancStudyId,
          studyInstanceUid: mainDicomTags.StudyInstanceUID,
          patientId: finalPatientId,
          modality,
          studyDate,
          studyDescription: studyDescription || mainDicomTags.StudyDescription || sourceName,
          accessionNumber: mainDicomTags.AccessionNumber,
          seriesCount: 1,
          hospitalId: hospitalId ? parseInt(hospitalId) : null,
        },
        include: { patient: true, hospital: true },
      });

      return { studyId: study.id, orthancStudyId, patientAutoMatched: !patientId, created: true };
    };

    try {
      if (isZip) {
        console.log(`[Upload] ZIP file: ${originalFilename}, size: ${fileBuffer.length} bytes`);

        const orthancResp = await fetch(`${ORTHANC_URL}/instances`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/zip', 'Authorization': ORTHANC_AUTH },
          body: fileBuffer,
        });

        if (!orthancResp.ok) {
          const errBody = await orthancResp.text();
          console.error(`[Upload] Orthanc ZIP rejected: status=${orthancResp.status}, body=${errBody.substring(0, 500)}`);
          return reply.status(502).send({
            error: `Orthanc服务器拒绝接收此ZIP文件（状态码${orthancResp.status}），请确认压缩包内包含有效的DICOM文件`,
            orthancStatus: orthancResp.status,
            orthancError: errBody.substring(0, 200),
          });
        }

        const orthancRaw = await orthancResp.json();
        const orthancResults = Array.isArray(orthancRaw) ? orthancRaw : [orthancRaw];
        console.log(`[Upload] Orthanc accepted ZIP: ${orthancResults.length} instances imported`);

        const processedStudies = new Set<string>();
        let successCount = 0;
        let failCount = 0;

        for (const inst of orthancResults) {
          if (inst.ID && inst.ParentStudy) {
            successCount++;
            if (!processedStudies.has(inst.ParentStudy)) {
              processedStudies.add(inst.ParentStudy);
              try {
                await processStudyFromOrthanc(inst.ParentStudy, inst.ID, originalFilename);
              } catch (e: any) {
                console.error(`[Upload] Failed to process study ${inst.ParentStudy}:`, e.message);
              }
            }
          } else {
            failCount++;
            console.error(`[Upload] Instance without ParentStudy:`, JSON.stringify(inst).substring(0, 200));
          }
        }

        if (successCount === 0) {
          return reply.status(502).send({
            error: `ZIP文件已发送到Orthanc但未成功导入任何DICOM实例，请确认压缩包内包含有效的DICOM文件`,
          });
        }

        return {
          success: true,
          totalFiles: orthancResults.length,
          successCount,
          failCount,
          studiesCreated: processedStudies.size,
          patientAutoMatched: !patientId,
          message: `压缩包上传完成：${successCount}个文件成功导入，${processedStudies.size}个检查`,
        };
      }

      console.log(`[Upload] Single DICOM file: ${originalFilename}, size: ${fileBuffer.length} bytes`);

      const orthancResp = await fetch(`${ORTHANC_URL}/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/dicom', 'Authorization': ORTHANC_AUTH },
        body: fileBuffer,
      });

      if (!orthancResp.ok) {
        const errBody = await orthancResp.text();
        console.error(`[Upload] Orthanc rejected DICOM: status=${orthancResp.status}, body=${errBody.substring(0, 500)}`);
        return reply.status(502).send({
          error: '影像上传失败，请确认文件为有效DICOM格式',
          orthancStatus: orthancResp.status,
        });
      }

      const orthancResult = await orthancResp.json() as any;
      const studyResult = await processStudyFromOrthanc(orthancResult.ParentStudy, orthancResult.ID, originalFilename);

      return {
        success: true,
        ...studyResult,
        orthancInstanceId: orthancResult.ID,
        message: studyResult.updated ? '文件已上传到已有检查' : '影像上传成功',
      };
    } catch (error: any) {
      console.error(`[Upload] Fatal error:`, error.message);
      return reply.status(500).send({ error: '影像上传失败: ' + error.message });
    }
  });

  fastify.post('/studies/sync-orthanc', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_LIST)],
  }, async () => {
    const result = await syncAllOrthancStudies();
    return result;
  });

  fastify.post('/studies/orthanc-webhook', async (request, reply) => {
    if (!ORTHANC_WEBHOOK_TOKEN) {
      return reply.status(503).send({ error: 'Orthanc webhook 未配置鉴权令牌' });
    }
    const headerToken = (request.headers['x-orthanc-webhook-token'] as string | undefined) || '';
    if (headerToken !== ORTHANC_WEBHOOK_TOKEN) {
      return reply.status(401).send({ error: 'Webhook 鉴权失败' });
    }

    const body = request.body as any;

    if (body?.Type === 'StableStudy' && body?.ID) {
      console.log(`Orthanc webhook: new stable study ${body.ID}`);
      const result = await syncSingleStudy(body.ID);
      if (result) {
        console.log(`Auto-synced study ${body.ID}, patientCreated: ${result.patientCreated}`);
      }
    }

    return { received: true };
  });

  fastify.get('/studies/orthanc-stats', {
    preHandler: [fastify.authenticate, authorize(PERMISSIONS.STUDY_LIST)],
  }, async () => {
    try {
      const resp = await fetch(`${ORTHANC_URL}/studies`, {
        headers: { Authorization: ORTHANC_AUTH },
      });
      const orthancIds = await resp.json() as string[];

      const dbStudies = await prisma.study.findMany({
        select: { orthancStudyId: true },
      });
      const dbIds = new Set(dbStudies.map(s => s.orthancStudyId));

      const unsynced = orthancIds.filter(id => !dbIds.has(id));

      return {
        orthancTotal: orthancIds.length,
        dbTotal: dbStudies.length,
        unsyncedCount: unsynced.length,
        unsyncedIds: unsynced,
      };
    } catch (e) {
      return { orthancTotal: 0, dbTotal: 0, unsyncedCount: 0, unsyncedIds: [], error: String(e) };
    }
  });
}
