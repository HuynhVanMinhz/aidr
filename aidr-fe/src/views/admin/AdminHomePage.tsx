import { Link } from 'react-router-dom';

const kpis = [
  { label: 'Total Categories', value: '128', delta: '+2.3%', trend: 'up', icon: 'bx bx-category' },
  { label: 'Active Categories', value: '104', delta: '+1.4%', trend: 'up', icon: 'bx bx-check-shield' },
  { label: 'Hidden Categories', value: '24', delta: '-0.8%', trend: 'down', icon: 'bx bx-hide' },
  { label: 'Mapped Products', value: '4,982', delta: '+3.2%', trend: 'up', icon: 'bx bx-package' },
] as const;

export function AdminHomePage() {
  return (
    <>
      <div className="row">
        {kpis.map((item) => (
          <div className="col-md-6 col-xl-3" key={item.label}>
            <div className="card overflow-hidden">
              <div className="card-body">
                <div className="row">
                  <div className="col-6">
                    <div className="avatar-md bg-soft-primary rounded">
                      <i className={`${item.icon} avatar-title fs-24 text-primary`} />
                    </div>
                  </div>
                  <div className="col-6 text-end">
                    <p className="text-muted mb-0 text-truncate">{item.label}</p>
                    <h3 className="text-dark mt-1 mb-0">{item.value}</h3>
                  </div>
                </div>
              </div>
              <div className="card-footer py-2 bg-light bg-opacity-50">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className={item.trend === 'up' ? 'text-success' : 'text-danger'}>
                      <i className={`bx ${item.trend === 'up' ? 'bxs-up-arrow' : 'bxs-down-arrow'} fs-12`} /> {item.delta}
                    </span>
                    <span className="text-muted ms-1 fs-12">This week</span>
                  </div>
                  <Link to="/admin/categories" className="text-reset fw-semibold fs-12">
                    View More
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="col-lg-4">
          <div className="card card-height-100">
            <div className="card-header d-flex align-items-center justify-content-between gap-2">
              <h4 className="card-title flex-grow-1">Category Management</h4>
              <Link to="/admin/categories/new" className="btn btn-sm btn-primary">
                Create Category
              </Link>
            </div>
            <div className="card-body">
              <p className="text-muted mb-0">
                Create, update, show or hide categories, and delete them when they have no products or child categories.
              </p>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card card-height-100">
            <div className="card-header d-flex align-items-center justify-content-between gap-2">
              <h4 className="card-title flex-grow-1">Seller Onboarding</h4>
              <Link to="/admin/seller-registrations" className="btn btn-sm btn-primary">
                Review Requests
              </Link>
            </div>
            <div className="card-body">
              <p className="text-muted mb-0">
                Review pending seller applications. Approve to create a shop and wallet, or reject with a note.
              </p>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card card-height-100">
            <div className="card-header d-flex align-items-center justify-content-between gap-2">
              <h4 className="card-title flex-grow-1">Product Moderation</h4>
              <Link to="/admin/products" className="btn btn-sm btn-primary">
                Open Queue
              </Link>
            </div>
            <div className="card-body">
              <p className="text-muted mb-0">
                Review pending products. Approve to publish to the catalog, or reject with a reason and audit history.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
