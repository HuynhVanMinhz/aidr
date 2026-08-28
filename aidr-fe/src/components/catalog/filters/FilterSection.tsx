import { useState, type ReactNode } from 'react';

type Props = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: number;
};

export function FilterSection({ title, children, defaultOpen = true, badge }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="catalog-filter-section">
      <button
        type="button"
        className="catalog-filter-section__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="catalog-filter-section__title">
          {title}
          {badge != null && badge > 0 ? (
            <span className="catalog-filter-section__badge">{badge}</span>
          ) : null}
        </span>
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} aria-hidden />
      </button>
      {open ? <div className="catalog-filter-section__body">{children}</div> : null}
    </section>
  );
}
