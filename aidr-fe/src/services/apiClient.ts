import axios from 'axios';
import { clearSession } from '../store/authSlice';

type StoreLike = {
  getState: () => { auth: { accessToken: string | null } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: (action: any) => unknown;
};

/** Attached from main.tsx after store creation - avoids circular import with slices. */
let appStore: StoreLike | null = null;

export function attachStore(store: StoreLike) {
  appStore = store;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = appStore?.getState().auth.accessToken;
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
        appStore?.dispatch(clearSession());
        const returnUrl = encodeURIComponent(path + window.location.search);
        if (!path.startsWith('/login')) {
          window.location.assign(`/login?returnUrl=${returnUrl}`);
        }
      }
    }
    return Promise.reject(error);
  },
);
