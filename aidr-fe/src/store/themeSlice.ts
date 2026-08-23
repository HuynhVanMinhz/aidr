import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  applyThemeToDocument,
  getInitialTheme,
  saveTheme,
  type ThemeMode,
} from '../utils/themeStorage';

type ThemeState = {
  mode: ThemeMode;
};

const initialState: ThemeState = {
  mode: typeof document !== 'undefined' ? getInitialTheme() : 'light',
};

export const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
      saveTheme(action.payload);
      applyThemeToDocument(action.payload);
    },
    toggleTheme(state) {
      const next: ThemeMode = state.mode === 'light' ? 'dark' : 'light';
      state.mode = next;
      saveTheme(next);
      applyThemeToDocument(next);
    },
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export const selectThemeMode = (state: { theme: ThemeState }) => state.theme.mode;
