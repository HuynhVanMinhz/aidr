import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AuthState = {
  accessToken: string | null;
  roles: string[];
  isAuthenticated: boolean;
};

const initialState: AuthState = {
  accessToken: null,
  roles: [],
  isAuthenticated: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ accessToken: string; roles: string[] }>) {
      state.accessToken = action.payload.accessToken;
      state.roles = action.payload.roles;
      state.isAuthenticated = true;
    },
    clearCredentials(state) {
      state.accessToken = null;
      state.roles = [];
      state.isAuthenticated = false;
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
