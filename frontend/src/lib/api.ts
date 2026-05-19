import axios, { AxiosError } from 'axios';

const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNative;

const nativeBase = (import.meta as any).env?.VITE_NATIVE_API_BASE_URL || '';

const api = axios.create({
  baseURL: isNative ? nativeBase : '',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isHandlingAuthFailure = false;

function handleAuthFailure() {
  if (isHandlingAuthFailure) return;
  isHandlingAuthFailure = true;
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('auth:expired'));
  } finally {
    setTimeout(() => {
      isHandlingAuthFailure = false;
    }, 500);
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401) {
      const requestUrl = (error.config?.url || '');
      const isLoginRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
      if (!isLoginRequest) {
        handleAuthFailure();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
