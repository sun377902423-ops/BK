import clsx from 'clsx';

interface StatusBadgeProps {
  status: string;
  type: 'consultation' | 'report' | 'user' | 'order';
}

const consultationMap: Record<string, { label: string; className: string }> = {
  CREATED: { label: '已创建', className: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: '进行中', className: 'bg-green-100 text-green-800' },
  COMPLETED: { label: '已完成', className: 'bg-gray-100 text-gray-800' },
  CANCELLED: { label: '已取消', className: 'bg-red-100 text-red-800' },
};

const reportMap: Record<string, { label: string; className: string }> = {
  DRAFT: { label: '草稿', className: 'bg-yellow-100 text-yellow-800' },
  SUBMITTED: { label: '已提交', className: 'bg-blue-100 text-blue-800' },
  APPROVED: { label: '已审核', className: 'bg-green-100 text-green-800' },
  ARCHIVED: { label: '已归档', className: 'bg-gray-100 text-gray-800' },
};

const userMap: Record<string, { label: string; className: string }> = {
  active: { label: '正常', className: 'bg-green-100 text-green-800' },
  inactive: { label: '停用', className: 'bg-red-100 text-red-800' },
};

const orderMap: Record<string, { label: string; className: string }> = {
  PENDING: { label: '待处理', className: 'bg-yellow-100 text-yellow-800' },
  IN_PROGRESS: { label: '进行中', className: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: '已完成', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: '已取消', className: 'bg-red-100 text-red-800' },
};

const typeMap = {
  consultation: consultationMap,
  report: reportMap,
  user: userMap,
  order: orderMap,
};

export default function StatusBadge({ status, type }: StatusBadgeProps) {
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
