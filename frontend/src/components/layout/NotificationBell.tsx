import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import {
  playMessageSound,
  showDesktopNotification,
  requestDesktopNotificationPermission,
} from '@/lib/notificationSound';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const NotificationBell: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const lastSeenIdRef = useRef<number>(0);
  const initializedRef = useRef(false);

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get('/api/notifications/unread-count');
      return res.data;
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/api/notifications', { params: { unreadOnly: 'true' } });
      return res.data;
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const readMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.put(`/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      await api.put('/api/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) readMutation.mutate(n.id);
    if (n.resourceType === 'CONSULTATION' && n.resourceId) {
      navigate(`/consultations/${n.resourceId}`);
    }
    setOpen(false);
  };

  const getIconBg = (type: string) => {
    if (type === 'CONSULTATION_INVITE') return 'bg-blue-100 text-blue-600';
    if (type === 'CONSULTATION_STATUS') return 'bg-green-100 text-green-600';
    if (type === 'CONSULTATION_RESPONSE') return 'bg-purple-100 text-purple-600';
    return 'bg-gray-100 text-gray-600';
  };

  const count = unreadCount?.count || 0;

  useEffect(() => {
    if (count > prevCountRef.current && prevCountRef.current !== 0) {
      playMessageSound();
    }
    prevCountRef.current = count;
  }, [count]);

  // 拉取到新通知时：播放声音、桌面通知、同时刷新关联业务列表
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;
    const newest = notifications[0];
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSeenIdRef.current = newest.id;
      return;
    }
    if (newest.id <= lastSeenIdRef.current) return;

    const fresh = notifications.filter((n) => n.id > lastSeenIdRef.current);
    lastSeenIdRef.current = newest.id;

    playMessageSound();
    showDesktopNotification(newest.title, newest.body, () => {
      if (newest.resourceType === 'CONSULTATION' && newest.resourceId) {
        navigate(`/consultations/${newest.resourceId}`);
      }
    });

    const types = new Set(fresh.map((n) => n.type));
    let needConsultation = false;
    let needReport = false;
    types.forEach((t) => {
      if (t.startsWith('CONSULTATION')) needConsultation = true;
      if (t.startsWith('REPORT')) needReport = true;
    });
    if (needConsultation) {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['consultation'] });
    }
    if (needReport) {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  }, [notifications, queryClient, navigate]);

  useEffect(() => {
    requestDesktopNotificationPermission();
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
      >
        <BellIcon className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-4.5 h-4.5 text-[10px] font-bold text-white bg-red-500 rounded-full min-w-[18px] h-[18px]">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">{t('notification.title')}</h3>
            {count > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                {t('notification.markAllRead')}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications && notifications.length > 0 ? (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !n.isRead ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getIconBg(n.type)}`}>
                      <BellIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleString(i18n.language, {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-400">{t('notification.noUnread')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
