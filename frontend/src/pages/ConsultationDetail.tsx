import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  VideoCameraIcon,
  PlayIcon,
  StopIcon,
  XMarkIcon,
  UserGroupIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
  PaperAirplaneIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PermissionGuard from '@/components/ui/PermissionGuard';

interface Participant {
  id: number;
  userId: number;
  role: string;
  status: string;
  invitedAt: string;
  respondedAt: string | null;
  joinedAt: string | null;
  user: { id: number; realName: string; username: string; role?: { name: string; displayName: string } };
}

interface Message {
  id: number;
  userId: number;
  content: string;
  type: string;
  createdAt: string;
  user: { id: number; realName: string; username: string };
}

interface Study {
  id: number;
  orthancStudyId: string;
  modality: string;
  studyDate: string;
  studyDescription: string;
}

interface Patient {
  id: number;
  patientId: string;
  name: string;
  gender: string;
}

interface Consultation {
  id: number;
  jitsiRoomName: string;
  title: string;
  description?: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  patient: Patient;
  study?: Study;
  createdById: number;
  createdBy: { id: number; realName: string; username: string };
  participants: Participant[];
  messages: Message[];
}

interface User {
  id: number;
  realName: string;
  username: string;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JITSI_SERVER = 'meet.jit.si';

const ConsultationDetail: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [messageInput, setMessageInput] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'info' | 'chat'>('info');

  const { data: consultation, isLoading } = useQuery<Consultation>({
    queryKey: ['consultation', id],
    queryFn: async () => {
      const res = await api.get(`/api/consultations/${id}`);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const res = await api.put(`/api/consultations/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation', id] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (participants: { userId: number; role: string }[]) => {
      const res = await api.post(`/api/consultations/${id}/participants/invite`, { participants });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation', id] });
      setSelectedUserIds([]);
      setSelectedRoles({});
      setAddParticipantOpen(false);
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: 'ACCEPTED' | 'DECLINED' }) => {
      const res = await api.put(`/api/consultations/${id}/participants/${userId}/respond`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation', id] });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.delete(`/api/consultations/${id}/participants/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation', id] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/api/consultations/${id}/messages`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation', id] });
      setMessageInput('');
    },
  });

  const initJitsi = useCallback(() => {
    if (!consultation || !jitsiContainerRef.current) return;
    if (jitsiApiRef.current) return;

    const existingScript = document.querySelector(`script[src*="${JITSI_SERVER}/external_api.js"]`);
    const startJitsi = () => {
      if (!window.JitsiMeetExternalAPI || !jitsiContainerRef.current || jitsiApiRef.current) return;
      const displayName = currentUser?.realName || currentUser?.username || 'Doctor';
      jitsiApiRef.current = new window.JitsiMeetExternalAPI(JITSI_SERVER, {
        roomName: consultation.jitsiRoomName,
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          requireDisplayName: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#1a1a2e',
        },
        userInfo: { displayName },
      });
    };

    if (existingScript) {
      startJitsi();
    } else {
      const script = document.createElement('script');
      script.src = `https://${JITSI_SERVER}/external_api.js`;
      script.async = true;
      script.onload = startJitsi;
      document.head.appendChild(script);
    }
  }, [consultation, currentUser]);

  const disposeJitsi = useCallback(() => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (consultation?.status === 'IN_PROGRESS') {
      const timer = setTimeout(initJitsi, 500);
      return () => clearTimeout(timer);
    } else {
      disposeJitsi();
    }
  }, [consultation?.status, initJitsi, disposeJitsi]);

  useEffect(() => {
    return () => { disposeJitsi(); };
  }, [disposeJitsi]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consultation?.messages]);

  const handleStartConsultation = () => {
    statusMutation.mutate({ status: 'IN_PROGRESS' });
  };

  const handleEndConsultation = () => {
    disposeJitsi();
    statusMutation.mutate({ status: 'COMPLETED' });
  };

  const handleCancelConsultation = () => {
    disposeJitsi();
    statusMutation.mutate({ status: 'CANCELLED' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput.trim());
  };

  const handleInviteParticipants = () => {
    const participants = selectedUserIds.map((userId) => ({
      userId,
      role: selectedRoles[userId] || 'EXPERT',
    }));
    inviteMutation.mutate(participants);
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const availableUsers = users?.filter(
    (u) => !consultation?.participants?.some((p) => p.userId === u.id)
  );

  const myParticipant = consultation?.participants?.find((p) => p.userId === currentUser?.id);
  const isInitiator = consultation?.createdById === currentUser?.id;
  const isInvited = myParticipant?.status === 'INVITED';
  const isInProgress = consultation?.status === 'IN_PROGRESS';
  const isCreated = consultation?.status === 'CREATED';
  const isInvitedStatus = consultation?.status === 'INVITED';
  const isScheduled = consultation?.status === 'SCHEDULED';
  const isActive = isCreated || isInvitedStatus || isScheduled || isInProgress;

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString(i18n.language, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  const getRoleLabel = (role: string) => {
    const map: Record<string, string> = {
      INITIATOR: t('consultation.initiator'),
      EXPERT: t('consultation.expert'),
      OBSERVER: t('consultation.observer'),
    };
    return map[role] || role;
  };

  const getParticipantStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      INVITED: t('consultation.invitedStatus'),
      ACCEPTED: t('consultation.acceptedStatus'),
      DECLINED: t('consultation.declinedStatus'),
      JOINED: t('consultation.joinedStatus'),
      LEFT: t('consultation.leftStatus'),
    };
    return map[status] || status;
  };

  const getStatusDotColor = (status: string) => {
    const map: Record<string, string> = {
      INVITED: 'bg-yellow-400',
      ACCEPTED: 'bg-green-400',
      DECLINED: 'bg-red-400',
      JOINED: 'bg-blue-400',
      LEFT: 'bg-gray-400',
    };
    return map[status] || 'bg-gray-300';
  };

  if (isLoading) return <LoadingSpinner />;
  if (!consultation) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <VideoCameraIcon className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">{t('consultation.notFound')}</p>
        <button onClick={() => navigate('/consultations')} className="btn-primary mt-4">{t('common.back')}</button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate('/consultations')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-gray-900">{consultation.title}</h1>
              <StatusBadge status={consultation.status} type="consultation" />
            </div>
            <p className="text-xs text-gray-500">
              {t('consultation.initiator')}: {consultation.createdBy?.realName || consultation.createdBy?.username}
              {consultation.scheduledAt && ` · ${t('consultation.scheduledAt')}: ${formatDateTime(consultation.scheduledAt)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isInvited && (
            <>
              <button
                onClick={() => respondMutation.mutate({ userId: currentUser!.id, status: 'ACCEPTED' })}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
              >
                <CheckIcon className="w-4 h-4 mr-1" />
                {t('consultation.acceptInvitation')}
              </button>
              <button
                onClick={() => respondMutation.mutate({ userId: currentUser!.id, status: 'DECLINED' })}
                className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-sm"
              >
                <XMarkIcon className="w-4 h-4 mr-1" />
                {t('consultation.declineInvitation')}
              </button>
            </>
          )}
          {(isCreated || isInvitedStatus || isScheduled) && !isInvited && (
            <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_JOIN]}>
              <button
                onClick={handleStartConsultation}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
              >
                <PlayIcon className="w-4 h-4 mr-1" />
                {t('consultation.startConsultation')}
              </button>
            </PermissionGuard>
          )}
          {isInProgress && (
            <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_CLOSE]}>
              <button
                onClick={handleEndConsultation}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors text-sm"
              >
                <StopIcon className="w-4 h-4 mr-1" />
                {t('consultation.endConsultation')}
              </button>
            </PermissionGuard>
          )}
          {isActive && isInitiator && (
            <button
              onClick={handleCancelConsultation}
              className="inline-flex items-center px-3 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors text-sm"
            >
              <XMarkIcon className="w-4 h-4 mr-1" />
              {t('consultation.cancelConsultation')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          {isInProgress ? (
            <div ref={jitsiContainerRef} className="flex-1 bg-gray-900" />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
              {isCreated || isInvitedStatus || isScheduled ? (
                <>
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <VideoCameraIcon className="w-12 h-12 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('consultation.readyToStart')}</h2>
                  <p className="text-gray-500 mb-6">{t('consultation.readyToStartDesc')}</p>
                  {!isInvited && (
                    <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_JOIN]}>
                      <button
                        onClick={handleStartConsultation}
                        className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-lg"
                      >
                        <PlayIcon className="w-5 h-5 mr-2" />
                        {t('consultation.startConsultation')}
                      </button>
                    </PermissionGuard>
                  )}
                  {isInvited && (
                    <div className="flex items-center space-x-3 mt-2">
                      <button
                        onClick={() => respondMutation.mutate({ userId: currentUser!.id, status: 'ACCEPTED' })}
                        className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 text-sm"
                      >
                        <CheckIcon className="w-4 h-4 mr-1" />
                        {t('consultation.acceptInvitation')}
                      </button>
                      <button
                        onClick={() => respondMutation.mutate({ userId: currentUser!.id, status: 'DECLINED' })}
                        className="inline-flex items-center px-5 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 text-sm"
                      >
                        <XMarkIcon className="w-4 h-4 mr-1" />
                        {t('consultation.declineInvitation')}
                      </button>
                    </div>
                  )}
                </>
              ) : consultation.status === 'COMPLETED' ? (
                <>
                  <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <StopIcon className="w-12 h-12 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('consultation.consultationCompleted')}</h2>
                  <p className="text-gray-500">{t('consultation.completedAt')}: {formatDateTime(consultation.endedAt)}</p>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6">
                    <XMarkIcon className="w-12 h-12 text-red-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('consultation.consultationCancelled')}</h2>
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveRightTab('info')}
              className={`flex-1 py-2.5 text-sm font-medium text-center ${
                activeRightTab === 'info' ? 'text-primary-600 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('consultation.info')}
            </button>
            <button
              onClick={() => setActiveRightTab('chat')}
              className={`flex-1 py-2.5 text-sm font-medium text-center ${
                activeRightTab === 'chat' ? 'text-primary-600 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('consultation.chat')}
            </button>
          </div>

          {activeRightTab === 'info' ? (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <UserIcon className="w-4 h-4 mr-1.5" />
                  {t('consultation.patientInfo')}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{t('consultation.patientName')}</span>
                    <span className="text-sm font-medium text-gray-900">{consultation.patient.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{t('consultation.patientId')}</span>
                    <span className="text-sm text-primary-600">{consultation.patient.patientId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{t('consultation.createdAt')}</span>
                    <span className="text-sm text-gray-600">{formatDateTime(consultation.createdAt)}</span>
                  </div>
                  {consultation.startedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{t('consultation.startedAt')}</span>
                      <span className="text-sm text-gray-600">{formatDateTime(consultation.startedAt)}</span>
                    </div>
                  )}
                  {consultation.endedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{t('consultation.endedAt')}</span>
                      <span className="text-sm text-gray-600">{formatDateTime(consultation.endedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {consultation.study && (
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <ClipboardDocumentListIcon className="w-4 h-4 mr-1.5" />
                    {t('consultation.relatedStudy')}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{t('study.modality')}</span>
                      <span className="text-sm text-gray-900">{consultation.study.modality || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{t('study.description')}</span>
                      <span className="text-sm text-gray-600">{consultation.study.studyDescription || '-'}</span>
                    </div>
                  </div>
                  <a
                    href={`/ohif/viewer?StudyInstanceUIDs=${consultation.study.orthancStudyId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center w-full justify-center px-3 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                  >
                    <EyeIcon className="w-4 h-4 mr-1.5" />
                    {t('consultation.viewStudy')}
                  </a>
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                    <UserGroupIcon className="w-4 h-4 mr-1.5" />
                    {t('consultation.participants')} ({consultation.participants?.length || 0})
                  </h3>
                  {isActive && (isInitiator || currentUser?.role === 'ADMIN' || currentUser?.role === 'ADMIN') && (
                    <button
                      onClick={() => setAddParticipantOpen(true)}
                      className="p-1 rounded hover:bg-gray-100 text-primary-600"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {consultation.participants?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-primary-700">
                              {(p.user.realName || p.user.username).charAt(0)}
                            </span>
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${getStatusDotColor(p.status)}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.user.realName || p.user.username}</p>
                          <p className="text-xs text-gray-500">
                            {getRoleLabel(p.role)} · {getParticipantStatusLabel(p.status)}
                          </p>
                        </div>
                      </div>
                      {isActive && p.userId !== currentUser?.id && isInitiator && p.role !== 'INITIATOR' && (
                        <button
                          onClick={() => removeParticipantMutation.mutate(p.userId)}
                          className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 flex-shrink-0"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {consultation.messages?.map((msg) => {
                  const isMine = msg.userId === currentUser?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        isMine ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-900'
                      }`}>
                        {!isMine && (
                          <p className={`text-xs font-medium mb-0.5 ${isMine ? 'text-primary-200' : 'text-gray-500'}`}>
                            {msg.user.realName || msg.user.username}
                          </p>
                        )}
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-primary-200' : 'text-gray-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={t('consultation.typeMessage')}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={addParticipantOpen}
        onClose={() => { setAddParticipantOpen(false); setSelectedUserIds([]); setSelectedRoles({}); }}
        title={t('consultation.addParticipants')}
        size="md"
      >
        <div className="space-y-4">
          <div className="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto space-y-2">
            {availableUsers && availableUsers.length > 0 ? (
              availableUsers.map((u) => {
                const selected = selectedUserIds.includes(u.id);
                return (
                  <div key={u.id} className="flex items-center justify-between p-1.5 rounded hover:bg-gray-50">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleUserSelection(u.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{u.realName} ({u.username})</span>
                    </label>
                    {selected && (
                      <select
                        value={selectedRoles[u.id] || 'EXPERT'}
                        onChange={(e) => setSelectedRoles({ ...selectedRoles, [u.id]: e.target.value })}
                        className="text-xs border rounded px-1.5 py-0.5"
                      >
                        <option value="EXPERT">{t('consultation.expert')}</option>
                        <option value="OBSERVER">{t('consultation.observer')}</option>
                      </select>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">{t('consultation.noAvailableUsers')}</p>
            )}
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => { setAddParticipantOpen(false); setSelectedUserIds([]); setSelectedRoles({}); }}
              className="btn-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleInviteParticipants}
              disabled={selectedUserIds.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              {t('consultation.inviteSelected')} ({selectedUserIds.length})
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ConsultationDetail;
