import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  signalRHubUrl: import.meta.env.VITE_SIGNALR_HUB_URL || '/hubs',
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {},
});
