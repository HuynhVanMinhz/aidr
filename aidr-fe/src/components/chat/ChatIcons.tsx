/**
 * Inline SVG icons — the storefront ships Font Awesome while the admin shell ships Boxicons,
 * so the shared chat workspace carries its own icons instead of guessing which font is loaded.
 */
type IconProps = { className?: string };

function icon(path: React.ReactNode, extra?: { fill?: boolean }) {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        className={`chat-icon${className ? ` ${className}` : ''}`}
        viewBox="0 0 24 24"
        fill={extra?.fill ? 'currentColor' : 'none'}
        stroke={extra?.fill ? 'none' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {path}
      </svg>
    );
  };
}

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </>,
);

export const CloseIcon = icon(
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);

export const BackIcon = icon(
  <>
    <path d="M15 18 9 12l6-6" />
  </>,
);

export const SendIcon = icon(<path d="M4.5 12 20 4l-4 16-4.5-6.5L4.5 12Z" />, { fill: true });

export const PaperclipIcon = icon(
  <path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.6-2.6l7.3-7.3" />,
);

export const CheckIcon = icon(<path d="m5 13 4 4L19 7" />);

export const DoubleCheckIcon = icon(
  <>
    <path d="m2 13 4 4 8-9" />
    <path d="m11 15 1.5 1.5L22 7" />
  </>,
);

export const RefreshIcon = icon(
  <>
    <path d="M20 11a8 8 0 1 0-.6 4" />
    <path d="M20 4v7h-7" />
  </>,
);

export const ChatBubbleIcon = icon(
  <>
    <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8Z" />
    <path d="M9 11h6" />
    <path d="M9 15h4" />
  </>,
);

export const TagIcon = icon(
  <>
    <path d="M3 11V4h7l11 11-7 7L3 11Z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </>,
);

export const ImageIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m4 17 5-5 4 4 2.5-2.5L20 17" />
  </>,
);
