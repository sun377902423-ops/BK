import React from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showStatus?: boolean;
  statusColor?: string;
}

const sizeClasses: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-2xl',
};

const statusSizeClasses: Record<string, string> = {
  xs: 'w-2 h-2 border',
  sm: 'w-2.5 h-2.5 border-2',
  md: 'w-3 h-3 border-2',
  lg: 'w-4 h-4 border-2',
};

const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name = '?',
  size = 'sm',
  className = '',
  showStatus = false,
  statusColor,
}) => {
  const avatarSrc = src
    ? (src.startsWith('http') ? src : `${window.location.origin}${src}`)
    : null;

  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200`}
          loading="lazy"
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full bg-primary-100 flex items-center justify-center border border-primary-200`}
        >
          <span className="font-medium text-primary-700">{initial}</span>
        </div>
      )}
      {showStatus && statusColor && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 ${statusSizeClasses[size]} rounded-full border-white ${statusColor}`}
        />
      )}
    </div>
  );
};

export default UserAvatar;
