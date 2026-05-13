import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserGroupIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  VideoCameraIcon,
  PlusIcon,
  DocumentTextIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';

interface DashboardStats {
  userCount: number;
  patientCount: number;
  studyCount: number;
  consultationCount: number;
}

interface Activity {
  id: number;
  action: string;
  user: { realName: string };
  createdAt: string;
}

interface PendingItem {
  id: number;
  title: string;
  status: string;
  createdAt: string;
  patient?: { id: number; name: string };
}

interface PendingData {
  pendingConsultations: PendingItem[];
  draftReports: PendingItem[];
}

const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/stats');
      return res.data;
    },
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ['dashboard', 'activities'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/recent-activities');
      return res.data;
    },
  });

  const { data: pending, isLoading: pendingLoading } = useQuery<PendingData>({
    queryKey: ['dashboard', 'pending'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/pending');
      return res.data;
    },
  });

  if (statsLoading) return <LoadingSpinner />;

  const statCards = [
    { label: t('dashboard.totalUsers'), value: stats?.userCount || 0, icon: UserGroupIcon, borderColor: 'border-l-blue-500', bgColor: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: t('dashboard.patientCount'), value: stats?.patientCount || 0, icon: UserIcon, borderColor: 'border-l-green-500', bgColor: 'bg-green-50', iconColor: 'text-green-600' },
    { label: t('dashboard.studyCount'), value: stats?.studyCount || 0, icon: ClipboardDocumentListIcon, borderColor: 'border-l-purple-500', bgColor: 'bg-purple-50', iconColor: 'text-purple-600' },
    { label: t('dashboard.consultationCount'), value: stats?.consultationCount || 0, icon: VideoCameraIcon, borderColor: 'border-l-orange-500', bgColor: 'bg-orange-50', iconColor: 'text-orange-600' },
  ];

  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleString(i18n.language, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <div className="flex space-x-3">
          <Link to="/patients" className="btn-primary inline-flex items-center">
            <PlusIcon className="w-4 h-4 mr-1" />
            {t('dashboard.addPatient')}
          </Link>
          <Link to="/consultations" className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 transition-colors">
            <VideoCameraIcon className="w-4 h-4 mr-1" />
            {t('dashboard.newConsultation')}
          </Link>
          <Link to="/reports" className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md font-medium hover:bg-gray-700 transition-colors">
            <DocumentTextIcon className="w-4 h-4 mr-1" />
            {t('dashboard.viewReports')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div key={card.label} className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${card.borderColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.recentActivities')}</h3>
          {activitiesLoading ? (
            <LoadingSpinner size="sm" />
          ) : activities && activities.length > 0 ? (
            <div className="space-y-3">
              {activities.slice(0, 8).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-700">
                        {activity.user?.realName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-500">{activity.user?.realName}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(activity.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4">{t('dashboard.noActivities')}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.pendingTasks')}</h3>
          {pendingLoading ? (
            <LoadingSpinner size="sm" />
          ) : pending ? (
            <div className="space-y-4">
              {pending.pendingConsultations && pending.pendingConsultations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">{t('dashboard.pendingConsultations')}</h4>
                  {pending.pendingConsultations.map((item) => (
                    <Link
                      key={item.id}
                      to={`/consultations`}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg mb-2 hover:bg-yellow-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <VideoCameraIcon className="w-5 h-5 text-yellow-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.patient?.name} · {formatTime(item.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <StatusBadge status={item.status} type="consultation" />
                        <ArrowRightIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {pending.draftReports && pending.draftReports.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">{t('dashboard.draftReports')}</h4>
                  {pending.draftReports.map((item) => (
                    <Link
                      key={item.id}
                      to={`/reports`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <DocumentTextIcon className="w-5 h-5 text-gray-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t('dashboard.reportLabel')} #{item.id}</p>
                          <p className="text-xs text-gray-500">{item.patient?.name} · {formatTime(item.createdAt)}</p>
                        </div>
                      </div>
                      <ArrowRightIcon className="w-4 h-4 text-gray-400" />
                    </Link>
                  ))}
                </div>
              )}
              {!pending.pendingConsultations?.length && !pending.draftReports?.length && (
                <p className="text-gray-400 text-sm py-4">{t('dashboard.noPendingTasks')}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4">{t('dashboard.noPendingTasks')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
