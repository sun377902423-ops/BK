import React from 'react';
import { useAuth } from '../../hooks/useAuth';

interface PermissionGuardProps {
  permissions: string[];
  mode?: 'any' | 'all';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permissions,
  mode = 'any',
  children,
  fallback = null,
}) => {
  const { hasPermission, hasAnyPermission } = useAuth();

  const authorized = mode === 'all'
    ? permissions.every(hasPermission)
    : hasAnyPermission(...permissions);

  return authorized ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGuard;
