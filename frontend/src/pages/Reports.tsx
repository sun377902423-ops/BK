import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  EyeIcon,
  PencilSquareIcon,
  CheckBadgeIcon,
  InboxIcon,
  PlusIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Report {
  id: number;
  content: Record<string, unknown> | string;
  status: string;
  patientId?: number;
  consultationId?: number;
  studyId?: number;
  patient?: { id: number; name: string };
  consultation?: { id: number; title: string };
  study?: { id: number; modality: string; orthancStudyId: string };
  signedBy?: { id: number; realName: string };
  createdAt: string;
}

interface Patient {
  id: number;
  name: string;
  patientId: string;
}

interface Consultation {
  id: number;
  title: string;
  patientId: number;
}

interface Study {
  id: number;
  orthancStudyId: string;
  modality: string;
  patientId?: number;
}

interface ReportContent {
  findings: string;
  impression: string;
  recommendations: string;
}

const statusTabs = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '已提交', value: 'SUBMITTED' },
  { label: '已批准', value: 'APPROVED' },
  { label: '已归档', value: 'ARCHIVED' },
];

const emptyContent: ReportContent = { findings: '', impression: '', recommendations: '' };

const parseContent = (content: Record<string, unknown> | string): ReportContent => {
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return parsed as ReportContent;
    } catch {
      return { ...emptyContent, findings: content };
    }
    return emptyContent;
  }
  return {
    findings: (content as Record<string, unknown>).findings as string || '',
    impression: (content as Record<string, unknown>).impression as string || '',
    recommendations: (content as Record<string, unknown>).recommendations as string || '',
  };
};

const Reports: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [editReport, setEditReport] = useState<Report | null>(null);
  const [editContent, setEditContent] = useState<ReportContent>(emptyContent);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    patientId: '',
    consultationId: '',
    studyId: '',
  });
  const [createContent, setCreateContent] = useState<ReportContent>(emptyContent);
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);

  const { data: reports, isLoading } = useQuery<Report[]>({
    queryKey: ['reports', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/api/reports', { params });
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

  const { data: consultations } = useQuery<Consultation[]>({
    queryKey: ['consultations'],
    queryFn: async () => {
      const res = await api.get('/api/consultations');
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

  const filteredConsultations = consultations?.filter(
    (c) => !createForm.patientId || c.patientId === Number(createForm.patientId)
  );

  const filteredStudies = studies?.filter(
    (s) => !createForm.patientId || s.patientId === Number(createForm.patientId)
  );

  const createMutation = useMutation({
    mutationFn: async (data: { patientId: number; consultationId?: number; studyId?: number; content: ReportContent }) => {
      const res = await api.post('/api/reports', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setCreateOpen(false);
      setCreateForm({ patientId: '', consultationId: '', studyId: '' });
      setCreateContent(emptyContent);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: ReportContent }) => {
      const res = await api.put(`/api/reports/${id}`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setEditReport(null);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/api/reports/${id}/submit`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const signMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/api/reports/${id}/sign`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setDeleteTarget(null);
    },
  });

  const openEditModal = (report: Report) => {
    setEditReport(report);
    setEditContent(parseContent(report.content));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      patientId: Number(createForm.patientId),
      content: createContent,
    };
    if (createForm.consultationId) payload.consultationId = Number(createForm.consultationId);
    if (createForm.studyId) payload.studyId = Number(createForm.studyId);
    createMutation.mutate(payload as Parameters<typeof createMutation.mutate>[0]);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editReport) updateMutation.mutate({ id: editReport.id, content: editContent });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="报告管理"
        action={
          <button onClick={() => setCreateOpen(true)} className="btn-primary inline-flex items-center">
            <PlusIcon className="w-4 h-4 mr-1" />
            新建报告
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

      {reports && reports.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">报告ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">患者</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">关联会诊</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">检查类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">签署人</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">RPT-{report.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{report.patient?.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{report.consultation?.title || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{report.study?.modality || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm"><StatusBadge status={report.status} type="report" /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(report.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{report.signedBy?.realName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setViewReport(report)}
                          className="text-primary-600 hover:text-primary-900 inline-flex items-center"
                        >
                          <EyeIcon className="w-4 h-4 mr-1" />
                          查看
                        </button>
                        {(report.status === 'DRAFT' || report.status === 'SUBMITTED') && (
                          <button
                            onClick={() => openEditModal(report)}
                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                          >
                            <PencilSquareIcon className="w-4 h-4 mr-1" />
                            编辑
                          </button>
                        )}
                        {report.status === 'DRAFT' && (
                          <button
                            onClick={() => submitMutation.mutate(report.id)}
                            disabled={submitMutation.isPending}
                            className="text-amber-600 hover:text-amber-900 inline-flex items-center disabled:opacity-50"
                          >
                            <PaperAirplaneIcon className="w-4 h-4 mr-1" />
                            提交
                          </button>
                        )}
                        {report.status === 'SUBMITTED' && (
                          <button
                            onClick={() => signMutation.mutate(report.id)}
                            disabled={signMutation.isPending}
                            className="text-green-600 hover:text-green-900 inline-flex items-center disabled:opacity-50"
                          >
                            <CheckBadgeIcon className="w-4 h-4 mr-1" />
                            签署
                          </button>
                        )}
                        {report.status === 'DRAFT' && (
                          <button
                            onClick={() => setDeleteTarget(report)}
                            className="text-red-600 hover:text-red-900 inline-flex items-center"
                          >
                            <TrashIcon className="w-4 h-4 mr-1" />
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState icon={<InboxIcon className="w-16 h-16" />} title="暂无报告数据" description="点击上方按钮新建报告" />
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setCreateForm({ patientId: '', consultationId: '', studyId: '' }); setCreateContent(emptyContent); }}
        title="新建报告"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择患者</label>
            <select
              value={createForm.patientId}
              onChange={(e) => setCreateForm({ ...createForm, patientId: e.target.value, consultationId: '', studyId: '' })}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">关联会诊（可选）</label>
            <select
              value={createForm.consultationId}
              onChange={(e) => setCreateForm({ ...createForm, consultationId: e.target.value })}
              className="input"
            >
              <option value="">不关联会诊</option>
              {filteredConsultations?.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">关联检查（可选）</label>
            <select
              value={createForm.studyId}
              onChange={(e) => setCreateForm({ ...createForm, studyId: e.target.value })}
              className="input"
            >
              <option value="">不关联检查</option>
              {filteredStudies?.map((s) => (
                <option key={s.id} value={s.id}>{s.orthancStudyId} - {s.modality}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-4">
            <h3 className="text-sm font-medium text-gray-700">报告内容</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">检查所见</label>
              <textarea
                value={createContent.findings}
                onChange={(e) => setCreateContent({ ...createContent, findings: e.target.value })}
                className="input min-h-[100px]"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">诊断意见</label>
              <textarea
                value={createContent.impression}
                onChange={(e) => setCreateContent({ ...createContent, impression: e.target.value })}
                className="input min-h-[100px]"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">建议</label>
              <textarea
                value={createContent.recommendations}
                onChange={(e) => setCreateContent({ ...createContent, recommendations: e.target.value })}
                className="input min-h-[100px]"
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => { setCreateOpen(false); setCreateForm({ patientId: '', consultationId: '', studyId: '' }); setCreateContent(emptyContent); }}
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

      <Modal
        isOpen={!!viewReport}
        onClose={() => setViewReport(null)}
        title={`报告详情 - RPT-${viewReport?.id}`}
        size="lg"
      >
        {viewReport && (() => {
          const content = parseContent(viewReport.content);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">患者</p>
                  <p className="text-base font-medium text-gray-900">{viewReport.patient?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">关联会诊</p>
                  <p className="text-base font-medium text-gray-900">{viewReport.consultation?.title || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">检查类型</p>
                  <p className="text-base font-medium text-gray-900">{viewReport.study?.modality || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">状态</p>
                  <StatusBadge status={viewReport.status} type="report" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">签署人</p>
                  <p className="text-base font-medium text-gray-900">{viewReport.signedBy?.realName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">创建时间</p>
                  <p className="text-base font-medium text-gray-900">{new Date(viewReport.createdAt).toLocaleDateString('zh-CN')}</p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">检查所见</p>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {content.findings || '暂无内容'}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">诊断意见</p>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {content.impression || '暂无内容'}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">建议</p>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {content.recommendations || '暂无内容'}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        isOpen={!!editReport}
        onClose={() => setEditReport(null)}
        title={`编辑报告 - RPT-${editReport?.id}`}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">检查所见</label>
            <textarea
              value={editContent.findings}
              onChange={(e) => setEditContent({ ...editContent, findings: e.target.value })}
              className="input min-h-[100px]"
              rows={4}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">诊断意见</label>
            <textarea
              value={editContent.impression}
              onChange={(e) => setEditContent({ ...editContent, impression: e.target.value })}
              className="input min-h-[100px]"
              rows={4}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">建议</label>
            <textarea
              value={editContent.recommendations}
              onChange={(e) => setEditContent({ ...editContent, recommendations: e.target.value })}
              className="input min-h-[100px]"
              rows={4}
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={() => setEditReport(null)} className="btn-secondary">取消</button>
            <button type="submit" disabled={updateMutation.isPending} className="btn-primary disabled:opacity-50">
              {updateMutation.isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="确认删除"
        message={`确定要删除报告「RPT-${deleteTarget?.id}」吗？此操作不可撤销。`}
        confirmText="删除"
        variant="danger"
      />
    </div>
  );
};

export default Reports;
