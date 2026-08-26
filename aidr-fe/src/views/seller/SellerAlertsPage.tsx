import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useSellerInventory } from '../../hooks/useSellerInventory';
import { sellerProductStatusBadgeClass } from '../../utils/sellerProductUi';

const PAGE_SIZE = 20;

export function SellerAlertsPage() {
  const { items, paging, summary, listLoading, listError, loadList } = useSellerInventory();
  const [page, setPage] = useState(1);

  useEffect(() => {
    void loadList({
      lowStock: true,
      page,
      pageSize: PAGE_SIZE,
    });
  }, [loadList, page]);

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Low Stock Alerts"
            value={summary.lowStockCount}
            unit="SKUs"
            icon="solar:danger-triangle-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="In This View"
            value={paging.totalCount}
            unit="Products"
            icon="solar:box-minimalistic-bold-duotone"
            tone="primary"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">Low stock alerts</h4>
              <Link to="/seller/inventory" className="btn btn-sm btn-outline-light">
                View all inventory
              </Link>
            </div>

            {listError ? (
              <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                {listError}
              </div>
            ) : null}

            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover table-centered">
                <thead className="bg-light-subtle">
                  <tr>
                    <th>Product</th>
                    <th>Available</th>
                    <th>Threshold</th>
                    <th>On hand</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading && items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        Loading alerts…
                      </td>
                    </tr>
                  ) : null}
                  {!listLoading && items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        No low stock alerts. Your inventory levels look healthy.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="rounded bg-light avatar-md d-flex align-items-center justify-content-center overflow-hidden">
                            {item.primaryImageUrl ? (
                              <img src={item.primaryImageUrl} alt="" className="avatar-md" />
                            ) : (
                              <IconifyIcon icon="solar:box-bold-duotone" className="fs-24 text-muted" />
                            )}
                          </div>
                          <div>
                            <Link
                              to={`/seller/products/${item.productId}/inventory`}
                              className="text-dark fw-medium fs-15"
                            >
                              {item.name}
                            </Link>
                            <p className="text-warning mb-0 mt-1 fs-13">Low stock</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-warning fw-medium">{item.availableQuantity}</span>
                      </td>
                      <td>{item.lowStockThreshold}</td>
                      <td>{item.stockQuantity}</td>
                      <td>
                        <span className={sellerProductStatusBadgeClass(item.status)}>{item.status}</span>
                      </td>
                      <td>
                        <Link
                          to={`/seller/products/${item.productId}/inventory`}
                          className="btn btn-soft-primary btn-sm"
                          title="Manage inventory"
                        >
                          <IconifyIcon icon="solar:box-minimalistic-broken" className="align-middle fs-18" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminPagination
              page={paging.page}
              pageSize={paging.pageSize}
              total={paging.totalCount}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>
    </>
  );
}
