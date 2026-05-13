import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../lib/permissions';
import {
  HomeIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  VideoCameraIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  KeyIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { hasAnyPermission } = useAuth();

  const allMenuItems = [
    { name: t('nav.dashboard'), path: '/', icon: HomeIcon, permissions: [] },
    { name: t('nav.patients'), path: '/patients', icon: UsersIcon, permissions: [PERMISSIONS.PATIENT_LIST] },
    { name: t('nav.studies'), path: '/studies', icon: ClipboardDocumentListIcon, permissions: [PERMISSIONS.STUDY_LIST] },
    { name: t('nav.consultations'), path: '/consultations', icon: VideoCameraIcon, permissions: [PERMISSIONS.CONSULTATION_LIST] },
    { name: t('nav.reports'), path: '/reports', icon: DocumentTextIcon, permissions: [PERMISSIONS.REPORT_LIST] },
    { name: t('nav.accessRequests'), path: '/access-requests', icon: KeyIcon, permissions: [PERMISSIONS.ACCESS_REQUEST_LIST] },
    { name: t('nav.roles'), path: '/roles', icon: ShieldCheckIcon, permissions: [PERMISSIONS.USER_ASSIGN_ROLE] },
    { name: t('nav.users'), path: '/users', icon: UserGroupIcon, permissions: [PERMISSIONS.USER_LIST] },
    { name: t('nav.hospitals'), path: '/hospitals', icon: BuildingOffice2Icon, permissions: [PERMISSIONS.HOSPITAL_LIST] },
  ];

  const menuItems = allMenuItems.filter(
    (item) => item.permissions.length === 0 || hasAnyPermission(...item.permissions)
  );

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">{t('app.shortName')}</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
