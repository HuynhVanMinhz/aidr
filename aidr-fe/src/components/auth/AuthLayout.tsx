import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../ThemeToggle';

type AuthLayoutProps = {
  children: ReactNode;
};

/** Minimal auth shell using theme login page structure. */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <header className="auth-shell__header">
        <Link to="/" className="auth-shell__brand">
          <img src="/theme/images/logo.svg" alt="AIDR" height={36} />
        </Link>
        <div className="auth-shell__header-actions">
          <ThemeToggle />
        </div>
      </header>
      {children}
      <footer className="auth-shell__footer">
        <p>© AIDR — AI-Integrated Digital Retail</p>
      </footer>
    </div>
  );
}
