import { useTheme } from '../hooks/useTheme';

type ThemeToggleProps = {
  className?: string;
  /** Header icon style — no text label */
  iconOnly?: boolean;
};

export function ThemeToggle({ className = '', iconOnly = false }: ThemeToggleProps) {
  const { mode, toggleTheme } = useTheme();
  const isDark = mode === 'dark';

  if (iconOnly) {
    return (
      <button
        type="button"
        className={`theme-toggle theme-toggle--icon ${className}`.trim()}
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Light theme' : 'Dark theme'}
      >
        <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? '☀' : '☾'}
      </span>
      <span className="theme-toggle__label">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
