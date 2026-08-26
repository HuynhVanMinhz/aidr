import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useSellerInventory } from '../../hooks/useSellerInventory';
import { formatVnd, sellerProductStatusBadgeClass } from '../../utils/sellerProductUi';

const PAGE_SIZE = 20;

export function SellerInventoryListPage() {
  const { items, paging, summary, listLoading, listError, loadList } = useSellerInventory();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [lowStock, setLowStock] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, lowStock]);

  useEffect(() => {
    void loadList({
      q: debouncedQ || undefined,
      lowStock: lowStock === '1' ? true : undefined,
      page,
      pageSize: PAGE_SIZE,
    });
  }, [loadList, debouncedQ, lowStock, page]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setDebouncedQ(q.trim());
    setPage(1);
  }

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Total Products"
            value={summary.productCount}
            unit="SKUs"
            icon="solar:box-broken"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="On-hand Units"
            value={summary.totalUnits}
            unit="Items"
            icon="solar:reorder-broken"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Reserved"
            value={summary.reservedUnits}
            unit="Items"
            icon="solar:bag-check-broken"
            tone="info"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Low Stock"
            value={summary.lowStockCount}
            unit="Alerts"
            icon="solar:danger-triangle-broken"
            tone="warning"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">Inventory</h4>
              <form
                className="d-flex flex-nowrap align-items-center gap-2"
                onSubmit={handleSearchSubmit}
              >
                <AdminSelect
                  id="seller-inventory-stock-filter"
                  size="sm"
                  block={false}
                  value={lowStock}
                  options={[
                    { value: '', label: 'All stock levels' },
                    { value: '1', label: 'Low stock only' },
                  ]}
                  onChange={setLowStock}
                />
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search name / brand..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ width: 220, flex: '0 0 auto' }}
                />
                <button type="submit" className="btn btn-sm btn-outline-light text-nowrap">
                  Search
                </button>
              </form>
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
                    <th>On hand</th>
                    <th>Reserved</th>
                    <th>Available</th>
                    <th>Cost</th>
                    <th>Selling price</th>
                    <th>Est. margin / unit</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading && items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : null}
                  {!listLoading && items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-muted">
                        No inventory records.{' '}
                        <Link to="/seller/products" className="alert-link">
                          Manage products
                        </Link>
                        .
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
                            {item.isLowStock ? (
                              <p className="text-warning mb-0 mt-1 fs-13">Low stock</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>{item.stockQuantity}</td>
                      <td>{item.reservedQuantity}</td>
                      <td>
                        <span className={item.isLowStock ? 'text-warning fw-medium' : undefined}>
                          {item.availableQuantity}
                        </span>
                        <div className="text-muted fs-13">Threshold {item.lowStockThreshold}</div>
                      </td>
                      <td>
                        {item.avgCostPrice != null || item.lastCostPrice != null ? (
                          <>
                            <div>
                              Avg{' '}
                              {item.avgCostPrice != null
                                ? formatVnd(item.avgCostPrice)
                                : 'No average cost'}
                            </div>
                            <small className="text-muted">
                              Last import{' '}
                              {item.lastCostPrice != null
                                ? formatVnd(item.lastCostPrice)
                                : 'No import cost yet'}
                            </small>
                          </>
                        ) : (
                          <span className="text-muted">No cost yet</span>
                        )}
                      </td>
                      <td>
                        <div>{formatVnd(item.effectivePrice ?? item.salePrice ?? item.basePrice)}</div>
                        {item.salePrice != null ? (
                          <small className="text-muted text-decoration-line-through">
                            {formatVnd(item.basePrice)}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        {item.estimatedMarginPerUnit != null ? (
                          <span
                            className={
                              item.estimatedMarginPerUnit >= 0
                                ? 'text-success fw-medium'
                                : 'text-danger fw-medium'
                            }
                          >
                            {formatVnd(item.estimatedMarginPerUnit)}
                          </span>
                        ) : (
                          <span className="text-muted">Needs cost to estimate</span>
                        )}
                      </td>
                      <td>
                        <span className={sellerProductStatusBadgeClass(item.status)}>{item.status}</span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            to={`/seller/products/${item.productId}/inventory`}
                            className="btn btn-light btn-sm"
                            title="Manage inventory"
                          >
                            <IconifyIcon icon="solar:box-minimalistic-broken" className="align-middle fs-18" />
                          </Link>
                          <Link
                            to={`/seller/products/${item.productId}`}
                            className="btn btn-soft-primary btn-sm"
                            title="Product details"
                          >
                            <IconifyIcon icon="solar:eye-broken" className="align-middle fs-18" />
                          </Link>
                        </div>
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
