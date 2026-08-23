import type { AuthUser } from '../types/auth';

const STORAGE_KEY = 'aidr_auth';

export type PersistedAuth = {
  accessToken: string;
  refreshToken: string;
  roles: string[];
  user: AuthUser;
};

export function loadPersistedAuth(): PersistedAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAuth;
    if (!parsed.accessToken || !parsed.user?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedAuth(auth: PersistedAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearPersistedAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}
