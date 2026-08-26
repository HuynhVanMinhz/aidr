import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { getAdminDashboard } from '../../services/adminApi';
import type { AdminDashboard } from '../../types/adminOps';
import { getApiErrorMessage } from '../../utils/apiError';

type KpiCard = {
  title: string;
  value: number;
  unit: string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  link: string;
  linkLabel: string;
};

function buildKpiCards(data: AdminDashboard): KpiCard[] {
  return [
    {
      title: 'Pending Products',
      value: data.pendingProducts,
      unit: 'Queue',
      icon: 'solar:t-shirt-bold-duotone',
      tone: 'warning',
      link: '/admin/products',
      linkLabel: 'Moderation queue',
    },
    {
      title: 'Approved Products',
      value: data.approvedProducts,
      unit: 'Live',
      icon: 'solar:check-circle-bold-duotone',
      tone: 'success',
      link: '/admin/products',
      linkLabel: 'View products',
    },
    {
      title: 'Seller Applications',
      value: data.pendingSellerRegistrations,
      unit: 'Pending',
      icon: 'solar:shop-bold-duotone',
      tone: 'warning',
      link: '/admin/seller-registrations',
      linkLabel: 'Review requests',
    },
    {
      title: 'Return Requests',
      value: data.pendingReturns,
      unit: 'Pending',
      icon: 'solar:restart-bold-duotone',
      tone: 'danger',
      link: '/admin/return-requests',
      linkLabel: 'Open queue',
    },
    {
      title: 'Active Users',
      value: data.activeUsers,
      unit: 'Accounts',
      icon: 'solar:users-group-rounded-bold-duotone',
      tone: 'primary',
      link: '/admin/accounts',
      linkLabel: 'Manage accounts',
    },
    {
      title: 'Locked Users',
      value: data.lockedUsers,
      unit: 'Accounts',
      icon: 'solar:lock-keyhole-bold-duotone',
      tone: 'danger',
      link: '/admin/accounts',
      linkLabel: 'View accounts',
    },
    {
      title: 'Active Shops',
      value: data.activeShops,
      unit: 'Sellers',
      icon: 'solar:bag-smile-bold-duotone',
      tone: 'info',
      link: '/admin/seller-registrations',
      linkLabel: 'Seller onboarding',
    },
    {
      title: 'System Vouchers',
      value: data.systemVoucherActiveCount,
      unit: 'Active',
      icon: 'solar:ticket-sale-bold-duotone',
      tone: 'success',
      link: '/admin/vouchers',
      linkLabel: 'Manage vouchers',
    },
  ];
}

export function AdminHomePage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAdminDashboard()
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !result.data) {
          throw new Error(result.message || 'Unable to load dashboard.');
        }
        setDashboard(result.data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = dashboard ? buildKpiCards(dashboard) : [];

  return (
    <>
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !dashboard ? (
        <p className="text-muted">Loading dashboard…</p>
      ) : null}

      {dashboard ? (
        <>
          <div className="row">
            {kpis.map((item) => (
              <div className="col-md-6 col-xl-3" key={item.title}>
                <Link to={item.link} className="text-reset text-decoration-none d-block h-100">
                  <AdminStatCard
                    title={item.title}
                    value={item.value}
                    unit={item.unit}
                    icon={item.icon}
                    tone={item.tone}
                  />
                  <p className="text-primary fs-12 fw-semibold mb-3 ms-1">{item.linkLabel} →</p>
                </Link>
              </div>
            ))}
          </div>

          <div className="row">
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
                    {dashboard.pendingProducts} product{dashboard.pendingProducts === 1 ? '' : 's'} waiting
                    for review.
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
                    {dashboard.pendingSellerRegistrations} pending seller application
                    {dashboard.pendingSellerRegistrations === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="card card-height-100">
                <div className="card-header d-flex align-items-center justify-content-between gap-2">
                  <h4 className="card-title flex-grow-1">Returns & Refunds</h4>
                  <Link to="/admin/return-requests" className="btn btn-sm btn-primary">
                    Open Queue
                  </Link>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-0">
                    {dashboard.pendingReturns} return request{dashboard.pendingReturns === 1 ? '' : 's'} in
                    the queue.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="card card-height-100">
                <div className="card-header d-flex align-items-center justify-content-between gap-2">
                  <h4 className="card-title flex-grow-1">Accounts</h4>
                  <Link to="/admin/accounts" className="btn btn-sm btn-primary">
                    Manage Accounts
                  </Link>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-0">
                    {dashboard.activeUsers} active and {dashboard.lockedUsers} locked user accounts.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="card card-height-100">
                <div className="card-header d-flex align-items-center justify-content-between gap-2">
                  <h4 className="card-title flex-grow-1">System Vouchers</h4>
                  <Link to="/admin/vouchers" className="btn btn-sm btn-primary">
                    View Vouchers
                  </Link>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-0">
                    {dashboard.systemVoucherActiveCount} active platform voucher
                    {dashboard.systemVoucherActiveCount === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="card card-height-100">
                <div className="card-header d-flex align-items-center justify-content-between gap-2">
                  <h4 className="card-title flex-grow-1">Customer Insights</h4>
                  <Link to="/admin/insights" className="btn btn-sm btn-primary">
                    View Insights
                  </Link>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-0">
                    Platform KPIs, registration trends, top products, and buyer cohorts.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="card card-height-100">
                <div className="card-header d-flex align-items-center justify-content-between gap-2">
                  <h4 className="card-title flex-grow-1">Orders</h4>
                  <Link to="/admin/orders" className="btn btn-sm btn-primary">
                    View Orders
                  </Link>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-0">
                    Browse and inspect platform orders across all shops and buyers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
