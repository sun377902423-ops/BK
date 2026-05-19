import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightOnRectangleIcon, LanguageIcon, CameraIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import NotificationBell from './NotificationBell';
import UserAvatar from '@/components/ui/UserAvatar';
import api from '@/lib/api';
import { getNotificationSettings, saveNotificationSettings } from '@/lib/notificationSound';

const languages = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const Header: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notifSettings, setNotifSettings] = useState(getNotificationSettings());
  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const roleLabels: Record<string, string> = {
    ADMIN: t('role.admin'),
    DOCTOR_LOCAL: t('role.doctorLocal'),
    DOCTOR_REMOTE: t('role.doctorRemote'),
    TECHNICIAN: t('role.technician'),
  };

  const handleLogout = () => {
    logout();
  };

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
    setLangOpen(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(t('profile.avatarSizeError'));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/api/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { avatarUrl } = res.data;
      updateUser({ avatarUrl });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    } catch (err: any) {
      alert(err?.response?.data?.error || t('profile.avatarUploadError'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
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

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
          >
            <UserAvatar
              src={user?.avatarUrl}
              name={user?.realName || user?.username || '?'}
              size="sm"
            />
            <div className="text-sm text-left">
              <p className="font-medium text-gray-900">{user?.realName || user?.username || t('auth.username')}</p>
              <p className="text-gray-500 text-xs">{roleLabels[typeof user?.role === 'object' ? user.role.name : user?.role || ''] || (typeof user?.role === 'object' ? user.role.name : user?.role) || ''}</p>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-5 text-white">
                <div className="flex items-center space-x-4">
                  <div className="relative group">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-white/30">
                      <UserAvatar
                        src={user?.avatarUrl}
                        name={user?.realName || user?.username || '?'}
                        size="lg"
                      />
                    </div>
                    <button
                      onClick={handleAvatarClick}
                      disabled={uploading}
                      className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      {uploading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CameraIcon className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{user?.realName || user?.username}</p>
                    <p className="text-primary-100 text-sm">{roleLabels[typeof user?.role === 'object' ? user.role.name : user?.role || ''] || (typeof user?.role === 'object' ? user.role.name : user?.role) || ''}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('profile.username')}</span>
                  <span className="text-gray-900 font-medium">{user?.username}</span>
                </div>
                {user?.email && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('profile.email')}</span>
                    <span className="text-gray-900 font-medium">{user.email}</span>
                  </div>
                )}
                <p className="text-xs text-gray-400 pt-1">{t('profile.avatarHint')}</p>
              </div>

              <div className="border-t border-gray-100 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">{t('profile.notificationSound')}</span>
                  <button
                    onClick={() => {
                      const next = { ...notifSettings, enabled: !notifSettings.enabled };
                      setNotifSettings(next);
                      saveNotificationSettings(next);
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${notifSettings.enabled ? 'bg-primary-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifSettings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {notifSettings.enabled && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      {notifSettings.volume < 0.1 ? <SpeakerXMarkIcon className="w-3.5 h-3.5" /> : <SpeakerWaveIcon className="w-3.5 h-3.5" />}
                      <span>{t('profile.volume')}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={notifSettings.volume}
                      onChange={(e) => {
                        const next = { ...notifSettings, volume: parseFloat(e.target.value), enabled: true };
                        setNotifSettings(next);
                        saveNotificationSettings(next);
                      }}
                      className="w-28 h-1.5"
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 px-4 py-3">
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  <span>{t('auth.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
