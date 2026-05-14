import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  ComputerDesktopIcon,
  SignalIcon,
  ArrowPathIcon,
  WifiIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PermissionGuard from '@/components/ui/PermissionGuard';
import { PERMISSIONS } from '@/lib/permissions';

const MODALITY_OPTIONS = [
  { value: 'CT', label: 'CT' },
  { value: 'MR', label: 'MR' },
  { value: 'DR', label: 'DR' },
  { value: 'CR', label: 'CR' },
  { value: 'DX', label: 'DX' },
  { value: 'US', label: 'US' },
  { value: 'NM', label: 'NM' },
  { value: 'PT', label: 'PT' },
  { value: 'XA', label: 'XA' },
  { value: 'RF', label: 'RF' },
  { value: 'MG', label: 'MG' },
  { value: 'OT', label: 'OT' },
];

interface Hospital {
  id: number;
  name: string;
  isEdgeSite: boolean;
}

interface ImagingDevice {
  id: number;
  name: string;
  modality: string;
  aeTitle: string;
  host: string;
  port: number;
  hospitalId: number | null;
  hospital: Hospital | null;
  status: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  localIp: string | null;
  routerMappingPort: number | null;
  description: string | null;
  lastConnectedAt: string | null;
  createdAt: string;
  _count?: { studies: number };
}

interface NetworkInfo {
  orthanc: any;
  serverPublicIp: string;
  dicomPort: number;
  orthancAet: string;
  networkMode: string;
}

const emptyForm = {
  name: '',
  modality: 'CT',
  aeTitle: '',
  host: '',
  port: 104,
  hospitalId: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  localIp: '',
  routerMappingPort: '',
  description: '',
  status: 'active',
};

const ImagingDevices: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<ImagingDevice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [networkInfoOpen, setNetworkInfoOpen] = useState(false);
  const [echoResult, setEchoResult] = useState<{ id: number; result: any } | null>(null);
  const [echoLoading, setEchoLoading] = useState<number | null>(null);

  const { data: devices, isLoading } = useQuery<ImagingDevice[]>({
    queryKey: ['imagingDevices'],
    queryFn: async () => {
      const res = await api.get('/api/devices');
      return res.data;
    },
  });

  const { data: hospitals } = useQuery<Hospital[]>({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const res = await api.get('/api/hospitals');
      return res.data;
    },
  });

  const { data: networkInfo, isLoading: networkLoading } = useQuery<NetworkInfo>({
    queryKey: ['deviceNetworkInfo'],
    queryFn: async () => {
      const res = await api.get('/api/devices/network-info');
      return res.data;
    },
    enabled: networkInfoOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/api/devices', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imagingDevices'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await api.put(`/api/devices/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imagingDevices'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/devices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imagingDevices'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/devices/sync-orthanc');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imagingDevices'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await api.put(`/api/devices/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imagingDevices'] });
    },
  });

  const openCreate = () => {
    setEditingDevice(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (device: ImagingDevice) => {
    setEditingDevice(device);
    setForm({
      name: device.name,
      modality: device.modality,
      aeTitle: device.aeTitle,
      host: device.host,
      port: device.port,
      hospitalId: device.hospitalId?.toString() || '',
      manufacturer: device.manufacturer || '',
      model: device.model || '',
      serialNumber: device.serialNumber || '',
      localIp: device.localIp || '',
      routerMappingPort: device.routerMappingPort?.toString() || '',
      description: device.description || '',
      status: device.status,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDevice(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      port: parseInt(form.port.toString()) || 104,
      hospitalId: form.hospitalId ? parseInt(form.hospitalId) : null,
      routerMappingPort: form.routerMappingPort ? parseInt(form.routerMappingPort) : null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      serialNumber: form.serialNumber || null,
      localIp: form.localIp || null,
      description: form.description || null,
    };
    if (editingDevice) {
      updateMutation.mutate({ id: editingDevice.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEcho = async (device: ImagingDevice) => {
    setEchoLoading(device.id);
    setEchoResult(null);
    try {
      const res = await api.post(`/api/devices/${device.id}/echo`);
      setEchoResult({ id: device.id, result: res.data });
    } catch (err: any) {
      setEchoResult({ id: device.id, result: { success: false, message: err?.response?.data?.error || t('devices.echoFailed') } });
    } finally {
      setEchoLoading(null);
    }
  };

  const getModalityColor = (modality: string) => {
    const colors: Record<string, string> = {
      CT: 'bg-blue-100 text-blue-800',
      MR: 'bg-purple-100 text-purple-800',
      DR: 'bg-green-100 text-green-800',
      US: 'bg-cyan-100 text-cyan-800',
      DX: 'bg-emerald-100 text-emerald-800',
      NM: 'bg-orange-100 text-orange-800',
      PT: 'bg-pink-100 text-pink-800',
      XA: 'bg-red-100 text-red-800',
    };
    return colors[modality] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />
          {t('devices.statusActive')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <XCircleIcon className="w-3.5 h-3.5 mr-1" />
        {t('devices.statusInactive')}
      </span>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <PageHeader
        title={t('devices.title')}
        subtitle={t('devices.subtitle')}
        action={
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setNetworkInfoOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <WifiIcon className="w-4 h-4 mr-2" />
              {t('devices.networkInfo')}
            </button>
            <PermissionGuard permissions={[PERMISSIONS.DEVICE_UPDATE]}>
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {t('devices.syncOrthanc')}
              </button>
            </PermissionGuard>
            <PermissionGuard permissions={[PERMISSIONS.DEVICE_CREATE]}>
              <button
                onClick={openCreate}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                {t('devices.addDevice')}
              </button>
            </PermissionGuard>
          </div>
        }
      />

      {!devices || devices.length === 0 ? (
        <EmptyState
          icon={<ComputerDesktopIcon className="w-12 h-12" />}
          title={t('devices.emptyTitle')}
          description={t('devices.emptyDesc')}
          action={
            <PermissionGuard permissions={[PERMISSIONS.DEVICE_CREATE]}>
              <button
                onClick={openCreate}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                {t('devices.addDevice')}
              </button>
            </PermissionGuard>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <div
              key={device.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getModalityColor(device.modality)}`}>
                      <span className="text-sm font-bold">{device.modality}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{device.name}</h3>
                      <p className="text-xs text-gray-500">AET: {device.aeTitle}</p>
                    </div>
                  </div>
                  {getStatusBadge(device.status)}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <SignalIcon className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="font-mono text-xs">{device.host}:{device.port}</span>
                  </div>
                  {device.localIp && (
                    <div className="flex items-center text-gray-600">
                      <WifiIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-xs">{t('devices.localIp')}: {device.localIp}</span>
                      {device.routerMappingPort && (
                        <span className="text-xs text-primary-600 ml-2">
                          → :{device.routerMappingPort}
                        </span>
                      )}
                    </div>
                  )}
                  {device.manufacturer && (
                    <div className="flex items-center text-gray-600">
                      <ComputerDesktopIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-xs">{device.manufacturer} {device.model || ''}</span>
                    </div>
                  )}
                  {device.hospital && (
                    <div className="text-xs text-gray-500">
                      📍 {device.hospital.name}
                    </div>
                  )}
                  {device._count && (
                    <div className="text-xs text-gray-400">
                      {t('devices.studyCount')}: {device._count.studies || 0}
                    </div>
                  )}
                  {device.lastConnectedAt && (
                    <div className="text-xs text-gray-400">
                      {t('devices.lastConnected')}: {new Date(device.lastConnectedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                {echoResult && echoResult.id === device.id && (
                  <div className={`mt-3 p-2 rounded-lg text-xs flex items-center ${
                    echoResult.result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {echoResult.result.success
                      ? <CheckCircleIcon className="w-4 h-4 mr-1" />
                      : <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                    }
                    {echoResult.result.message}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50">
                <button
                  onClick={() => handleEcho(device)}
                  disabled={echoLoading === device.id}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium disabled:opacity-50"
                >
                  {echoLoading === device.id ? t('devices.echoing') : t('devices.dicomEcho')}
                </button>
                <div className="flex items-center space-x-3">
                  <PermissionGuard permissions={[PERMISSIONS.DEVICE_UPDATE]}>
                    <>
                      <button
                        onClick={() => statusMutation.mutate({
                          id: device.id,
                          status: device.status === 'active' ? 'inactive' : 'active',
                        })}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        {device.status === 'active' ? t('devices.disable') : t('devices.enable')}
                      </button>
                      <button
                        onClick={() => openEdit(device)}
                        className="text-xs text-primary-600 hover:text-primary-800"
                      >
                        {t('common.edit')}
                      </button>
                    </>
                  </PermissionGuard>
                  <PermissionGuard permissions={[PERMISSIONS.DEVICE_DELETE]}>
                    <button
                      onClick={() => {
                        if (window.confirm(t('devices.deleteConfirm'))) {
                          deleteMutation.mutate(device.id);
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      {t('common.delete')}
                    </button>
                  </PermissionGuard>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingDevice ? t('devices.editDevice') : t('devices.addDevice')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.deviceName')} *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder={t('devices.deviceNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.modality')} *</label>
              <select
                value={form.modality}
                onChange={(e) => setForm({ ...form, modality: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {MODALITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.aeTitle')} *</label>
              <input
                type="text"
                required
                maxLength={16}
                value={form.aeTitle}
                onChange={(e) => setForm({ ...form, aeTitle: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="CT_SCANNER_1"
              />
              <p className="text-xs text-gray-400 mt-1">{t('devices.aeTitleHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.hospital')}</label>
              <select
                value={form.hospitalId}
                onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">{t('devices.selectHospital')}</option>
                {hospitals?.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <InformationCircleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-medium mb-1">{t('devices.starlinkNote')}</p>
                <p>{t('devices.starlinkNoteDetail')}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.publicHost')} *</label>
              <input
                type="text"
                required
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="115.29.203.40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.dicomPort')} *</label>
              <input
                type="number"
                required
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 104 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.localIp')}</label>
              <input
                type="text"
                value={form.localIp}
                onChange={(e) => setForm({ ...form, localIp: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="192.168.1.100"
              />
              <p className="text-xs text-gray-400 mt-1">{t('devices.localIpHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.routerMappingPort')}</label>
              <input
                type="number"
                value={form.routerMappingPort}
                onChange={(e) => setForm({ ...form, routerMappingPort: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="4242"
              />
              <p className="text-xs text-gray-400 mt-1">{t('devices.routerMappingPortHint')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.manufacturer')}</label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Siemens / GE / Philips"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.deviceModel')}</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="SOMATOM Definition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.serialNumber')}</label>
            <input
              type="text"
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('devices.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {(createMutation.isPending || updateMutation.isPending) ? t('common.saving') : (editingDevice ? t('common.save') : t('common.create'))}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={networkInfoOpen}
        onClose={() => setNetworkInfoOpen(false)}
        title={t('devices.networkInfoTitle')}
      >
        {networkLoading ? (
          <LoadingSpinner />
        ) : networkInfo ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">{t('devices.orthancConfig')}</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <p><span className="font-medium">AE Title:</span> {networkInfo.orthancAet}</p>
                <p><span className="font-medium">{t('devices.publicIp')}:</span> {networkInfo.serverPublicIp}</p>
                <p><span className="font-medium">DICOM {t('devices.port')}:</span> {networkInfo.dicomPort}</p>
                <p><span className="font-medium">{t('devices.networkMode')}:</span> Starlink ({t('devices.noFixedIp')})</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-medium text-amber-900 mb-2">{t('devices.ctConfigGuide')}</h4>
              <div className="space-y-2 text-sm text-amber-800">
                <p className="font-medium">{t('devices.step1Title')}</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>{t('devices.step1')}</li>
                  <li>{t('devices.step2')}</li>
                  <li>{t('devices.step3')}</li>
                  <li>{t('devices.step4')}</li>
                  <li>{t('devices.step5')}</li>
                </ol>
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">{t('devices.ctSendConfig')}</h4>
              <div className="space-y-1 text-sm text-green-800">
                <p><span className="font-medium">Remote AE Title:</span> {networkInfo.orthancAet}</p>
                <p><span className="font-medium">Remote IP:</span> {networkInfo.serverPublicIp}</p>
                <p><span className="font-medium">Remote Port:</span> {networkInfo.dicomPort}</p>
              </div>
            </div>

            {networkInfo.orthanc?.modalities && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">{t('devices.registeredModalities')}</h4>
                <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                  {JSON.stringify(networkInfo.orthanc.modalities, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">{t('devices.networkInfoError')}</p>
        )}
      </Modal>
    </div>
  );
};

export default ImagingDevices;
