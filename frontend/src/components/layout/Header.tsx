import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRightOnRectangleIcon, UserCircleIcon } from '@heroicons/react/24/outline';

const roleLabels: Record<string, string> = {
  ADMIN: '系统管理员',
  DOCTOR_LOCAL: '本地医生',
  DOCTOR_REMOTE: '远程专家',
  TECHNICIAN: '技师',
};

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">BKSYS 远程医疗会诊系统</h2>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <UserCircleIcon className="w-8 h-8 text-gray-400" />
          <div className="text-sm">
            <p className="font-medium text-gray-900">{user?.realName || user?.username || '用户'}</p>
            <p className="text-gray-500">{roleLabels[typeof user?.role === 'object' ? user.role.name : user?.role || ''] || (typeof user?.role === 'object' ? user.role.name : user?.role) || ''}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <button
          onClick={handleLogout}
          className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          <span>退出登录</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
