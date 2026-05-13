import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon,
  UserGroupIcon,
  PlayIcon,
  StopIcon,
  XMarkIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Consultation {
  id: number;
  title: string;
  patientId: number;
  studyId?: number;
  hospitalId?: number;
  status: string;
  createdAt: string;
  patient?: { id: number; name: string; patientId: string };
  participants?: { id: number; userId: number; user: { id: number; realName: string; username: string } }[];
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
}

interface User {
  id: number;
  realName: string;
  username: string;
}

const statusTabs = [
  { label: '全部', value: '' },
  { label: '待开始', value: 'CREATED' },
  { label: '进行中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
];

const Consultations: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    patientId: '',
    studyId: '',
    participantIds: [] as number[],
  });

  const { data: consultations, isLoading } = useQuery<Consultation[]>({
    queryKey: ['consultations', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
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
    queryKey: ['studies'],
    queryFn: async () => {
      const res = await api.get('/api/studies');
      return res.data;
    },
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
        patientId: Number(data.patientId),
      };
      if (data.studyId) payload.studyId = Number(data.studyId);
      if (data.participantIds.length > 0) payload.participantIds = data.participantIds;
      const res = await api.post('/api/consultations', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      setModalOpen(false);
      setForm({ title: '', patientId: '', studyId: '', participantIds: [] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await api.put(`/api/consultations/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
    },
  });

  const toggleParticipant = (userId: number) => {
    setForm((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(userId)
        ? prev.participantIds.filter((id) => id !== userId)
        : [...prev.participantIds, userId],
    }));
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="远程会诊"
        action={
          <button onClick={() => setModalOpen(true)} className="btn-primary inline-flex items-center">
            <PlusIcon className="w-4 h-4 mr-1" />
            新建会诊
          </button>
        }
      />

      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
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

      {consultations && consultations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {consultations.map((consultation) => (
            <div
              key={consultation.id}
              className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{consultation.title}</h3>
                <StatusBadge status={consultation.status} type="consultation" />
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-gray-400 w-16">患者:</span>
                  <span>{consultation.patient?.name || '-'}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-gray-400 w-16">参与人:</span>
                  <span className="inline-flex items-center">
                    <UserGroupIcon className="w-4 h-4 mr-1" />
                    {consultation.participants?.length || 0} 人
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="text-gray-400 w-16">创建:</span>
                  <span>{new Date(consultation.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-3 border-t border-gray-100">
                {consultation.status === 'CREATED' && (
                  <button
                    onClick={() => statusMutation.mutate({ id: consultation.id, status: 'IN_PROGRESS' })}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    <PlayIcon className="w-3.5 h-3.5 mr-1" />
                    开始会诊
                  </button>
                )}
                {consultation.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => statusMutation.mutate({ id: consultation.id, status: 'COMPLETED' })}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200"
                  >
                    <StopIcon className="w-3.5 h-3.5 mr-1" />
                    结束会诊
                  </button>
                )}
                {(consultation.status === 'CREATED' || consultation.status === 'IN_PROGRESS') && (
                  <button
                    onClick={() => statusMutation.mutate({ id: consultation.id, status: 'CANCELLED' })}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    <XMarkIcon className="w-3.5 h-3.5 mr-1" />
                    取消会诊
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<InboxIcon className="w-16 h-16" />} title="暂无会诊数据" description="点击上方按钮新建一个会诊" />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setForm({ title: '', patientId: '', studyId: '', participantIds: [] }); }}
        title="新建会诊"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">会诊标题</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择患者</label>
            <select
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              className="input"
              required
            >
              <option value="">请选择患者</option>
              {patients?.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.patientId})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">关联检查（可选）</label>
            <select
              value={form.studyId}
              onChange={(e) => setForm({ ...form, studyId: e.target.value })}
              className="input"
            >
              <option value="">不关联检查</option>
              {studies?.map((s) => (
                <option key={s.id} value={s.id}>{s.orthancStudyId} - {s.modality}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">参与人员</label>
            <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
              {users?.map((user) => (
                <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.participantIds.includes(user.id)}
                    onChange={() => toggleParticipant(user.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{user.realName} ({user.username})</span>
                </label>
              ))}
              {(!users || users.length === 0) && (
                <p className="text-sm text-gray-400">暂无可选用户</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => { setModalOpen(false); setForm({ title: '', patientId: '', studyId: '', participantIds: [] }); }}
              className="btn-secondary"
            >
              取消
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary disabled:opacity-50">
              {createMutation.isPending ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Consultations;
