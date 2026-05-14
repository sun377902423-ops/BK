import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  UserGroupIcon,
  EyeIcon,
  InboxIcon,
  CalendarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PermissionGuard from '@/components/ui/PermissionGuard';

interface Participant {
  id: number;
  userId: number;
  role: string;
  status: string;
  user: { id: number; realName: string; username: string; role?: { name: string } };
}

interface Consultation {
  id: number;
  jitsiRoomName: string;
  title: string;
  description?: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  createdAt: string;
  patient?: { id: number; name: string; patientId: string };
  createdBy?: { id: number; realName: string; username: string };
  participants?: Participant[];
  study?: { id: number; orthancStudyId: string; modality: string };
}

interface Patient {
  id: number;
  name: string;
  patientId: string;
}

interface Study {
  id: number;
  orthancStudyId: string;
  modality: string;
  studyDescription?: string;
  studyDate?: string;
  patientId: number;
}

interface User {
  id: number;
  realName: string;
  username: string;
}

const Consultations: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [mineFilter, setMineFilter] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const getDefaultScheduledAt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({
    title: '',
    description: '',
    patientId: '',
    studyId: '',
    scheduledAt: '',
    participants: [] as { userId: number; role: string }[],
  });

  const statusTabs = [
    { label: t('consultation.all'), value: '' },
    { label: t('consultation.created'), value: 'CREATED' },
    { label: t('consultation.invited'), value: 'INVITED' },
    { label: t('consultation.scheduled'), value: 'SCHEDULED' },
    { label: t('consultation.inProgress'), value: 'IN_PROGRESS' },
    { label: t('consultation.completed'), value: 'COMPLETED' },
    { label: t('consultation.cancelled'), value: 'CANCELLED' },
    { label: t('consultation.archived'), value: 'ARCHIVED' },
  ];

  const { data: consultations, isLoading } = useQuery<Consultation[]>({
    queryKey: ['consultations', statusFilter, mineFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (mineFilter) params.mine = 'true';
      const res = await api.get('/api/consultations', { params });
      return res.data;
    },
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await api.get('/api/patients');
      return res.data;
    },
  });

  const { data: studies } = useQuery<Study[]>({
    queryKey: ['studies', form.patientId],
    queryFn: async () => {
      if (!form.patientId) return [];
      const res = await api.get('/api/studies', { params: { patientId: form.patientId } });
      return res.data;
    },
    enabled: !!form.patientId,
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        patientId: Number(data.patientId),
      };
      if (data.studyId) payload.studyId = Number(data.studyId);
      if (data.scheduledAt) payload.scheduledAt = data.scheduledAt;
      if (data.participants.length > 0) {
        payload.participants = data.participants.map((p) => ({
          userId: p.userId,
          role: p.role,
        }));
      }
      const res = await api.post('/api/consultations', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      setModalOpen(false);
      setForm({ title: '', description: '', patientId: '', studyId: '', scheduledAt: '', participants: [] });
    },
  });

  const toggleParticipant = (userId: number, role: string) => {
    setForm((prev) => {
      const exists = prev.participants.find((p) => p.userId === userId);
      if (exists) {
        return { ...prev, participants: prev.participants.filter((p) => p.userId !== userId) };
      }
      return { ...prev, participants: [...prev.participants, { userId, role }] };
    });
  };

  const getParticipantRoleLabel = (role: string) => {
    const map: Record<string, string> = {
      INITIATOR: t('consultation.initiator'),
      EXPERT: t('consultation.expert'),
      OBSERVER: t('consultation.observer'),
    };
    return map[role] || role;
  };

  const getParticipantStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      INVITED: t('consultation.invitedStatus'),
      ACCEPTED: t('consultation.acceptedStatus'),
      DECLINED: t('consultation.declinedStatus'),
      JOINED: t('consultation.joinedStatus'),
      LEFT: t('consultation.leftStatus'),
    };
    return map[status] || status;
  };

  const getStatusDot = (status: string) => {
    const map: Record<string, string> = {
      INVITED: 'bg-yellow-400',
      ACCEPTED: 'bg-green-400',
      DECLINED: 'bg-red-400',
      JOINED: 'bg-blue-400',
      LEFT: 'bg-gray-400',
    };
    return map[status] || 'bg-gray-300';
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title={t('consultation.title')}
        action={
          <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_CREATE]}>
            <button onClick={() => { setForm(f => ({ ...f, scheduledAt: getDefaultScheduledAt() })); setModalOpen(true); }} className="btn-primary inline-flex items-center">
              <PlusIcon className="w-4 h-4 mr-1" />
              {t('consultation.newConsultation')}
            </button>
          </PermissionGuard>
        }
      />

      <div className="mb-4 flex items-center justify-between">
        <div className="border-b border-gray-200 flex-1">
          <nav className="flex space-x-6 overflow-x-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  statusFilter === tab.value
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <label className="flex items-center space-x-2 ml-4 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={mineFilter}
            onChange={(e) => setMineFilter(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>{t('consultation.myConsultations')}</span>
        </label>
      </div>

      {consultations && consultations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {consultations.map((consultation) => (
            <div
              key={consultation.id}
              onClick={() => navigate(`/consultations/${consultation.id}`)}
              className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow border border-gray-100 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{consultation.title}</h3>
                <StatusBadge status={consultation.status} type="consultation" />
              </div>

              {consultation.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{consultation.description}</p>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-gray-400 w-16">{t('consultation.patient')}:</span>
                  <span>{consultation.patient?.name || '-'}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-gray-400 w-16">{t('consultation.initiator')}:</span>
                  <span>{consultation.createdBy?.realName || consultation.createdBy?.username || '-'}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-gray-400 w-16">{t('consultation.participants')}:</span>
                  <span className="inline-flex items-center">
                    <UserGroupIcon className="w-4 h-4 mr-1" />
                    {consultation.participants?.filter((p) => p.status !== 'DECLINED').length || 0} {t('consultation.people')}
                  </span>
                </div>
                {consultation.scheduledAt && (
                  <div className="flex items-center text-sm text-gray-500">
                    <CalendarIcon className="w-4 h-4 mr-1 text-gray-400" />
                    <span>{new Date(consultation.scheduledAt).toLocaleString(i18n.language, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-500">
                  <ClockIcon className="w-4 h-4 mr-1 text-gray-400" />
                  <span>{new Date(consultation.createdAt).toLocaleDateString(i18n.language)}</span>
                </div>
              </div>

              {consultation.participants && consultation.participants.length > 0 && (
                <div className="flex items-center space-x-1 mb-3">
                  {consultation.participants.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="relative"
                      title={`${p.user.realName || p.user.username} - ${getParticipantRoleLabel(p.role)} (${getParticipantStatusLabel(p.status)})`}
                    >
                      <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-primary-700">
                          {(p.user.realName || p.user.username).charAt(0)}
                        </span>
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${getStatusDot(p.status)}`} />
                    </div>
                  ))}
                  {consultation.participants.length > 5 && (
                    <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-xs text-gray-500">+{consultation.participants.length - 5}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => navigate(`/consultations/${consultation.id}`)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100"
                >
                  <EyeIcon className="w-3.5 h-3.5 mr-1" />
                  {t('consultation.viewDetail')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<InboxIcon className="w-16 h-16" />}
          title={t('consultation.noData')}
          description={t('consultation.createFirst')}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setForm({ title: '', description: '', patientId: '', studyId: '', scheduledAt: '', participants: [] }); }}
        title={t('consultation.newConsultation')}
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('consultation.consultationTitle')}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('consultation.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('consultation.selectPatient')}</label>
              <select
                value={form.patientId}
                onChange={(e) => setForm({ ...form, patientId: e.target.value, studyId: '' })}
                className="input"
                required
              >
                <option value="">{t('consultation.selectPatientPlaceholder')}</option>
                {patients?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.patientId})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('consultation.scheduledAt')}</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('consultation.relatedStudy')}</label>
            <select
              value={form.studyId}
              onChange={(e) => setForm({ ...form, studyId: e.target.value })}
              className="input"
              disabled={!form.patientId}
            >
              <option value="">{form.patientId ? t('consultation.noRelatedStudy') : t('consultation.selectPatientFirst')}</option>
              {studies?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.modality || 'N/A'} - {s.studyDescription || s.orthancStudyId.slice(0, 12)} ({s.studyDate ? new Date(s.studyDate).toLocaleDateString() : '-'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('consultation.inviteParticipants')}</label>
            <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              {users?.filter((u) => u.id !== currentUser?.id).map((user) => {
                const selected = form.participants.find((p) => p.userId === user.id);
                return (
                  <div key={user.id} className="flex items-center justify-between p-1.5 rounded hover:bg-gray-50">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleParticipant(user.id, selected?.role || 'EXPERT')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{user.realName} ({user.username})</span>
                    </label>
                    {selected && (
                      <select
                        value={selected.role}
                        onChange={(e) => toggleParticipant(user.id, e.target.value)}
                        className="text-xs border rounded px-1.5 py-0.5"
                      >
                        <option value="EXPERT">{t('consultation.expert')}</option>
                        <option value="OBSERVER">{t('consultation.observer')}</option>
                      </select>
                    )}
                  </div>
                );
              })}
              {(!users || users.length <= 1) && (
                <p className="text-sm text-gray-400">{t('consultation.noAvailableUsers')}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => { setModalOpen(false); setForm({ title: '', description: '', patientId: '', studyId: '', scheduledAt: '', participants: [] }); }}
              className="btn-secondary"
            >
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary disabled:opacity-50">
              {createMutation.isPending ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Consultations;
