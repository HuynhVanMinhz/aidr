import { Link } from 'react-router-dom';

export interface SupportBreadcrumb {
  label: string;
  to?: string;
}

interface SupportPageLayoutProps {
  title: string;
  breadcrumbs: SupportBreadcrumb[];
  search?: React.ReactNode;
  children: React.ReactNode;
}

export function SupportPageLayout({
  title,
  breadcrumbs,
  search,
  children,
}: SupportPageLayoutProps) {
  return (
    <div className="support-page light-section">
      <div className="support-page__inner">
        <header className="support-page__header">
          <h1 className="support-page__title">{title}</h1>
          <nav className="support-page__breadcrumb" aria-label="Breadcrumb">
            <ol>
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${index}`}>
                    {crumb.to && !isLast ? (
                      <Link to={crumb.to}>{crumb.label}</Link>
                    ) : (
                      <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          {search}
        </header>
        <div className="support-page__body">{children}</div>
      </div>
    </div>
  );
}
