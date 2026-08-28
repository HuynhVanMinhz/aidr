import { useEffect, useState } from 'react';
import { avatarHue, avatarInitial } from '../../utils/chatUi';

type ChatAvatarProps = {
  name: string;
  src?: string | null;
  size?: number;
  /** Renders the small presence/context dot in the corner. */
  badge?: 'none' | 'online';
  className?: string;
};

/**
 * Avatar that degrades to coloured initials whenever the image is missing, blank or fails to
 * load — a broken <img> icon is the most visible defect in a conversation list.
 */
export function ChatAvatar({
  name,
  src,
  size = 44,
  badge = 'none',
  className,
}: ChatAvatarProps) {
  const trimmed = src?.trim() || null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [trimmed]);

  const hue = avatarHue(name || 'aidr');
  const style = {
    '--chat-avatar-size': `${size}px`,
    '--chat-avatar-hue': String(hue),
  } as React.CSSProperties;

  return (
    <span
      className={`chat-avatar${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
    >
      {trimmed && !failed ? (
        <img
          className="chat-avatar__img"
          src={trimmed}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="chat-avatar__initial">{avatarInitial(name)}</span>
      )}
      {badge === 'online' ? <span className="chat-avatar__dot" /> : null}
    </span>
  );
}
