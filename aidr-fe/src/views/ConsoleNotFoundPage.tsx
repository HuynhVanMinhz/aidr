import { Link } from 'react-router-dom';

type ConsoleNotFoundPageProps = {
  homeTo: string;
  homeLabel: string;
};

/** 404 inside Admin/Seller shell (keeps console chrome). */
export function ConsoleNotFoundPage({ homeTo, homeLabel }: ConsoleNotFoundPageProps) {
  return (
    <div className="row justify-content-center">
      <div className="col-lg-6">
        <div className="card">
          <div className="card-body text-center py-5">
            <h3 className="mb-2">404 — Page not found</h3>
            <p className="text-muted mb-4">
              This page does not exist in the console, or the link is outdated.
            </p>
            <Link to={homeTo} className="btn btn-primary">
              {homeLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
