import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconifyIcon } from '../admin/IconifyIcon';
import { useToast } from '../../hooks/useToast';
import { useNotifications, useUnreadNotifications } from '../../hooks/useNotifications';
import {
  formatNotificationTime,
  getNotificationHref,
  notificationTypeLabel,
} from '../../utils/notificationUi';

type AdminNotificationDropdownProps = {
  inboxPath: string;
};

export function AdminNotificationDropdown({ inboxPath }: AdminNotificationDropdownProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { unreadCount, previewItems } = useUnreadNotifications({ autoLoad: true });
  const { markAllRead, markRead, getErrorMessage } = useNotifications(undefined, { autoLoad: false });

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.aidr-notification-dropdown')) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  async function handleClearAll() {
    try {
      await markAllRead();
      toast.success('All notifications marked as read.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to mark all notifications as read.'));
    }
  }

  return (
    <div className={`dropdown topbar-item aidr-notification-dropdown ${open ? 'show' : ''}`}>
      <button
        type="button"
        className="topbar-button position-relative"
        aria-expanded={open}
        aria-label="Notifications"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <IconifyIcon icon="solar:bell-bing-bold-duotone" className="fs-24 align-middle" />
        {unreadCount > 0 ? (
          <span className="position-absolute topbar-badge fs-10 translate-middle badge bg-danger rounded-pill">
            {unreadCount > 99 ? '99+' : unreadCount}
            <span className="visually-hidden">unread notifications</span>
          </span>
        ) : null}
      </button>

      <div
        className={`dropdown-menu py-0 dropdown-lg dropdown-menu-end ${open ? 'show' : ''}`}
        style={{ minWidth: 320 }}
      >
        <div className="p-3 border-top-0 border-start-0 border-end-0 border-dashed border">
          <div className="row align-items-center">
            <div className="col">
              <h6 className="m-0 fs-16 fw-semibold">Notifications</h6>
            </div>
            <div className="col-auto">
              <button
                type="button"
                className="btn btn-link text-dark text-decoration-underline p-0"
                disabled={unreadCount === 0}
                onClick={() => void handleClearAll()}
              >
                <small>Mark all read</small>
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {previewItems.length === 0 ? (
            <p className="text-muted text-center py-4 mb-0">No notifications yet.</p>
          ) : (
            previewItems.map((item) => {
              const href = getNotificationHref(item, 'seller') ?? inboxPath;
              return (
                <Link
                  key={item.notificationId}
                  to={href}
                  className="dropdown-item py-3 border-bottom text-wrap"
                  onClick={() => {
                    setOpen(false);
                    if (!item.isRead) {
                      void markRead(item.notificationId).catch(() => undefined);
                    }
                  }}
                >
                  <div className="d-flex">
                    <div className="flex-shrink-0">
                      <div className="avatar-sm me-2">
                        <span className="avatar-title bg-soft-primary text-primary fs-20 rounded-circle">
                          {notificationTypeLabel(item.type).charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <p className={`mb-0 ${item.isRead ? '' : 'fw-semibold'}`}>{item.title}</p>
                      <p className="mb-0 text-muted text-wrap">{item.body}</p>
                      <small className="text-muted">{formatNotificationTime(item.createdAt)}</small>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="text-center py-3">
          <Link
            to={inboxPath}
            className="btn btn-primary btn-sm"
            onClick={() => setOpen(false)}
          >
            View all notifications <i className="bx bx-right-arrow-alt ms-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
