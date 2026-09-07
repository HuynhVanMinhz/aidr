import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { ApexOptions } from 'apexcharts';
import { AdminApexChart } from '../../components/admin/AdminApexChart';
import { AiAnalyticsBriefCard } from '../../components/admin/AiAnalyticsBriefCard';
import { AdminDatePicker } from '../../components/admin/AdminDatePicker';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { useAdminCustomerInsights } from '../../hooks/useAdminGovernance';
import type {
  AdminCustomerInsightPeriod,
  AdminCustomerInsightTopProduct,
  AdminCustomerInsightsGranularity,
} from '../../types/admin';
import {
  ADMIN_INSIGHT_GRANULARITY_OPTIONS,
  formatInsightPeriodLabel,
} from '../../utils/adminGovernanceUi';
import { defaultReportDateRange } from '../../utils/sellerFinanceUi';
import { formatVnd } from '../../utils/sellerProductUi';

const defaults = defaultReportDateRange();
const SECTION_PAGE_SIZE = 10;

const CHART_COLORS = {
  primary: '#1c84ee',
  teal: '#4ecac2',
  info: '#7f56da',
  success: '#22c55e',
  warning: '#f9b931',
  danger: '#ef5f5f',
  muted: '#94a3b8',
};

function useClientPagedRows<T>(rows: T[], resetKey: string, pageSize = SECTION_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const items = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return { page: safePage, setPage, pageSize, total, items };
}

function baseChartOptions(overrides: ApexOptions = {}): ApexOptions {
  return {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit',
      foreColor: '#6c757d',
      parentHeightOffset: 0,
      animations: { enabled: true },
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    grid: {
      borderColor: 'rgba(22, 24, 29, 0.08)',
      strokeDashArray: 4,
      padding: { left: 8, right: 12 },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '13px',
    },
    tooltip: {
      theme: 'light',
    },
    ...overrides,
  };
}

export function AdminCustomerInsightsPage() {
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [granularity, setGranularity] = useState<AdminCustomerInsightsGranularity>('day');
  const [applied, setApplied] = useState({
    from: defaults.from,
    to: defaults.to,
    granularity: 'day' as AdminCustomerInsightsGranularity,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const query = useMemo(
    () => ({
      from: applied.from,
      to: applied.to,
      granularity: applied.granularity,
    }),
    [applied.from, applied.granularity, applied.to],
  );

  const resetKey = `${applied.from}|${applied.to}|${applied.granularity}`;
  const { insights, loading, error } = useAdminCustomerInsights(query);
  const summary = insights?.summary;
  const cohort = insights?.cohort;

  const orderSeries = insights?.orderSeries ?? [];
  const registrationSeries = insights?.registrationSeries ?? [];
  const topProducts = insights?.topProducts ?? [];
  const granularityLabel = insights?.granularity ?? applied.granularity;

  const maxGmv = Math.max(1, ...orderSeries.map((r) => r.gmv), 1);
  const maxRegs = Math.max(1, ...registrationSeries.map((r) => r.newUserCount), 1);

  const ordersPage = useClientPagedRows(orderSeries, resetKey);
  const productsPage = useClientPagedRows(topProducts, resetKey);
  const registrationsPage = useClientPagedRows(registrationSeries, resetKey);

  const periodLabels = useMemo(
    () => orderSeries.map((r) => formatInsightPeriodLabel(r.periodKey, granularityLabel)),
    [orderSeries, granularityLabel],
  );

  const registrationLabels = useMemo(
    () => registrationSeries.map((r) => formatInsightPeriodLabel(r.periodKey, granularityLabel)),
    [registrationSeries, granularityLabel],
  );

  const ordersGmvChartOptions = useMemo<ApexOptions>(
    () =>
      baseChartOptions({
        colors: [CHART_COLORS.primary, CHART_COLORS.teal],
        stroke: { width: [0, 3], curve: 'smooth' },
        xaxis: {
          categories: periodLabels,
          tickAmount: Math.min(periodLabels.length, 12),
          labels: {
            rotate: periodLabels.length > 10 ? -45 : 0,
            rotateAlways: periodLabels.length > 10,
            hideOverlappingLabels: true,
            trim: true,
            maxHeight: 80,
          },
        },
        yaxis: [
          {
            title: { text: 'Orders' },
            labels: {
              formatter: (v) => `${Math.round(v)}`,
            },
          },
          {
            opposite: true,
            title: { text: 'GMV (VND)' },
            labels: {
              formatter: (v) => formatCompactVnd(v),
            },
          },
        ],
        tooltip: {
          shared: true,
          y: {
            formatter: (value, opts) => {
              const seriesIndex = opts?.seriesIndex ?? 0;
              return seriesIndex === 1 ? formatVnd(value) : `${Math.round(value)}`;
            },
          },
        },
      }),
    [periodLabels],
  );

  const ordersGmvSeries = useMemo(
    () => [
      { name: 'Orders', type: 'column' as const, data: orderSeries.map((r) => r.orderCount) },
      { name: 'GMV', type: 'line' as const, data: orderSeries.map((r) => r.gmv) },
    ],
    [orderSeries],
  );

  const registrationsChartOptions = useMemo<ApexOptions>(
    () =>
      baseChartOptions({
        colors: [CHART_COLORS.info],
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.35,
            opacityTo: 0.05,
          },
        },
        xaxis: {
          categories: registrationLabels,
          tickAmount: Math.min(registrationLabels.length, 12),
          labels: {
            rotate: registrationLabels.length > 10 ? -45 : 0,
            rotateAlways: registrationLabels.length > 10,
            hideOverlappingLabels: true,
            trim: true,
            maxHeight: 80,
          },
        },
        yaxis: {
          title: { text: 'New users' },
          labels: { formatter: (v) => `${Math.round(v)}` },
        },
      }),
    [registrationLabels],
  );

  const registrationsSeries = useMemo(
    () => [{ name: 'New users', data: registrationSeries.map((r) => r.newUserCount) }],
    [registrationSeries],
  );

  const cohortChartOptions = useMemo<ApexOptions>(
    () =>
      baseChartOptions({
        colors: [CHART_COLORS.success, CHART_COLORS.info],
        labels: ['New buyers', 'Returning buyers'],
        legend: { position: 'bottom' },
        plotOptions: {
          pie: {
            donut: {
              size: '65%',
              labels: {
                show: true,
                total: {
                  show: true,
                  label: 'Buyers',
                  formatter: () =>
                    `${(cohort?.newBuyersInPeriod ?? 0) + (cohort?.returningBuyersInPeriod ?? 0)}`,
                },
              },
            },
          },
        },
      }),
    [cohort?.newBuyersInPeriod, cohort?.returningBuyersInPeriod],
  );

  const cohortSeries = useMemo(
    () => [cohort?.newBuyersInPeriod ?? 0, cohort?.returningBuyersInPeriod ?? 0],
    [cohort?.newBuyersInPeriod, cohort?.returningBuyersInPeriod],
  );

  const topProductsChartOptions = useMemo<ApexOptions>(
    () =>
      baseChartOptions({
        colors: [CHART_COLORS.warning],
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 4,
            barHeight: '70%',
          },
        },
        xaxis: {
          categories: topProducts.slice(0, 8).map((p) => truncateLabel(p.productName, 28)),
          labels: {
            formatter: (v) => formatCompactVnd(Number(v)),
          },
        },
        yaxis: {
          labels: {
            maxWidth: 140,
          },
        },
        tooltip: {
          y: {
            formatter: (v) => formatVnd(v),
          },
        },
      }),
    [topProducts],
  );

  const topProductsSeries = useMemo(
    () => [{ name: 'Revenue', data: topProducts.slice(0, 8).map((p) => p.revenue) }],
    [topProducts],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!from || !to) {
      setFormError('Start date and end date are required.');
      return;
    }
    if (from > to) {
      setFormError('Start date must be on or before end date.');
      return;
    }

    setApplied({ from, to, granularity });
  }

  const chartEmpty: CSSProperties = {
    minHeight: 280,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h4 className="card-title mb-0">Customer insights filters</h4>
        </div>
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={handleSubmit}>
            <div className="col-md-3">
              <label htmlFor="insights-from" className="form-label">
                From
              </label>
              <AdminDatePicker
                id="insights-from"
                value={from}
                maxDate={to || undefined}
                onChange={setFrom}
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="insights-to" className="form-label">
                To
              </label>
              <AdminDatePicker
                id="insights-to"
                value={to}
                minDate={from || undefined}
                onChange={setTo}
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="insights-granularity" className="form-label">
                Granularity
              </label>
              <AdminSelect
                id="insights-granularity"
                value={granularity}
                options={ADMIN_INSIGHT_GRANULARITY_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                onChange={(next) => setGranularity(next as AdminCustomerInsightsGranularity)}
              />
            </div>
            <div className="col-md-3">
              <button type="submit" className="btn btn-primary w-100">
                Apply filters
              </button>
            </div>
          </form>
          {formError ? (
            <p className="text-danger mb-0 mt-3" role="alert">
              {formError}
            </p>
          ) : null}
          {error ? (
            <p className="text-danger mb-0 mt-3" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <AiAnalyticsBriefCard audience="admin" from={applied.from} to={applied.to} />
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Total users"
            value={loading && !summary ? '…' : (summary?.totalUsers ?? 0)}
            unit={`${summary?.activeUsers ?? 0} active`}
            icon="solar:users-group-rounded-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="New users"
            value={loading && !summary ? '…' : (summary?.newUsersInPeriod ?? 0)}
            unit="In period"
            icon="solar:user-plus-bold-duotone"
            tone="info"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Orders"
            value={loading && !summary ? '…' : (summary?.orderCountInPeriod ?? 0)}
            unit={`${summary?.unitsSoldInPeriod ?? 0} units`}
            icon="solar:bag-check-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="GMV"
            value={loading && !summary ? '…' : formatVnd(summary?.gmvInPeriod ?? 0)}
            unit={insights?.currency ?? 'VND'}
            icon="solar:wallet-money-bold-duotone"
            tone="warning"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Locked users"
            value={loading && !summary ? '…' : (summary?.lockedUsers ?? 0)}
            icon="solar:lock-keyhole-bold-duotone"
            tone="danger"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Buyers with orders"
            value={loading && !summary ? '…' : (summary?.buyersWithOrdersInPeriod ?? 0)}
            unit="In period"
            icon="solar:cart-large-2-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="New buyers"
            value={loading && !cohort ? '…' : (cohort?.newBuyersInPeriod ?? 0)}
            unit="First order"
            icon="solar:user-speak-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Returning buyers"
            value={loading && !cohort ? '…' : (cohort?.returningBuyersInPeriod ?? 0)}
            unit="Repeat"
            icon="solar:restart-bold-duotone"
            tone="info"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-8">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title">Orders & GMV trend</h4>
              {loading && !insights ? (
                <div style={chartEmpty}>
                  <span className="text-muted">Loading chart…</span>
                </div>
              ) : orderSeries.length === 0 ? (
                <div style={chartEmpty}>
                  <span className="text-muted">No paid orders in this date range.</span>
                </div>
              ) : (
                <AdminApexChart
                  type="line"
                  height={340}
                  options={ordersGmvChartOptions}
                  series={ordersGmvSeries}
                />
              )}
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title">Buyer cohort</h4>
              {loading && !insights ? (
                <div style={chartEmpty}>
                  <span className="text-muted">Loading chart…</span>
                </div>
              ) : (cohort?.newBuyersInPeriod ?? 0) + (cohort?.returningBuyersInPeriod ?? 0) === 0 ? (
                <div style={chartEmpty}>
                  <span className="text-muted">No buyer cohort data in this range.</span>
                </div>
              ) : (
                <AdminApexChart
                  type="donut"
                  height={340}
                  options={cohortChartOptions}
                  series={cohortSeries}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-7">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title">New registrations trend</h4>
              {loading && !insights ? (
                <div style={chartEmpty}>
                  <span className="text-muted">Loading chart…</span>
                </div>
              ) : registrationSeries.length === 0 ? (
                <div style={chartEmpty}>
                  <span className="text-muted">No registrations in this date range.</span>
                </div>
              ) : (
                <AdminApexChart
                  type="area"
                  height={320}
                  options={registrationsChartOptions}
                  series={registrationsSeries}
                />
              )}
            </div>
          </div>
        </div>
        <div className="col-xl-5">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title">Top products by revenue</h4>
              {loading && !insights ? (
                <div style={chartEmpty}>
                  <span className="text-muted">Loading chart…</span>
                </div>
              ) : topProducts.length === 0 ? (
                <div style={chartEmpty}>
                  <span className="text-muted">No product sales in this range.</span>
                </div>
              ) : (
                <AdminApexChart
                  type="bar"
                  height={320}
                  options={topProductsChartOptions}
                  series={topProductsSeries}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-7">
          <PeriodOrdersTable
            loading={loading && !insights}
            rows={ordersPage.items}
            granularity={granularityLabel}
            maxGmv={maxGmv}
            page={ordersPage.page}
            pageSize={ordersPage.pageSize}
            total={ordersPage.total}
            onPageChange={ordersPage.setPage}
          />
        </div>
        <div className="col-xl-5">
          <TopProductsTable
            loading={loading && !insights}
            rows={productsPage.items}
            page={productsPage.page}
            pageSize={productsPage.pageSize}
            total={productsPage.total}
            onPageChange={productsPage.setPage}
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <RegistrationsTable
            loading={loading && !insights}
            rows={registrationsPage.items}
            granularity={granularityLabel}
            maxRegs={maxRegs}
            page={registrationsPage.page}
            pageSize={registrationsPage.pageSize}
            total={registrationsPage.total}
            onPageChange={registrationsPage.setPage}
          />
        </div>
      </div>
    </>
  );
}

function PeriodOrdersTable({
  loading,
  rows,
  granularity,
  maxGmv,
  page,
  pageSize,
  total,
  onPageChange,
}: {
  loading: boolean;
  rows: AdminCustomerInsightPeriod[];
  granularity: string;
  maxGmv: number;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Orders & GMV by period</h4>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-hover table-centered">
            <thead className="bg-light-subtle">
              <tr>
                <th>Period</th>
                <th>Orders</th>
                <th>Units</th>
                <th>GMV</th>
                <th style={{ minWidth: 120 }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">
                    Loading insights…
                  </td>
                </tr>
              ) : null}
              {!loading && total === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">
                    No paid orders in this date range.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={`order-${row.periodKey}`}>
                  <td className="fw-medium">{formatInsightPeriodLabel(row.periodKey, granularity)}</td>
                  <td>{row.orderCount}</td>
                  <td>{row.unitsSold}</td>
                  <td>{formatVnd(row.gmv)}</td>
                  <td>
                    <div className="progress progress-sm mb-0" style={{ height: 8 }}>
                      <div
                        className="progress-bar bg-primary"
                        role="progressbar"
                        style={{ width: `${Math.round((row.gmv / maxGmv) * 100)}%` }}
                        aria-valuenow={row.gmv}
                        aria-valuemin={0}
                        aria-valuemax={maxGmv}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </div>
  );
}

function TopProductsTable({
  loading,
  rows,
  page,
  pageSize,
  total,
  onPageChange,
}: {
  loading: boolean;
  rows: AdminCustomerInsightTopProduct[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Top products</h4>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-hover table-centered">
            <thead className="bg-light-subtle">
              <tr>
                <th>Product</th>
                <th>Units</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    Loading insights…
                  </td>
                </tr>
              ) : null}
              {!loading && total === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    No product sales in this range.
                  </td>
                </tr>
              ) : null}
              {rows.map((p) => (
                <tr key={p.productId}>
                  <td className="fw-medium">{p.productName}</td>
                  <td>{p.unitsSold}</td>
                  <td>{p.orderCount}</td>
                  <td>{formatVnd(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </div>
  );
}

function RegistrationsTable({
  loading,
  rows,
  granularity,
  maxRegs,
  page,
  pageSize,
  total,
  onPageChange,
}: {
  loading: boolean;
  rows: AdminCustomerInsightPeriod[];
  granularity: string;
  maxRegs: number;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">New registrations by period</h4>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-hover table-centered">
            <thead className="bg-light-subtle">
              <tr>
                <th>Period</th>
                <th>New users</th>
                <th style={{ minWidth: 160 }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-muted">
                    Loading insights…
                  </td>
                </tr>
              ) : null}
              {!loading && total === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-muted">
                    No registrations in this date range.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={`reg-${row.periodKey}`}>
                  <td className="fw-medium">{formatInsightPeriodLabel(row.periodKey, granularity)}</td>
                  <td>{row.newUserCount}</td>
                  <td>
                    <div className="progress progress-sm mb-0" style={{ height: 8 }}>
                      <div
                        className="progress-bar bg-info"
                        role="progressbar"
                        style={{
                          width: `${Math.round((row.newUserCount / maxRegs) * 100)}%`,
                        }}
                        aria-valuenow={row.newUserCount}
                        aria-valuemin={0}
                        aria-valuemax={maxRegs}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </div>
  );
}

function truncateLabel(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function formatCompactVnd(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}
