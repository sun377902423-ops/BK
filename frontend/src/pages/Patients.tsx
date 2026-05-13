import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  InboxIcon,
  LockClosedIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Patient {
  id: number;
  patientId: string;
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  hospitalId: number;
  hospital?: { id: number; name: string };
  casePassword?: string;
  createdBy?: { id: number; realName: string };
  createdAt: string;
}

interface Hospital {
  id: number;
  name: string;
}

interface AccessRequest {
  id: number;
  patientId: number;
  patient?: { id: number; name: string; patientId: string };
  requesterId: number;
  requester?: { id: number; realName: string };
  reason: string;
  status: string;
  createdAt: string;
}

const emptyForm = {
  patientId: '',
  name: '',
  gender: 'MALE',
  birthDate: '',
  phone: '',
  email: '',
  address: '',
  hospitalId: '',
  casePassword: '',
};

const Patients: React.FC = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [accessDialog, setAccessDialog] = useState<Patient | null>(null);
  const [accessTab, setAccessTab] = useState<'request' | 'password'>('request');
  const [accessReason, setAccessReason] = useState('');
  const [casePassword, setCasePassword] = useState('');
  const [accessRequestsOpen, setAccessRequestsOpen] = useState(false);

  const genderMap: Record<string, string> = {
    MALE: t('gender.male'),
    FEMALE: t('gender.female'),
    OTHER: t('gender.other'),
  };

  const { data: patients, isLoading } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await api.get('/api/patients');
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

  const { data: receivedRequests } = useQuery<AccessRequest[]>({
    queryKey: ['access-requests', 'received'],
    queryFn: async () => {
      const res = await api.get('/api/access-requests/received');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload: Record<string, unknown> = {
        ...data,
        hospitalId: Number(data.hospitalId) || undefined,
      };
      if (!data.casePassword) delete payload.casePassword;
      const res = await api.post('/api/patients', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const res = await api.put(`/api/patients/${id}`, { ...data, hospitalId: Number(data.hospitalId) || undefined });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/patients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setDeleteTarget(null);
    },
  });

  const accessRequestMutation = useMutation({
    mutationFn: async ({ patientId, reason }: { patientId: number; reason: string }) => {
      const res = await api.post(`/api/patients/${patientId}/access-request`, { reason });
      return res.data;
    },
    onSuccess: () => {
      setAccessDialog(null);
      setAccessReason('');
    },
  });

  const verifyPasswordMutation = useMutation({
    mutationFn: async ({ patientId, password }: { patientId: number; password: string }) => {
      const res = await api.post(`/api/patients/${patientId}/verify-password`, { password });
      return res.data;
    },
    onSuccess: () => {
      setAccessDialog(null);
      setCasePassword('');
      if (accessDialog) navigate(`/patients/${accessDialog.id}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.put(`/api/access-requests/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.put(`/api/access-requests/${id}/reject`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
  });

  const handlePatientClick = async (patient: Patient) => {
    try {
      await api.get(`/api/patients/${patient.id}`);
      navigate(`/patients/${patient.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 403) {
        setAccessDialog(patient);
        setAccessTab('request');
        setAccessReason('');
        setCasePassword('');
      }
    }
  };

  const openCreateModal = () => {
    setEditingPatient(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setForm({
      patientId: patient.patientId,
      name: patient.name,
      gender: patient.gender,
      birthDate: patient.birthDate?.split('T')[0] || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      hospitalId: patient.hospitalId?.toString() || '',
      casePassword: '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPatient(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPatient) {
      updateMutation.mutate({ id: editingPatient.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const filteredPatients = patients?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.patientId.toLowerCase().includes(search.toLowerCase())
  );

  const pendingRequests = receivedRequests?.filter((r) => r.status === 'PENDING') || [];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title={t('patient.title')}
        action={
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAccessRequestsOpen(true)}
              className="btn-secondary inline-flex items-center relative"
            >
              <KeyIcon className="w-4 h-4 mr-1" />
              {t('patient.accessRequests')}
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button onClick={openCreateModal} className="btn-primary inline-flex items-center">
              <PlusIcon className="w-4 h-4 mr-1" />
              {t('patient.addPatient')}
            </button>
          </div>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            placeholder={t('patient.searchPlaceholder')}
          />
        </div>
      </div>

      {filteredPatients && filteredPatients.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('patient.patientId')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('patient.name')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('patient.gender')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('patient.phone')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('patient.hospital')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('patient.creator')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('patient.createdAt')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">{patient.patientId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        {patient.casePassword && (
                          <LockClosedIcon className="w-4 h-4 text-amber-500 mr-1.5 flex-shrink-0" />
                        )}
                        {patient.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{genderMap[patient.gender] || patient.gender}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{patient.phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{patient.hospital?.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{patient.createdBy?.realName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(patient.createdAt).toLocaleDateString(i18n.language)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handlePatientClick(patient)}
                          className="text-primary-600 hover:text-primary-900 inline-flex items-center"
                        >
                          <EyeIcon className="w-4 h-4 mr-1" />
                          {t('patient.viewDetail')}
                        </button>
                        <button onClick={() => openEditModal(patient)} className="text-blue-600 hover:text-blue-900 inline-flex items-center">
                          <PencilSquareIcon className="w-4 h-4 mr-1" />
                          {t('common.edit')}
                        </button>
                        <button onClick={() => setDeleteTarget(patient)} className="text-red-600 hover:text-red-900 inline-flex items-center">
                          <TrashIcon className="w-4 h-4 mr-1" />
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState icon={<InboxIcon className="w-16 h-16" />} title={t('patient.noData')} description={t('patient.addFirst')} />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingPatient ? t('patient.editPatient') : t('patient.addPatient')}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.patientId')}</label>
              <input
                type="text"
                value={form.patientId}
                onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.gender')}</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="input"
              >
                <option value="MALE">{t('gender.male')}</option>
                <option value="FEMALE">{t('gender.female')}</option>
                <option value="OTHER">{t('gender.other')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.birthDate')}</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.phone')}</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.email')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.address')}</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.hospital')}</label>
              <select
                value={form.hospitalId}
                onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}
                className="input"
              >
                <option value="">{t('patient.selectHospital')}</option>
                {hospitals?.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('patient.casePassword')}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={form.casePassword}
                  onChange={(e) => setForm({ ...form, casePassword: e.target.value })}
                  className="input pr-10"
                  placeholder={t('patient.casePasswordPlaceholder')}
                />
                <LockClosedIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={closeModal} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {(createMutation.isPending || updateMutation.isPending) ? t('common.submitting') : (editingPatient ? t('common.save') : t('common.create'))}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!accessDialog}
        onClose={() => setAccessDialog(null)}
        title={`${t('patient.accessRestricted')} - ${accessDialog?.name || ''}`}
        size="md"
      >
        {accessDialog && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('patient.accessDeniedMessage', { name: accessDialog.name })}
            </p>
            <div className="flex space-x-2 border-b border-gray-200">
              <button
                onClick={() => setAccessTab('request')}
                className={`py-2 px-4 text-sm font-medium border-b-2 ${
                  accessTab === 'request'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('patient.applyAccess')}
              </button>
              <button
                onClick={() => setAccessTab('password')}
                className={`py-2 px-4 text-sm font-medium border-b-2 ${
                  accessTab === 'password'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('patient.enterCasePassword')}
              </button>
            </div>

            {accessTab === 'request' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  accessRequestMutation.mutate({ patientId: accessDialog.id, reason: accessReason });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.applyReason')}</label>
                  <textarea
                    value={accessReason}
                    onChange={(e) => setAccessReason(e.target.value)}
                    className="input min-h-[100px]"
                    rows={4}
                    required
                    placeholder={t('patient.applyReasonPlaceholder')}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={() => setAccessDialog(null)} className="btn-secondary">{t('common.cancel')}</button>
                  <button
                    type="submit"
                    disabled={accessRequestMutation.isPending}
                    className="btn-primary disabled:opacity-50"
                  >
                    {accessRequestMutation.isPending ? t('common.submitting') : t('patient.submitApplication')}
                  </button>
                </div>
              </form>
            )}

            {accessTab === 'password' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verifyPasswordMutation.mutate({ patientId: accessDialog.id, password: casePassword });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.casePasswordLabel')}</label>
                  <input
                    type="password"
                    value={casePassword}
                    onChange={(e) => setCasePassword(e.target.value)}
                    className="input"
                    required
                    placeholder={t('patient.casePasswordInputPlaceholder')}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={() => setAccessDialog(null)} className="btn-secondary">{t('common.cancel')}</button>
                  <button
                    type="submit"
                    disabled={verifyPasswordMutation.isPending}
                    className="btn-primary disabled:opacity-50"
                  >
                    {verifyPasswordMutation.isPending ? t('common.verifying') : t('common.verify')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={accessRequestsOpen}
        onClose={() => setAccessRequestsOpen(false)}
        title={t('patient.accessRequests')}
        size="lg"
      >
        <div className="space-y-4">
          {pendingRequests.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {pendingRequests.map((req) => (
                <div key={req.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{req.requester?.realName || '-'}</span>
                        <span className="text-sm text-gray-500">{t('patient.applyAccess')}</span>
                        <span className="text-sm font-medium text-primary-600">{req.patient?.name || '-'}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{req.reason}</p>
                      <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleString(i18n.language)}</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                      >
                        {t('common.approve')}
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(req.id)}
                        disabled={rejectMutation.isPending}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                      >
                        {t('common.reject')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">{t('patient.noPendingRequests')}</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={t('patient.deleteConfirmTitle')}
        message={t('patient.deleteConfirmMessage', { name: deleteTarget?.name })}
        confirmText={t('common.delete')}
        variant="danger"
      />
    </div>
  );
};

export default Patients;
