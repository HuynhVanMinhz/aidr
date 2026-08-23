import { selectThemeMode, setTheme, toggleTheme } from '../store/themeSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { ThemeMode } from '../utils/themeStorage';

export function useTheme() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector(selectThemeMode);

  return {
    mode,
    isDark: mode === 'dark',
    setTheme: (next: ThemeMode) => dispatch(setTheme(next)),
    toggleTheme: () => dispatch(toggleTheme()),
  };
}
