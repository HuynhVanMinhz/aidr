import type { ReactNode } from 'react';
import { IconifyIcon } from './IconifyIcon';

export type AdminStatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

type AdminStatCardProps = {
  title: string;
  value: number | string;
  unit?: string;
  icon: string;
  tone?: AdminStatTone;
};

const toneClass: Record<AdminStatTone, { soft: string; text: string }> = {
  primary: { soft: 'bg-soft-primary', text: 'text-primary' },
  success: { soft: 'bg-soft-success', text: 'text-success' },
  warning: { soft: 'bg-soft-warning', text: 'text-warning' },
  danger: { soft: 'bg-soft-danger', text: 'text-danger' },
  info: { soft: 'bg-soft-info', text: 'text-info' },
};

export function AdminStatCard({
  title,
  value,
  unit,
  icon,
  tone = 'primary',
}: AdminStatCardProps) {
  const colors = toneClass[tone];

  return (
    <div className="card aidr-stat-card">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between gap-3 w-100">
          <div className="aidr-stat-card__content min-w-0 flex-grow-1">
            <p className="text-muted mb-1 fw-semibold">{title}</p>
            <h3 className="mb-0 text-dark aidr-stat-card__value">
              {value}
              {unit ? (
                <span className="fs-14 fw-normal text-muted ms-1">({unit})</span>
              ) : null}
            </h3>
          </div>
          <div className={`avatar-md ${colors.soft} rounded flex-shrink-0`}>
            <IconifyIcon icon={icon} className={`avatar-title fs-32 ${colors.text}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

type AdminPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function AdminPagination({ page, pageSize, total, onPageChange }: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: number[] = [];
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-3 border-top">
      <p className="text-muted mb-0 fs-13">
        Showing {from}–{to} of {total}
      </p>
      <nav aria-label="Table pagination">
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item${page <= 1 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Prev
            </button>
          </li>
          {pages.map((p) => (
            <li key={p} className={`page-item${p === page ? ' active' : ''}`}>
              <button type="button" className="page-link" onClick={() => onPageChange(p)}>
                {p}
              </button>
            </li>
          ))}
          <li className={`page-item${page >= totalPages ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return <p className="text-muted mb-0">{children}</p>;
}
