import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@/lib/permissions';
import PermissionGuard from '@/components/ui/PermissionGuard';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';

import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ClockIcon,
  ServerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  Cog6ToothIcon,
  CircleStackIcon,
  FolderArrowDownIcon,
} from '@heroicons/react/24/outline';

const formatBytes = (bytes: number | null | undefined) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const statusColors: Record<string, string> = {
  completed: 'text-green-600 bg-green-50',
  running: 'text-blue-600 bg-blue-50',
  failed: 'text-red-600 bg-red-50',
  size_warning: 'text-amber-600 bg-amber-50',
  imported: 'text-purple-600 bg-purple-50',
};

const statusIcons: Record<string, React.ComponentType<any>> = {
  completed: CheckCircleIcon,
  running: ArrowPathIcon,
  failed: XCircleIcon,
  size_warning: ExclamationTriangleIcon,
  imported: ArrowUpTrayIcon,
};

export default function BackupManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [restoreConfirmId, setRestoreConfirmId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => api.get('/api/backups/status').then(r => r.data),
  });

  const { data: config } = useQuery({
    queryKey: ['backup-config'],
    queryFn: () => api.get('/api/backups/config').then(r => r.data),
  });

  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['backup-records'],
    queryFn: () => api.get('/api/backups/records?pageSize=50').then(r => r.data),
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.post('/api/backups/trigger', { triggerType: 'manual' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      queryClient.invalidateQueries({ queryKey: ['backup-records'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/backups/restore/${id}`),
    onSuccess: () => {
      setRestoreConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['backup-records'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/backups/records/${id}`),
    onSuccess: () => {
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['backup-records'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: () => api.post('/api/backups/cleanup'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-records'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await api.post('/api/backups/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    queryClient.invalidateQueries({ queryKey: ['backup-records'] });
    queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    e.target.value = '';
  };

  const handleDownload = async (id: number) => {
    try {
      const res = await api.get(`/api/backups/download/${id}`, { responseType: 'blob' });
      const disposition = String(res.headers['content-disposition'] || '');
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] || `backup_${id}.tar.gz`;
      const blob = new Blob([res.data], { type: String(res.headers['content-type'] || 'application/gzip') });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      alert(err?.response?.data?.error || t('backup.downloadFailed'));
    }
  };

  if (statusLoading) {
    return <div className="flex items-center justify-center h-64"><ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('backup.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('backup.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <PermissionGuard permissions={[PERMISSIONS.BACKUP_CONFIG]}>
            <button onClick={() => setConfigModalOpen(true)} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Cog6ToothIcon className="w-4 h-4 mr-2" />
              {t('backup.config')}
            </button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.BACKUP_CREATE]}>
            <button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending || status?.isRunning}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 mr-2 ${triggerMutation.isPending || status?.isRunning ? 'animate-spin' : ''}`} />
              {status?.isRunning ? t('backup.running') : t('backup.triggerNow')}
            </button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status?.todayBackup ? 'bg-green-50' : 'bg-amber-50'}`}>
              <CheckCircleIcon className={`w-5 h-5 ${status?.todayBackup ? 'text-green-600' : 'text-amber-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('backup.todayStatus')}</p>
              <p className={`text-lg font-semibold ${status?.todayBackup ? 'text-green-600' : 'text-amber-600'}`}>
                {status?.todayBackup ? t('backup.todayDone') : t('backup.todayPending')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <ClockIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('backup.lastBackup')}</p>
              <p className="text-sm font-semibold text-gray-900">
                {status?.lastBackup?.completedAt
                  ? new Date(status.lastBackup.completedAt).toLocaleString()
                  : t('backup.never')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <CircleStackIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('backup.totalBackups')}</p>
              <p className="text-lg font-semibold text-gray-900">{status?.totalBackups || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50">
              <ServerIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('backup.totalSize')}</p>
              <p className="text-lg font-semibold text-gray-900">{formatBytes(status?.totalBackupSize)}</p>
            </div>
          </div>
        </div>
      </div>

      {status?.lastBackup && !status.lastBackup.sizeVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">{t('backup.sizeWarning')}</p>
            <p className="text-sm text-amber-700 mt-1">
              {t('backup.sizeWarningDetail', {
                current: formatBytes(status.lastBackup.fileSize),
                previous: formatBytes(status.lastBackup.previousSize),
              })}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('backup.records')}</h2>
          <div className="flex items-center gap-3">
            <PermissionGuard permissions={[PERMISSIONS.BACKUP_RESTORE]}>
              <label className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                <ArrowUpTrayIcon className="w-4 h-4 mr-1.5" />
                {t('backup.importBackup')}
                <input type="file" accept=".tar.gz,.gz" className="hidden" onChange={handleUpload} />
              </label>
            </PermissionGuard>
            <PermissionGuard permissions={[PERMISSIONS.BACKUP_DELETE]}>
              <button
                onClick={() => cleanupMutation.mutate()}
                disabled={cleanupMutation.isPending}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <TrashIcon className="w-4 h-4 mr-1.5" />
                {t('backup.cleanup')}
              </button>
            </PermissionGuard>
          </div>
        </div>

        {recordsLoading ? (
          <div className="p-8 text-center text-gray-400"><ArrowPathIcon className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : records?.records?.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <CircleStackIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">{t('backup.noRecords')}</p>
            <p className="text-sm mt-1">{t('backup.noRecordsDesc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">{t('backup.time')}</th>
                  <th className="px-6 py-3">{t('backup.type')}</th>
                  <th className="px-6 py-3">{t('backup.status')}</th>
                  <th className="px-6 py-3">{t('backup.size')}</th>
                  <th className="px-6 py-3">{t('backup.duration')}</th>
                  <th className="px-6 py-3">{t('backup.details')}</th>
                  <th className="px-6 py-3">{t('backup.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records?.records?.map((record: any) => {
                  const StatusIcon = statusIcons[record.status] || ClockIcon;
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(record.startedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {t(`backup.triggerType.${record.triggerType}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusColors[record.status] || 'bg-gray-100 text-gray-700'}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {t(`backup.status.${record.status}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatBytes(record.fileSize)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatDuration(record.duration)}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {record.databaseSize != null && (
                          <div>DB: {formatBytes(record.databaseSize)}</div>
                        )}
                        {record.orthancSize != null && record.orthancSize > 0 && (
                          <div>PACS: {formatBytes(record.orthancSize)}</div>
                        )}
                        {record.uploadsSize != null && record.uploadsSize > 0 && (
                          <div>Files: {formatBytes(record.uploadsSize)}</div>
                        )}
                        {record.errorMessage && (
                          <div className="text-red-500 mt-1">{record.errorMessage}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <PermissionGuard permissions={[PERMISSIONS.BACKUP_CREATE]}>
                            {record.filePath && (
                              <button onClick={() => handleDownload(record.id)} className="p-1 text-gray-400 hover:text-blue-600" title={t('backup.download')}>
                                <ArrowDownTrayIcon className="w-4 h-4" />
                              </button>
                            )}
                          </PermissionGuard>
                          <PermissionGuard permissions={[PERMISSIONS.BACKUP_RESTORE]}>
                            {record.status === 'completed' && (
                              <button onClick={() => setRestoreConfirmId(record.id)} className="p-1 text-gray-400 hover:text-green-600" title={t('backup.restore')}>
                                <FolderArrowDownIcon className="w-4 h-4" />
                              </button>
                            )}
                          </PermissionGuard>
                          <PermissionGuard permissions={[PERMISSIONS.BACKUP_DELETE]}>
                            <button onClick={() => setDeleteConfirmId(record.id)} className="p-1 text-gray-400 hover:text-red-600" title={t('backup.delete')}>
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {configModalOpen && config && (
        <BackupConfigModal
          config={config}
          onClose={() => setConfigModalOpen(false)}
          onSave={() => {
            setConfigModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['backup-config'] });
            queryClient.invalidateQueries({ queryKey: ['backup-status'] });
          }}
        />
      )}

      {restoreConfirmId && (
        <Modal isOpen={true} onClose={() => setRestoreConfirmId(null)} title={t('backup.restoreConfirmTitle')}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mb-2" />
              <p className="text-sm text-red-700 font-medium">{t('backup.restoreWarning')}</p>
              <p className="text-sm text-red-600 mt-1">{t('backup.restoreWarningDetail')}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRestoreConfirmId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => restoreMutation.mutate(restoreConfirmId)}
                disabled={restoreMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {restoreMutation.isPending ? t('backup.restoring') : t('backup.confirmRestore')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirmId && (
        <Modal isOpen={true} onClose={() => setDeleteConfirmId(null)} title={t('backup.deleteConfirmTitle')}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('backup.deleteConfirm')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function BackupConfigModal({ config, onClose, onSave }: { config: any; onClose: () => void; onSave: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    enabled: config.enabled ?? true,
    scheduleTime: config.scheduleTime || '02:00',
    retentionDays: config.retentionDays || 30,
    remoteHost: config.remoteHost || '',
    remotePort: config.remotePort || 22,
    remoteUser: config.remoteUser || '',
    remotePath: config.remotePath || '',
    remotePassword: '',
    includeOrthanc: config.includeOrthanc ?? true,
    includeUploads: config.includeUploads ?? true,
    maxBackupSizeMb: config.maxBackupSizeMb || '',
  });
  const [passwordDirty, setPasswordDirty] = useState(false);
  const hasExistingPassword = !!config.remotePasswordSet;

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put('/api/backups/config', data),
    onSuccess: onSave,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      enabled: form.enabled,
      scheduleTime: form.scheduleTime,
      retentionDays: form.retentionDays,
      remoteHost: form.remoteHost || null,
      remotePort: form.remotePort,
      remoteUser: form.remoteUser || null,
      remotePath: form.remotePath || null,
      includeOrthanc: form.includeOrthanc,
      includeUploads: form.includeUploads,
      maxBackupSizeMb: form.maxBackupSizeMb ? parseInt(String(form.maxBackupSizeMb), 10) : null,
    };
    if (passwordDirty) {
      payload.remotePassword = form.remotePassword || null;
    }
    saveMutation.mutate(payload);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={t('backup.configTitle')}>
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto">
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">{t('backup.basicConfig')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="rounded" />
              <span className="text-sm">{t('backup.autoBackup')}</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('backup.scheduleTime')}</label>
              <input type="time" value={form.scheduleTime} onChange={e => setForm({ ...form, scheduleTime: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('backup.retentionDays')}</label>
              <input type="number" value={form.retentionDays} onChange={e => setForm({ ...form, retentionDays: parseInt(e.target.value, 10) || 30 })} min={1} max={365} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('backup.maxBackupSizeMb')}</label>
              <input type="number" value={form.maxBackupSizeMb} onChange={e => setForm({ ...form, maxBackupSizeMb: e.target.value })} placeholder={t('backup.noLimit')} min={0} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.includeOrthanc} onChange={e => setForm({ ...form, includeOrthanc: e.target.checked })} className="rounded" />
              <span className="text-sm">{t('backup.includeOrthanc')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.includeUploads} onChange={e => setForm({ ...form, includeUploads: e.target.checked })} className="rounded" />
              <span className="text-sm">{t('backup.includeUploads')}</span>
            </label>
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="font-medium text-gray-900">{t('backup.remoteConfig')}</h3>
          <p className="text-xs text-gray-500">{t('backup.remoteConfigHint')}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('backup.remoteHost')}</label>
              <input type="text" value={form.remoteHost} onChange={e => setForm({ ...form, remoteHost: e.target.value })} placeholder="192.168.1.200" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('backup.remotePort')}</label>
              <input type="number" value={form.remotePort} onChange={e => setForm({ ...form, remotePort: parseInt(e.target.value, 10) || 22 })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('backup.remoteUser')}</label>
              <input type="text" value={form.remoteUser} onChange={e => setForm({ ...form, remoteUser: e.target.value })} placeholder="root" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('backup.remotePassword')}</label>
              <input
                type="password"
                value={form.remotePassword}
                onChange={e => { setForm({ ...form, remotePassword: e.target.value }); setPasswordDirty(true); }}
                placeholder={hasExistingPassword ? '••••••••' : ''}
                autoComplete="new-password"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              {hasExistingPassword && !passwordDirty && (
                <p className="text-xs text-gray-400 mt-1">{t('backup.passwordUnchanged') || '留空表示不修改原密码'}</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('backup.remotePath')}</label>
              <input type="text" value={form.remotePath} onChange={e => setForm({ ...form, remotePath: e.target.value })} placeholder="/backup/bksys" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
            {saveMutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
