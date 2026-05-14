import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LiveKitRoom,
  VideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
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
  ArchiveBoxIcon,
  PhotoIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PermissionGuard from '@/components/ui/PermissionGuard';
import UserAvatar from '@/components/ui/UserAvatar';

interface Participant {
  id: number;
  userId: number;
  role: string;
  status: string;
  invitedAt: string;
  respondedAt: string | null;
  joinedAt: string | null;
  user: { id: number; realName: string; username: string; avatarUrl?: string; role?: { name: string; displayName: string } };
}

interface Message {
  id: number;
  userId: number;
  content: string;
  type: string;
  createdAt: string;
  user: { id: number; realName: string; username: string; avatarUrl?: string };
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
  archivedAt: string | null;
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

const LIVEKIT_SERVER = (window as any).__LIVEKIT_SERVER__ || window.location.host;

const ConsultationDetail: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [messageInput, setMessageInput] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'info' | 'chat'>('info');
  const [errorMessage, setErrorMessage] = useState('');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerExpanded, setImageViewerExpanded] = useState(false);
  const [videoToken, setVideoToken] = useState('');
  const [videoConnecting, setVideoConnecting] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [videoConnected, setVideoConnected] = useState(false);
  const videoTokenRef = useRef('');

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
      setErrorMessage('');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || t('common.submit') + ' ' + t('common.cancel');
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 5000);
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

  const fetchVideoToken = useCallback(async () => {
    if (!currentUser) return;
    try {
      setVideoConnecting(true);
      setVideoError('');
      setVideoConnected(false);
      const res = await api.get(`/api/consultations/${id}/video-token`);
      const token = res.data.token;
      videoTokenRef.current = token;
      setVideoToken(token);
    } catch (e) {
      setVideoError(t('consultation.videoConnectFailed'));
      setVideoConnecting(false);
    }
  }, [currentUser, t, id]);

  useEffect(() => {
    if (consultation?.status === 'IN_PROGRESS' && !videoTokenRef.current) {
      fetchVideoToken();
    } else if (consultation?.status !== 'IN_PROGRESS') {
      videoTokenRef.current = '';
      setVideoToken('');
      setVideoConnecting(false);
      setVideoError('');
      setVideoConnected(false);
    }
  }, [consultation?.status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consultation?.messages]);

  const handleStartConsultation = () => {
    statusMutation.mutate({ status: 'IN_PROGRESS' });
  };

  const handleEndConsultation = () => {
    if (currentUser?.id) {
      api.put(`/api/consultations/${id}/participants/${currentUser.id}/leave`).catch(() => {});
    }
    videoTokenRef.current = '';
    setVideoToken('');
    setVideoConnected(false);
    statusMutation.mutate({ status: 'COMPLETED' });
  };

  const handleCancelConsultation = () => {
    if (currentUser?.id) {
      api.put(`/api/consultations/${id}/participants/${currentUser.id}/leave`).catch(() => {});
    }
    videoTokenRef.current = '';
    setVideoToken('');
    setVideoConnected(false);
    statusMutation.mutate({ status: 'CANCELLED' });
  };

  const handleArchiveConsultation = () => {
    statusMutation.mutate({ status: 'ARCHIVED' });
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
  const isCompleted = consultation?.status === 'COMPLETED';
  const isCancelled = consultation?.status === 'CANCELLED';
  const isArchived = consultation?.status === 'ARCHIVED';
  const canArchive = (isCompleted || isCancelled) && isInitiator;
  const hasStudy = !!consultation?.study;

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

  const ohifUrl = consultation.study
    ? `/ohif/viewer/${consultation.study.orthancStudyId}`
    : '';

  const renderVideoArea = () => (
    <div className="flex-1 relative bg-gray-900">
      {videoToken ? (
        <LiveKitRoom
          token={videoToken}
          serverUrl={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${LIVEKIT_SERVER}/livekit`}
          connect={true}
          audio={true}
          video={true}
          onConnected={() => {
            setVideoConnecting(false);
            setVideoError('');
            setVideoConnected(true);
            if (currentUser?.id) {
              api.put(`/api/consultations/${id}/participants/${currentUser.id}/join`).catch(() => {});
            }
            queryClient.invalidateQueries({ queryKey: ['consultation', id] });
          }}
          onDisconnected={() => {
            setVideoConnecting(false);
            setVideoConnected(false);
            if (currentUser?.id) {
              api.put(`/api/consultations/${id}/participants/${currentUser.id}/leave`).catch(() => {});
            }
            queryClient.invalidateQueries({ queryKey: ['consultation', id] });
          }}
          onError={(error) => {
            console.error('LiveKit connection error:', error);
            if (!videoConnected) {
              setVideoError(t('consultation.videoConnectFailed'));
            }
            setVideoConnecting(false);
          }}
          data-lk-theme="default"
          style={{ height: '100%' }}
        >
          <VideoConference />
        </LiveKitRoom>
      ) : null}
      {videoConnecting && !videoConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4" />
          <p className="text-gray-300">{t('consultation.videoConnecting')}</p>
        </div>
      )}
      {videoError && !videoConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-10">
          <VideoCameraIcon className="w-16 h-16 text-gray-500 mb-4" />
          <p className="text-red-400 mb-2">{videoError}</p>
          <button
            onClick={() => {
              videoTokenRef.current = '';
              setVideoToken('');
              setVideoError('');
              fetchVideoToken();
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            {t('consultation.retryVideo')}
          </button>
        </div>
      )}
    </div>
  );

  const renderImageViewer = () => (
    <div className="flex-1 relative bg-black flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <PhotoIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">{t('consultation.imageViewer')}</span>
        </div>
        <div className="flex items-center space-x-1">
          {isInProgress && (
            <button
              onClick={() => setImageViewerExpanded(!imageViewerExpanded)}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
              title={imageViewerExpanded ? t('consultation.collapse') : t('consultation.expand')}
            >
              {imageViewerExpanded
                ? <ArrowsPointingInIcon className="w-4 h-4" />
                : <ArrowsPointingOutIcon className="w-4 h-4" />
              }
            </button>
          )}
          <button
            onClick={() => setShowImageViewer(false)}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <iframe
        src={ohifUrl}
        className="flex-1 w-full border-0"
        title="OHIF Viewer"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );

  const renderMainContent = () => {
    if (isInProgress) {
      return (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className={`flex-1 flex flex-col min-h-0 ${showImageViewer && !imageViewerExpanded ? 'lg:w-1/2' : ''}`}>
            {renderVideoArea()}
          </div>
          {showImageViewer && hasStudy && !imageViewerExpanded && (
            <div className="lg:w-1/2 flex flex-col border-l border-gray-700 min-h-0">
              {renderImageViewer()}
            </div>
          )}
          {showImageViewer && hasStudy && imageViewerExpanded && (
            <div className="fixed inset-0 z-50 bg-black">
              {renderImageViewer()}
            </div>
          )}
        </div>
      );
    }

    if (hasStudy && (isCreated || isInvitedStatus || isScheduled)) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          {showImageViewer ? (
            renderImageViewer()
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
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
            </div>
          )}
        </div>
      );
    }

    return (
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
        ) : isCompleted ? (
          <>
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <StopIcon className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('consultation.consultationCompleted')}</h2>
            <p className="text-gray-500">{t('consultation.completedAt')}: {formatDateTime(consultation.endedAt)}</p>
            {canArchive && (
              <button
                onClick={handleArchiveConsultation}
                className="mt-6 inline-flex items-center px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors text-lg"
              >
                <ArchiveBoxIcon className="w-5 h-5 mr-2" />
                {t('consultation.archiveConsultation')}
              </button>
            )}
          </>
        ) : isCancelled ? (
          <>
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <XMarkIcon className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('consultation.consultationCancelled')}</h2>
            {canArchive && (
              <button
                onClick={handleArchiveConsultation}
                className="mt-6 inline-flex items-center px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors text-lg"
              >
                <ArchiveBoxIcon className="w-5 h-5 mr-2" />
                {t('consultation.archiveConsultation')}
              </button>
            )}
          </>
        ) : isArchived ? (
          <>
            <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-6">
              <ArchiveBoxIcon className="w-12 h-12 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('consultation.consultationArchived')}</h2>
            <p className="text-gray-500">{t('consultation.archivedAt')}: {formatDateTime(consultation.archivedAt)}</p>
          </>
        ) : null}
      </div>
    );
  };

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
          {hasStudy && isInProgress && (
            <button
              onClick={() => setShowImageViewer(!showImageViewer)}
              className={`inline-flex items-center px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                showImageViewer
                  ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <PhotoIcon className="w-4 h-4 mr-1.5" />
              {showImageViewer ? t('consultation.hideImageViewer') : t('consultation.showImageViewer')}
            </button>
          )}
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
          {canArchive && (
            <button
              onClick={handleArchiveConsultation}
              className="inline-flex items-center px-3 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm"
            >
              <ArchiveBoxIcon className="w-4 h-4 mr-1" />
              {t('consultation.archiveConsultation')}
            </button>
          )}
        </div>
      </div>
      {errorMessage && (
        <div className="mx-4 mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-red-500 hover:text-red-700">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          {renderMainContent()}
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
                  {consultation.archivedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{t('consultation.archivedAt')}</span>
                      <span className="text-sm text-gray-600">{formatDateTime(consultation.archivedAt)}</span>
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
                  <button
                    onClick={() => setShowImageViewer(true)}
                    className="mt-3 inline-flex items-center w-full justify-center px-3 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                  >
                    <EyeIcon className="w-4 h-4 mr-1.5" />
                    {t('consultation.viewStudyInline')}
                  </button>
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                    <UserGroupIcon className="w-4 h-4 mr-1.5" />
                    {t('consultation.participants')} ({consultation.participants?.length || 0})
                  </h3>
                  {isActive && (isInitiator || currentUser?.role === 'ADMIN') && (
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
                          <UserAvatar
                            src={p.user.avatarUrl}
                            name={p.user.realName || p.user.username}
                            size="sm"
                            showStatus
                            statusColor={getStatusDotColor(p.status)}
                          />
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
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end space-x-2`}>
                      {!isMine && (
                        <UserAvatar
                          src={msg.user.avatarUrl}
                          name={msg.user.realName || msg.user.username}
                          size="xs"
                          className="flex-shrink-0"
                        />
                      )}
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
                      {isMine && (
                        <UserAvatar
                          src={currentUser?.avatarUrl}
                          name={currentUser?.realName || currentUser?.username || ''}
                          size="xs"
                          className="flex-shrink-0"
                        />
                      )}
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
