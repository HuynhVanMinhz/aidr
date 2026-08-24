import { Link } from 'react-router-dom';
import { IconifyIcon } from '../../components/admin/IconifyIcon';

export function SellerHomePage() {
  return (
    <div className="row">
      <div className="col-md-6 col-xl-4">
        <div className="card overflow-hidden">
          <div className="card-body">
            <div className="d-flex align-items-center">
              <div className="flex-grow-1">
                <h5 className="text-muted fw-normal mt-0">My Products</h5>
                <p className="mb-0 text-muted">Create, edit, and track moderation status.</p>
              </div>
              <div className="avatar-sm rounded bg-primary-subtle">
                <IconifyIcon
                  icon="solar:box-bold-duotone"
                  className="avatar-title fs-24 text-primary"
                />
              </div>
            </div>
            <div className="mt-3">
              <Link to="/seller/products" className="btn btn-sm btn-primary me-2">
                View products
              </Link>
              <Link to="/seller/products/new" className="btn btn-sm btn-outline-primary">
                Add product
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-6 col-xl-4">
        <div className="card overflow-hidden">
          <div className="card-body">
            <div className="d-flex align-items-center">
              <div className="flex-grow-1">
                <h5 className="text-muted fw-normal mt-0">Inventory & pricing</h5>
                <p className="mb-0 text-muted">Stock lots, adjustments, and selling prices.</p>
              </div>
              <div className="avatar-sm rounded bg-primary-subtle">
                <IconifyIcon
                  icon="solar:box-minimalistic-bold-duotone"
                  className="avatar-title fs-24 text-primary"
                />
              </div>
            </div>
            <div className="mt-3">
              <Link to="/seller/inventory" className="btn btn-sm btn-primary">
                View inventory
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-body">
            <h4 className="card-title">Seller Center</h4>
            <p className="text-muted mb-0">
              Manage your catalog, stock lots, and selling prices here. New products are submitted as
              Pending until an admin approves them for the storefront.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
