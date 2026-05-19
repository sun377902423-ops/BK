import { useState, useCallback, useEffect, createContext, useContext, createElement, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  username: string;
  realName: string;
  email: string;
  avatarUrl?: string;
  role?: { id: number; name: string } | string;
  hospitalId?: number;
  permissions?: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredUser(): User | null {
  const storedUser = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  if (!storedUser || !token) return null;
  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setUser(readStoredUser());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'user' || e.key === null) {
        setUser(readStoredUser());
      }
    };
    const handleAuthExpired = () => {
      setUser(null);
      navigate('/login', { replace: true });
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('auth:expired', handleAuthExpired as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth:expired', handleAuthExpired as EventListener);
    };
  }, [navigate]);

  const login = useCallback((token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...patch };
      try {
        localStorage.setItem('user', JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }, []);

  const hasPermission = useCallback((permission: string) => {
    if (!user) return false;
    const roleName = typeof user.role === 'string' ? user.role : user.role?.name;
    if (roleName === 'ADMIN') return true;
    return user.permissions?.includes(permission) ?? false;
  }, [user]);

  const hasAnyPermission = useCallback((...permissions: string[]) => {
    if (!user) return false;
    const roleName = typeof user.role === 'string' ? user.role : user.role?.name;
    if (roleName === 'ADMIN') return true;
    return permissions.some(p => user.permissions?.includes(p) ?? false);
  }, [user]);

  const value: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
    hasPermission,
    hasAnyPermission,
  };

  return createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;
