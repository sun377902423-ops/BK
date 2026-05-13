import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

interface StatusBadgeProps {
  status: string;
  type: 'consultation' | 'report' | 'user' | 'order';
}

export default function StatusBadge({ status, type }: StatusBadgeProps) {
  const { t } = useTranslation();

  const consultationMap: Record<string, { label: string; className: string }> = {
    CREATED: { label: t('status.created'), className: 'bg-blue-100 text-blue-800' },
    INVITED: { label: t('status.invited'), className: 'bg-yellow-100 text-yellow-800' },
    SCHEDULED: { label: t('status.scheduled'), className: 'bg-purple-100 text-purple-800' },
    IN_PROGRESS: { label: t('status.inProgress'), className: 'bg-green-100 text-green-800' },
    COMPLETED: { label: t('status.completed'), className: 'bg-gray-100 text-gray-800' },
    CANCELLED: { label: t('status.cancelled'), className: 'bg-red-100 text-red-800' },
  };

  const reportMap: Record<string, { label: string; className: string }> = {
    DRAFT: { label: t('status.draft'), className: 'bg-yellow-100 text-yellow-800' },
    SUBMITTED: { label: t('status.submitted'), className: 'bg-blue-100 text-blue-800' },
    APPROVED: { label: t('status.approved'), className: 'bg-green-100 text-green-800' },
    ARCHIVED: { label: t('status.archived'), className: 'bg-gray-100 text-gray-800' },
  };

  const userMap: Record<string, { label: string; className: string }> = {
    active: { label: t('status.active'), className: 'bg-green-100 text-green-800' },
    inactive: { label: t('status.inactive'), className: 'bg-red-100 text-red-800' },
  };

  const orderMap: Record<string, { label: string; className: string }> = {
    PENDING: { label: t('status.pending'), className: 'bg-yellow-100 text-yellow-800' },
    IN_PROGRESS: { label: t('status.inProgress'), className: 'bg-blue-100 text-blue-800' },
    COMPLETED: { label: t('status.completed'), className: 'bg-green-100 text-green-800' },
    CANCELLED: { label: t('status.cancelled'), className: 'bg-red-100 text-red-800' },
  };

  const typeMap = {
    consultation: consultationMap,
    report: reportMap,
    user: userMap,
    order: orderMap,
  };

  const map = typeMap[type];
  const entry = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        entry.className
      )}
    >
      {entry.label}
    </span>
  );
}
