import { useEffect, type ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function CatalogFilterDrawer({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="catalog-filter-drawer" role="dialog" aria-modal="true" aria-label="Filters">
      <button type="button" className="catalog-filter-drawer__backdrop" aria-label="Close filters" onClick={onClose} />
      <div className="catalog-filter-drawer__sheet">
        <div className="catalog-filter-drawer__handle" aria-hidden />
        <div className="catalog-filter-drawer__head">
          <h2>Filter products</h2>
          <button type="button" className="catalog-filter-drawer__close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>
        <div className="catalog-filter-drawer__body">{children}</div>
      </div>
    </div>
  );
}
