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
        aria-label={isDark ? 'Bật giao diện sáng' : 'Bật giao diện tối'}
        title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
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
      aria-label={isDark ? 'Bật giao diện sáng' : 'Bật giao diện tối'}
      title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? '☀' : '☾'}
      </span>
      <span className="theme-toggle__label">{isDark ? 'Sáng' : 'Tối'}</span>
    </button>
  );
}
