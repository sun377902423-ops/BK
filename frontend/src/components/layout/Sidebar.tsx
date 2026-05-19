import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../lib/permissions';
import { useSidebar } from '../../contexts/SidebarContext';
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
  CommandLineIcon,
  ComputerDesktopIcon,
  CircleStackIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';

const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { hasAnyPermission } = useAuth();
  const { collapsed, toggle } = useSidebar();

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
    { name: t('nav.devices'), path: '/devices', icon: ComputerDesktopIcon, permissions: [PERMISSIONS.DEVICE_LIST] },
    { name: t('nav.backup'), path: '/backup', icon: CircleStackIcon, permissions: [PERMISSIONS.BACKUP_LIST] },
    { name: t('nav.systemLogs'), path: '/system-logs', icon: CommandLineIcon, permissions: [PERMISSIONS.SYSTEM_AUDIT] },
  ];

  const menuItems = allMenuItems.filter(
    (item) => item.permissions.length === 0 || hasAnyPermission(...item.permissions)
  );

  return (
    <div className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className={`p-6 border-b border-slate-700 ${collapsed ? 'px-0 text-center' : ''}`}>
        <h1 className={`font-bold transition-all duration-300 ${collapsed ? 'text-lg' : 'text-xl'}`}>
          {collapsed ? 'BK' : t('app.shortName')}
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-x-hidden">
        {menuItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center rounded-lg transition-colors ${
                collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5'
              } ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={`w-5 h-5 ${collapsed ? '' : 'mr-3'}`} />
              {!collapsed && item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-700 p-3">
        <button
          onClick={toggle}
          className={`flex items-center w-full rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-slate-800 ${
            collapsed ? 'justify-center py-2.5' : 'px-4 py-2.5'
          }`}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
        >
          {collapsed ? (
            <ChevronDoubleRightIcon className="w-5 h-5" />
          ) : (
            <>
              <ChevronDoubleLeftIcon className="w-5 h-5 mr-3" />
              <span className="text-sm">{t('nav.collapse')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
