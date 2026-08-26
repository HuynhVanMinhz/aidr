import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { useNotifications, useUnreadNotifications } from '../../hooks/useNotifications';
import {
  formatNotificationTime,
  getNotificationHref,
} from '../../utils/notificationUi';

type Props = {
  loginReturnTo?: string;
  isAuthenticated: boolean;
};

export function StoreNotificationDropdown({
  isAuthenticated,
  loginReturnTo = '/account/notifications',
}: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { unreadCount, previewItems } = useUnreadNotifications({
    autoLoad: isAuthenticated,
  });
  const { markAllRead, markRead, getErrorMessage } = useNotifications(undefined, {
    autoLoad: false,
  });

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.store-header-dropdown--notifications')) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  if (!isAuthenticated) {
    return (
      <Link
        to={`/login?returnUrl=${encodeURIComponent(loginReturnTo)}`}
        className="store-header-icon-btn"
        aria-label="Notifications"
        title="Notifications"
      >
        <span className="store-header-icon-wrap">
          <i className="fa-regular fa-bell" aria-hidden="true" />
        </span>
      </Link>
    );
  }

  async function handleClearAll() {
    try {
      await markAllRead();
      toast.success('All notifications marked as read.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to mark all notifications as read.'));
    }
  }

  return (
    <div className={`store-header-dropdown store-header-dropdown--notifications${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="store-header-icon-btn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Notifications"
        title="Notifications"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="store-header-icon-wrap">
          <i className="fa-regular fa-bell" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="store-header-badge" aria-label={`${unreadCount} unread notifications`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div className="store-header-dropdown-panel" role="menu">
          <div className="store-header-dropdown-head">
            <strong>Notifications</strong>
            <button
              type="button"
              className="store-header-dropdown-link-btn"
              disabled={unreadCount === 0}
              onClick={() => void handleClearAll()}
            >
              Mark all read
            </button>
          </div>

          <div className="store-header-dropdown-body">
            {previewItems.length === 0 ? (
              <p className="store-header-dropdown-empty">No notifications yet.</p>
            ) : (
              previewItems.map((item) => {
                const href = getNotificationHref(item, 'buyer') ?? '/account/notifications';
                return (
                  <Link
                    key={item.notificationId}
                    to={href}
                    className={`store-header-dropdown-item${item.isRead ? '' : ' is-unread'}`}
                    onClick={() => {
                      setOpen(false);
                      if (!item.isRead) {
                        void markRead(item.notificationId).catch(() => undefined);
                      }
                    }}
                  >
                    <span className="store-header-dropdown-item-title">{item.title}</span>
                    <span className="store-header-dropdown-item-body">{item.body}</span>
                    <span className="store-header-dropdown-item-time">
                      {formatNotificationTime(item.createdAt)}
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          <div className="store-header-dropdown-foot">
            <Link to="/account/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
