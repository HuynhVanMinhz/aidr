import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Access denied</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="light-section">
        <div className="container py-5 text-center">
          <p className="account-muted">
            You do not have permission to view this page. Sign in with the correct account or return
            to the storefront.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-3">
            <Link to="/" className="btn-default">
              Go to home
            </Link>
            <Link to="/login" className="btn-default btn-accent btn-border">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
