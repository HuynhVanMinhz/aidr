import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRoles } from '../hooks/useRoles';
import { homePathForRoles } from '../utils/postLoginRedirect';

export function ForbiddenPage() {
  const { isAuthenticated, roles } = useAuth();
  const { workspaces } = useRoles();
  const homeTo = isAuthenticated ? homePathForRoles(roles) : '/';

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>403 — Access denied</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="light-section">
        <div className="container py-5 text-center">
          <p className="account-muted">
            {isAuthenticated
              ? 'Your account does not have permission to view this page.'
              : 'You do not have permission to view this page. Sign in with an account that does.'}
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-3">
            <Link to={homeTo} className="btn-default">
              {isAuthenticated ? 'Go to your home' : 'Go to home'}
            </Link>
            {workspaces.map((ws) => (
              <Link key={ws.to} to={ws.to} className="btn-default btn-border">
                {ws.label}
              </Link>
            ))}
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
