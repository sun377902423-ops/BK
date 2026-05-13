import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  VideoCameraIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';

const menuItems = [
  { name: '仪表盘', path: '/', icon: HomeIcon },
  { name: '患者管理', path: '/patients', icon: UsersIcon },
  { name: '影像检查', path: '/studies', icon: ClipboardDocumentListIcon },
  { name: '远程会诊', path: '/consultations', icon: VideoCameraIcon },
  { name: '报告管理', path: '/reports', icon: DocumentTextIcon },
  { name: '访问申请', path: '/access-requests', icon: KeyIcon },
  { name: '用户管理', path: '/users', icon: UserGroupIcon },
  { name: '医院管理', path: '/hospitals', icon: BuildingOffice2Icon },
];

const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">BKSYS 会诊系统</h1>
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
