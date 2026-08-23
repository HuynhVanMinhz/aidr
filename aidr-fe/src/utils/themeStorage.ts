export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'aidr_theme';

export function getStoredTheme(): ThemeMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function saveTheme(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function applyThemeToDocument(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.style.colorScheme = mode;
}

export function getInitialTheme(): ThemeMode {
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
