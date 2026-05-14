export const PERMISSIONS = {
  USER_LIST: 'user:list',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_ASSIGN_ROLE: 'user:assign-role',

  PATIENT_LIST: 'patient:list',
  PATIENT_CREATE: 'patient:create',
  PATIENT_READ: 'patient:read',
  PATIENT_UPDATE: 'patient:update',
  PATIENT_DELETE: 'patient:delete',
  PATIENT_EXPORT: 'patient:export',

  STUDY_LIST: 'study:list',
  STUDY_READ: 'study:read',
  STUDY_UPLOAD: 'study:upload',
  STUDY_DELETE: 'study:delete',
  STUDY_ANNOTATE: 'study:annotate',
  STUDY_EXPORT: 'study:export',

  CONSULTATION_LIST: 'consultation:list',
  CONSULTATION_CREATE: 'consultation:create',
  CONSULTATION_JOIN: 'consultation:join',
  CONSULTATION_MANAGE: 'consultation:manage',
  CONSULTATION_CLOSE: 'consultation:close',

  REPORT_LIST: 'report:list',
  REPORT_CREATE: 'report:create',
  REPORT_UPDATE: 'report:update',
  REPORT_SUBMIT: 'report:submit',
  REPORT_SIGN: 'report:sign',
  REPORT_APPROVE: 'report:approve',
  REPORT_DELETE: 'report:delete',

  ACCESS_REQUEST_CREATE: 'access-request:create',
  ACCESS_REQUEST_REVIEW: 'access-request:review',
  ACCESS_REQUEST_LIST: 'access-request:list',

  HOSPITAL_LIST: 'hospital:list',
  HOSPITAL_CREATE: 'hospital:create',
  HOSPITAL_UPDATE: 'hospital:update',

  SYSTEM_CONFIG: 'system:config',
  SYSTEM_AUDIT: 'system:audit',

  DEVICE_LIST: 'device:list',
  DEVICE_CREATE: 'device:create',
  DEVICE_UPDATE: 'device:update',
  DEVICE_DELETE: 'device:delete',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
