import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../ThemeToggle';

type AuthLayoutProps = {
  children: ReactNode;
  /** Show store banner beside the form (login / register). */
  showBanner?: boolean;
};

/** Minimal auth shell using theme login page structure. */
export function AuthLayout({ children, showBanner = false }: AuthLayoutProps) {
  return (
    <div className={`auth-shell${showBanner ? ' auth-shell--with-banner' : ''}`}>
      {showBanner && (
        <aside className="auth-shell__banner" aria-hidden="true">
          <img
            src="/theme/images/banner-login-register.png"
            alt=""
            className="auth-shell__banner-img"
          />
        </aside>
      )}
      <div className="auth-shell__main">
        <header className="auth-shell__header">
          <Link to="/" className="auth-shell__brand">
            <img src="/theme/images/aidr-logo-header.png" alt="AIDR" height={52} />
          </Link>
          <div className="auth-shell__header-actions">
            <ThemeToggle />
          </div>
        </header>
        {children}
        <footer className="auth-shell__footer">
          <p>© AIDR - AI-Integrated Digital Retail</p>
        </footer>
      </div>
    </div>
  );
}
