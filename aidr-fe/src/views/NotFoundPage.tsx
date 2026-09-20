import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { homePathForRoles } from '../utils/postLoginRedirect';

export function NotFoundPage() {
  const { isAuthenticated, roles } = useAuth();
  const homeTo = isAuthenticated ? homePathForRoles(roles) : '/';

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>404 — Page not found</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="light-section">
        <div className="container py-5 text-center">
          <p className="account-muted">The page you are looking for does not exist or has moved.</p>
          <div className="d-flex flex-wrap justify-content-center gap-3">
            <Link to={homeTo} className="btn-default">
              {isAuthenticated ? 'Go to your home' : 'Go to home'}
            </Link>
            {!isAuthenticated && (
              <Link to="/login" className="btn-default btn-accent btn-border">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
