import axios from 'axios';
import { store } from '../store';
import { clearSession } from '../store/authSlice';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      const path = window.location.pathname;
      const isAuthEndpoint =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/google');
      const isOAuthCallback = path.startsWith('/auth/callback');

      if (!isAuthEndpoint && !isOAuthCallback) {
        store.dispatch(clearSession());
        const returnUrl = encodeURIComponent(path + window.location.search);
        if (!path.startsWith('/login')) {
          window.location.assign(`/login?returnUrl=${returnUrl}`);
        }
      }
    }
    return Promise.reject(error);
  },
);
