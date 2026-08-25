import { Link } from 'react-router-dom';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useSellerDashboard } from '../../hooks/useSellerFinance';
import { formatOrderDate, formatOrderStatus } from '../../utils/orderUi';
import { formatVnd } from '../../utils/sellerProductUi';
import { sellerOrderStatusBadgeClass } from '../../utils/sellerOrderUi';

export function SellerHomePage() {
  const { dashboard, loading, error } = useSellerDashboard();

  const orders = dashboard?.orders;
  const revenue = dashboard?.revenue;
  const catalog = dashboard?.catalog;
  const wallet = dashboard?.wallet;

  return (
    <>
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Revenue today"
            value={loading && !revenue ? '…' : formatVnd(revenue?.today ?? 0)}
            icon="solar:wallet-money-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="This month"
            value={loading && !revenue ? '…' : formatVnd(revenue?.thisMonth ?? 0)}
            icon="solar:chart-2-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Awaiting fulfillment"
            value={loading && !orders ? '…' : (orders?.awaitingFulfillmentCount ?? 0)}
            unit="Orders"
            icon="solar:bag-check-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Low stock"
            value={loading && !catalog ? '…' : (catalog?.lowStockCount ?? 0)}
            unit="SKUs"
            icon="solar:danger-triangle-bold-duotone"
            tone="danger"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Available balance"
            value={loading && !wallet ? '…' : formatVnd(wallet?.availableBalance ?? 0)}
            icon="solar:wallet-bold-duotone"
            tone="info"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Pending settlement"
            value={loading && !wallet ? '…' : formatVnd(wallet?.pendingBalance ?? 0)}
            icon="solar:clock-circle-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Products pending review"
            value={loading && !catalog ? '…' : (catalog?.pendingProductCount ?? 0)}
            unit="Items"
            icon="solar:hourglass-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Active products"
            value={loading && !catalog ? '…' : (catalog?.activeProductCount ?? 0)}
            unit="Live"
            icon="solar:box-bold-duotone"
            tone="success"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h4 className="card-title mb-0">Recent orders</h4>
              <Link to="/seller/orders" className="btn btn-sm btn-primary">
                View all orders
              </Link>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table align-middle mb-0 table-hover table-centered">
                  <thead className="bg-light-subtle">
                    <tr>
                      <th>Order</th>
                      <th>Created</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !dashboard ? (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-muted">
                          Loading dashboard…
                        </td>
                      </tr>
                    ) : null}
                    {!loading && (dashboard?.recentOrders.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-muted">
                          No orders yet.
                        </td>
                      </tr>
                    ) : null}
                    {(dashboard?.recentOrders ?? []).map((order) => (
                      <tr key={order.orderId}>
                        <td>
                          <Link
                            to={`/seller/orders/${order.orderId}`}
                            className="link-primary fw-medium"
                          >
                            {order.orderCode}
                          </Link>
                        </td>
                        <td>{formatOrderDate(order.createdAt)}</td>
                        <td>{formatVnd(order.totalAmount)}</td>
                        <td>
                          <span className={sellerOrderStatusBadgeClass(order.status)}>
                            {formatOrderStatus(order.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="card-title mb-0">Order overview</h4>
            </div>
            <div className="card-body">
              <ul className="list-group list-group-flush">
                <li className="list-group-item d-flex justify-content-between px-0">
                  <span className="text-muted">Total orders</span>
                  <span className="fw-semibold">{orders?.totalCount ?? 0}</span>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0">
                  <span className="text-muted">Pending payment</span>
                  <span className="fw-semibold">{orders?.pendingPaymentCount ?? 0}</span>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0">
                  <span className="text-muted">Shipping</span>
                  <span className="fw-semibold">{orders?.shippingCount ?? 0}</span>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0">
                  <span className="text-muted">Completed</span>
                  <span className="fw-semibold">{orders?.completedCount ?? 0}</span>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0">
                  <span className="text-muted">Return requested</span>
                  <span className="fw-semibold">{orders?.returnRequestedCount ?? 0}</span>
                </li>
              </ul>
              <div className="mt-3 d-grid gap-2">
                <Link to="/seller/reports" className="btn btn-outline-primary btn-sm">
                  Sales reports
                </Link>
                <Link to="/seller/wallet" className="btn btn-outline-primary btn-sm">
                  Wallet & ledger
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="card-title mb-0">Low stock preview</h4>
              <Link to="/seller/inventory?lowStock=1" className="btn btn-sm btn-light">
                View all
              </Link>
            </div>
            <div className="card-body p-0">
              {(dashboard?.lowStockItems.length ?? 0) === 0 ? (
                <p className="text-muted mb-0 p-3">No low-stock alerts.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {(dashboard?.lowStockItems ?? []).map((item) => (
                    <li
                      key={item.productId}
                      className="list-group-item d-flex justify-content-between align-items-start gap-2"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/seller/products/${item.productId}/inventory`}
                          className="fw-medium text-truncate d-block"
                        >
                          {item.name}
                        </Link>
                        <small className="text-muted">
                          Threshold: {item.lowStockThreshold}
                        </small>
                      </div>
                      <span className="badge bg-warning-subtle text-warning flex-shrink-0">
                        {item.availableQuantity} left
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

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

        <div className="col-md-6 col-xl-4">
          <div className="card overflow-hidden">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h5 className="text-muted fw-normal mt-0">Shop vouchers</h5>
                  <p className="mb-0 text-muted">Create and manage discounts for your shop.</p>
                </div>
                <div className="avatar-sm rounded bg-primary-subtle">
                  <IconifyIcon
                    icon="solar:ticket-sale-bold-duotone"
                    className="avatar-title fs-24 text-primary"
                  />
                </div>
              </div>
              <div className="mt-3">
                <Link to="/seller/vouchers" className="btn btn-sm btn-primary me-2">
                  View vouchers
                </Link>
                <Link to="/seller/vouchers/new" className="btn btn-sm btn-outline-primary">
                  Add voucher
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
