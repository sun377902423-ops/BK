import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InboxIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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

const tabs = [
  { labelKey: 'accessRequest.received', value: 'received' },
  { labelKey: 'accessRequest.sent', value: 'sent' },
] as const;

type TabValue = typeof tabs[number]['value'];

const AccessRequests: React.FC = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>('received');

  const requestStatusMap: Record<string, { label: string; className: string }> = {
    PENDING: { label: t('status.pending'), className: 'bg-yellow-100 text-yellow-800' },
    APPROVED: { label: t('status.approved'), className: 'bg-green-100 text-green-800' },
    REJECTED: { label: t('status.rejected'), className: 'bg-red-100 text-red-800' },
  };

  const { data: receivedRequests, isLoading: loadingReceived } = useQuery<AccessRequest[]>({
    queryKey: ['access-requests', 'received'],
    queryFn: async () => {
      const res = await api.get('/api/patients/access-requests');
      return res.data;
    },
  });

  const { data: sentRequests, isLoading: loadingSent } = useQuery<AccessRequest[]>({
    queryKey: ['access-requests', 'sent'],
    queryFn: async () => {
      const res = await api.get('/api/patients/access-requests', { params: { type: 'sent' } });
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.put(`/api/patients/access-requests/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.put(`/api/patients/access-requests/${id}/reject`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
  });

  const isLoading = loadingReceived || loadingSent;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title={t('accessRequest.title')} />

      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.value
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'received' && (
        receivedRequests && receivedRequests.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('accessRequest.patientName')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('accessRequest.requester')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('accessRequest.reason')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('accessRequest.requestTime')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('accessRequest.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {receivedRequests.map((req) => {
                    const statusEntry = requestStatusMap[req.status] || { label: req.status, className: 'bg-gray-100 text-gray-800' };
                    return (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">{req.patient?.name || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{req.requester?.realName || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{req.reason}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(req.createdAt).toLocaleString(i18n.language)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusEntry.className}`}>
                            {statusEntry.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {req.status === 'PENDING' && (
                            <div className="flex items-center space-x-2">
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
                          )}
                          {req.status !== 'PENDING' && (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState icon={<InboxIcon className="w-16 h-16" />} title={t('accessRequest.noReceived')} description={t('accessRequest.noReceivedDesc')} />
        )
      )}

      {activeTab === 'sent' && (
        sentRequests && sentRequests.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('accessRequest.patientName')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('accessRequest.reason')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('accessRequest.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('accessRequest.requestTime')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sentRequests.map((req) => {
                    const statusEntry = requestStatusMap[req.status] || { label: req.status, className: 'bg-gray-100 text-gray-800' };
                    return (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">{req.patient?.name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{req.reason}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusEntry.className}`}>
                            {statusEntry.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(req.createdAt).toLocaleString(i18n.language)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState icon={<InboxIcon className="w-16 h-16" />} title={t('accessRequest.noSent')} description={t('accessRequest.noSentDesc')} />
        )
      )}
    </div>
  );
};

export default AccessRequests;
