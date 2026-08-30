import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { useNotifications } from '../../hooks/useNotifications';
import { useToastMessage } from '../../hooks/useToastMessage';
import {
  formatNotificationTime,
  getNotificationHref,
  notificationTypeLabel,
  type NotificationAudience,
} from '../../utils/notificationUi';

const PAGE_SIZE = 20;

type NotificationsInboxProps = {
  audience: NotificationAudience;
  variant?: 'store' | 'admin';
};

export function NotificationsInbox({ audience, variant = 'store' }: NotificationsInboxProps) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, unreadOnly: unreadOnly || null }),
    [page, unreadOnly],
  );

  const {
    items,
    totalCount,
    totalPages,
    unreadCount,
    loading,
    mutating,
    error,
    refresh,
    markRead,
    markAllRead,
    remove,
    getErrorMessage,
  } = useNotifications(query, { autoLoad: true });

  // Buyer side shows notifications as toasts; the admin card keeps its inline banner.
  useToastMessage(variant === 'store' ? error : null);

  async function handleMarkRead(notificationId: string, isRead: boolean) {
    if (isRead) return;
    setBusyId(notificationId);
    try {
      await markRead(notificationId);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to mark notification as read.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllRead() {
    setBusyId('all');
    try {
      await markAllRead();
      toast.success('All notifications marked as read.');
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to mark all notifications as read.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(notificationId: string) {
    setBusyId(notificationId);
    try {
      await remove(notificationId);
      toast.success('Notification deleted.');
      if (items.length <= 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await refresh();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to delete notification.'));
    } finally {
      setBusyId(null);
    }
  }

  if (variant === 'admin') {
    return (
      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="d-flex card-header justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h4 className="card-title mb-0">Notifications</h4>
                <p className="text-muted mb-0 mt-1">
                  {unreadCount} unread · {totalCount} total
                </p>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="seller-notifications-unread"
                    checked={unreadOnly}
                    onChange={(e) => {
                      setUnreadOnly(e.target.checked);
                      setPage(1);
                    }}
                  />
                  <label className="form-check-label" htmlFor="seller-notifications-unread">
                    Unread only
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-soft-primary"
                  disabled={mutating || unreadCount === 0 || busyId === 'all'}
                  onClick={() => void handleMarkAllRead()}
                >
                  Mark all as read
                </button>
              </div>
            </div>

            {error ? (
              <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                {error}
              </div>
            ) : null}

            <div className="card-body p-0">
              {loading && items.length === 0 ? (
                <p className="text-muted p-3 mb-0">Loading notifications…</p>
              ) : null}

              {!loading && items.length === 0 ? (
                <div className="text-center py-5">
                  <p className="text-muted mb-0">No notifications yet.</p>
                </div>
              ) : null}

              {items.length > 0 ? (
                <div className="table-responsive">
                  <table className="table align-middle mb-0 table-hover table-centered">
                    <thead className="bg-light-subtle">
                      <tr>
                        <th>Type</th>
                        <th>Message</th>
                        <th>When</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const busy = busyId === item.notificationId || mutating;
                        const href = getNotificationHref(item, audience);
                        return (
                          <tr key={item.notificationId} className={item.isRead ? '' : 'table-active'}>
                            <td>
                              <span className="badge bg-light text-dark">
                                {notificationTypeLabel(item.type)}
                              </span>
                            </td>
                            <td>
                              <div className="fw-semibold">{item.title}</div>
                              <div className="text-muted text-wrap">{item.body}</div>
                              {href ? (
                                <Link
                                  to={href}
                                  className="link-primary fs-13"
                                  onClick={() => void handleMarkRead(item.notificationId, item.isRead)}
                                >
                                  Open related item
                                </Link>
                              ) : null}
                            </td>
                            <td>{formatNotificationTime(item.createdAt)}</td>
                            <td>{item.isRead ? 'Read' : 'Unread'}</td>
                            <td>
                              <div className="d-flex gap-1 flex-wrap">
                                {!item.isRead ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-soft-primary"
                                    disabled={busy}
                                    onClick={() => void handleMarkRead(item.notificationId, item.isRead)}
                                  >
                                    Mark as read
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-soft-danger"
                                  disabled={busy}
                                  onClick={() => void handleDelete(item.notificationId)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            {totalPages > 1 ? (
              <div className="card-footer d-flex justify-content-between align-items-center">
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="text-muted">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-content-box">
      <div className="notifications-toolbar">
        <div className="notifications-toolbar__start">
          <label htmlFor="notifications-unread-only" className="notifications-filter-chip">
            <input
              id="notifications-unread-only"
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setPage(1);
              }}
            />
            <span>Unread only</span>
          </label>
          {!loading && items.length > 0 ? (
            <p className="notifications-toolbar__summary">
              {unreadCount} unread · {totalCount} total
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-default btn-accent btn-border notifications-toolbar__mark-all"
          disabled={mutating || unreadCount === 0 || busyId === 'all'}
          onClick={() => void handleMarkAllRead()}
        >
          Mark all as read
        </button>
      </div>

      {loading && items.length === 0 ? <p className="account-muted">Loading notifications…</p> : null}

      {!loading && items.length === 0 ? (
        <div className="buyer-orders-empty">
          <p>You have no notifications yet.</p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <ul className="notifications-list">
            {items.map((item) => {
              const busy = busyId === item.notificationId || mutating;
              const href = getNotificationHref(item, audience);

              return (
                <li
                  key={item.notificationId}
                  className={`notifications-list__item${item.isRead ? '' : ' is-unread'}`}
                >
                  <div className="notifications-list__head">
                    <div className="notifications-list__head-main">
                      <div className="notifications-list__labels">
                        <span className="notifications-list__type">
                          {notificationTypeLabel(item.type)}
                        </span>
                        {!item.isRead ? (
                          <span className="notifications-list__unread-badge">Unread</span>
                        ) : null}
                      </div>
                      <h3 className="notifications-list__title">{item.title}</h3>
                    </div>
                    <time className="notifications-list__time" dateTime={item.createdAt}>
                      {formatNotificationTime(item.createdAt)}
                    </time>
                  </div>
                  <p className="notifications-list__body">{item.body}</p>
                  <div className="notifications-list__actions">
                    {href ? (
                      <Link
                        to={href}
                        className="btn-default btn-accent"
                        onClick={() => void handleMarkRead(item.notificationId, item.isRead)}
                      >
                        View
                      </Link>
                    ) : null}
                    {!item.isRead ? (
                      <button
                        type="button"
                        className="btn-default btn-border"
                        disabled={busy}
                        onClick={() => void handleMarkRead(item.notificationId, item.isRead)}
                      >
                        Mark as read
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-default btn-border account-btn-danger"
                      disabled={busy}
                      onClick={() => void handleDelete(item.notificationId)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 ? (
            <div className="buyer-orders-pagination">
              <button
                type="button"
                className="btn-default"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-default"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
