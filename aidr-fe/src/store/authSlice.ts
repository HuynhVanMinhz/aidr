import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthTokenPayload, AuthUser } from '../types/auth';
import { clearPersistedAuth, loadPersistedAuth, savePersistedAuth } from '../utils/authStorage';

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  roles: string[];
  user: AuthUser | null;
  isAuthenticated: boolean;
};

const persisted = loadPersistedAuth();

const initialState: AuthState = persisted
  ? {
      accessToken: persisted.accessToken,
      refreshToken: persisted.refreshToken,
      roles: persisted.roles,
      user: persisted.user,
      isAuthenticated: true,
    }
  : {
      accessToken: null,
      refreshToken: null,
      roles: [],
      user: null,
      isAuthenticated: false,
    };

function mapSession(payload: AuthTokenPayload): Pick<AuthState, 'accessToken' | 'refreshToken' | 'roles' | 'user' | 'isAuthenticated'> {
  const user: AuthUser = {
    userId: payload.user.userId,
    email: payload.user.email,
    fullName: payload.user.fullName,
    roles: payload.user.roles,
  };

  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    roles: payload.user.roles,
    user,
    isAuthenticated: true,
  };
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<AuthTokenPayload>) {
      Object.assign(state, mapSession(action.payload));
      savePersistedAuth({
        accessToken: state.accessToken!,
        refreshToken: state.refreshToken!,
        roles: state.roles,
        user: state.user!,
      });
    },
    clearSession(state) {
      state.accessToken = null;
      state.refreshToken = null;
      state.roles = [];
      state.user = null;
      state.isAuthenticated = false;
      clearPersistedAuth();
    },
    patchAuthUser(state, action: PayloadAction<Partial<Pick<AuthUser, 'fullName' | 'email'>>>) {
      if (!state.user) return;
      Object.assign(state.user, action.payload);
      if (state.accessToken && state.refreshToken) {
        savePersistedAuth({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          roles: state.roles,
          user: state.user,
        });
      }
    },
  },
});

export const { setSession, clearSession, patchAuthUser } = authSlice.actions;

export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectHasRole = (role: string) => (state: { auth: AuthState }) =>
  state.auth.roles.some((r) => r.toUpperCase() === role.toUpperCase());
