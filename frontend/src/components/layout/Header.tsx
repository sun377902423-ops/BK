import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRightOnRectangleIcon, UserCircleIcon, LanguageIcon } from '@heroicons/react/24/outline';
import NotificationBell from './NotificationBell';

const languages = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const roleLabels: Record<string, string> = {
    ADMIN: t('role.admin'),
    DOCTOR_LOCAL: t('role.doctorLocal'),
    DOCTOR_REMOTE: t('role.doctorRemote'),
    TECHNICIAN: t('role.technician'),
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
    setLangOpen(false);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('app.name')}</h2>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center space-x-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <LanguageIcon className="w-4 h-4" />
            <span>{currentLang.label}</span>
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    i18n.language === lang.code
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-gray-200" />

        <NotificationBell />

        <div className="h-8 w-px bg-gray-200" />

        <div className="flex items-center space-x-2">
          <UserCircleIcon className="w-8 h-8 text-gray-400" />
          <div className="text-sm">
            <p className="font-medium text-gray-900">{user?.realName || user?.username || t('auth.username')}</p>
            <p className="text-gray-500">{roleLabels[typeof user?.role === 'object' ? user.role.name : user?.role || ''] || (typeof user?.role === 'object' ? user.role.name : user?.role) || ''}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <button
          onClick={handleLogout}
          className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          <span>{t('auth.logout')}</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
