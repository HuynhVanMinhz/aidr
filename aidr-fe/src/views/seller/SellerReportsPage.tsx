import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { ApexOptions } from 'apexcharts';
import { AdminApexChart } from '../../components/admin/AdminApexChart';
import { AiAnalyticsBriefCard } from '../../components/admin/AiAnalyticsBriefCard';
import { AdminDatePicker } from '../../components/admin/AdminDatePicker';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { useSellerSalesReport } from '../../hooks/useSellerFinance';
import type {
  SellerSalesReportGranularity,
  SellerSalesReportPeriod,
  SellerSalesReportProduct,
} from '../../types/sellerFinance';
import {
  defaultReportDateRange,
  formatPercent,
  formatReportPeriodLabel,
  SELLER_REPORT_GRANULARITY_OPTIONS,
} from '../../utils/sellerFinanceUi';
import { formatVnd } from '../../utils/sellerProductUi';

const defaults = defaultReportDateRange();
const SECTION_PAGE_SIZE = 10;

const CHART_COLORS = {
  primary: '#1c84ee',
  teal: '#4ecac2',
  success: '#22c55e',
  warning: '#f9b931',
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

export function SellerReportsPage() {
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [granularity, setGranularity] = useState<SellerSalesReportGranularity>('day');
  const [applied, setApplied] = useState({
    from: defaults.from,
    to: defaults.to,
    granularity: 'day' as SellerSalesReportGranularity,
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
  const { report, loading, error } = useSellerSalesReport(query);
  const totals = report?.totals;
  const series = report?.series ?? [];
  const topProducts = report?.topProducts ?? [];
  const granularityLabel = report?.granularity ?? applied.granularity;

  const seriesPage = useClientPagedRows(series, resetKey);
  const productsPage = useClientPagedRows(topProducts, resetKey);

  const periodLabels = useMemo(
    () => series.map((r) => formatReportPeriodLabel(r.periodKey, granularityLabel)),
    [series, granularityLabel],
  );

  const revenueMarginChartOptions = useMemo<ApexOptions>(
    () =>
      baseChartOptions({
        colors: [CHART_COLORS.primary, CHART_COLORS.success],
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
            title: { text: 'Revenue (VND)' },
            labels: {
              formatter: (v) => formatCompactVnd(v),
            },
          },
          {
            opposite: true,
            title: { text: 'Margin (VND)' },
            labels: {
              formatter: (v) => formatCompactVnd(v),
            },
          },
        ],
        tooltip: {
          shared: true,
          y: {
            formatter: (value) => formatVnd(value),
          },
        },
      }),
    [periodLabels],
  );

  const revenueMarginSeries = useMemo(
    () => [
      {
        name: 'Revenue',
        type: 'column' as const,
        data: series.map((r) => r.productRevenue),
      },
      {
        name: 'Gross margin',
        type: 'line' as const,
        data: series.map((r) => r.grossMargin),
      },
    ],
    [series],
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
    () => [{ name: 'Revenue', data: topProducts.slice(0, 8).map((p) => p.productRevenue) }],
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
          <h4 className="card-title mb-0">Sales report filters</h4>
        </div>
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={handleSubmit}>
            <div className="col-md-3">
              <label htmlFor="report-from" className="form-label">
                From
              </label>
              <AdminDatePicker
                id="report-from"
                value={from}
                maxDate={to || undefined}
                onChange={setFrom}
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="report-to" className="form-label">
                To
              </label>
              <AdminDatePicker
                id="report-to"
                value={to}
                minDate={from || undefined}
                onChange={setTo}
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="report-granularity" className="form-label">
                Granularity
              </label>
              <AdminSelect
                id="report-granularity"
                value={granularity}
                options={SELLER_REPORT_GRANULARITY_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                onChange={(next) => setGranularity(next as SellerSalesReportGranularity)}
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
          <AiAnalyticsBriefCard audience="seller" from={applied.from} to={applied.to} />
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Orders"
            value={loading && !totals ? '…' : (totals?.orderCount ?? 0)}
            unit="Paid"
            icon="solar:bag-check-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Units sold"
            value={loading && !totals ? '…' : (totals?.unitsSold ?? 0)}
            icon="solar:box-bold-duotone"
            tone="info"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Product revenue"
            value={loading && !totals ? '…' : formatVnd(totals?.productRevenue ?? 0)}
            icon="solar:wallet-money-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Gross margin"
            value={loading && !totals ? '…' : formatVnd(totals?.grossMargin ?? 0)}
            unit={loading && !totals ? undefined : formatPercent(totals?.grossMarginPercent ?? 0)}
            icon="solar:chart-square-bold-duotone"
            tone="warning"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-7">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title">Revenue & margin trend</h4>
              {loading && !report ? (
                <div style={chartEmpty}>
                  <span className="text-muted">Loading chart…</span>
                </div>
              ) : series.length === 0 ? (
                <div style={chartEmpty}>
                  <span className="text-muted">No sales in this date range.</span>
                </div>
              ) : (
                <AdminApexChart
                  type="line"
                  height={340}
                  options={revenueMarginChartOptions}
                  series={revenueMarginSeries}
                />
              )}
            </div>
          </div>
        </div>
        <div className="col-xl-5">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title">Top products by revenue</h4>
              {loading && !report ? (
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
                  height={340}
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
          <PeriodSeriesTable
            loading={loading && !report}
            rows={seriesPage.items}
            granularity={granularityLabel}
            page={seriesPage.page}
            pageSize={seriesPage.pageSize}
            total={seriesPage.total}
            onPageChange={seriesPage.setPage}
          />
        </div>
        <div className="col-xl-5">
          <TopProductsTable
            loading={loading && !report}
            rows={productsPage.items}
            page={productsPage.page}
            pageSize={productsPage.pageSize}
            total={productsPage.total}
            onPageChange={productsPage.setPage}
          />
          {totals ? (
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Period summary</h5>
                <ul className="list-group list-group-flush">
                  <li className="list-group-item d-flex justify-content-between px-0">
                    <span className="text-muted">Order revenue</span>
                    <span>{formatVnd(totals.orderRevenue)}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0">
                    <span className="text-muted">Product revenue</span>
                    <span>{formatVnd(totals.productRevenue)}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0">
                    <span className="text-muted">COGS (lot cost)</span>
                    <span>{formatVnd(totals.cogs)}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between px-0 fw-semibold">
                    <span>Gross margin</span>
                    <span>
                      {formatVnd(totals.grossMargin)} ({formatPercent(totals.grossMarginPercent)})
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function PeriodSeriesTable({
  loading,
  rows,
  granularity,
  page,
  pageSize,
  total,
  onPageChange,
}: {
  loading: boolean;
  rows: SellerSalesReportPeriod[];
  granularity: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Revenue & margin by period</h4>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table align-middle mb-0 table-hover table-centered">
            <thead className="bg-light-subtle">
              <tr>
                <th>Period</th>
                <th>Orders</th>
                <th>Units</th>
                <th>Revenue</th>
                <th>COGS</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    Loading report…
                  </td>
                </tr>
              ) : null}
              {!loading && total === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    No sales in this date range.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? rows.map((row) => (
                    <tr key={row.periodKey}>
                      <td className="fw-medium">
                        {formatReportPeriodLabel(row.periodKey, granularity)}
                      </td>
                      <td>{row.orderCount}</td>
                      <td>{row.unitsSold}</td>
                      <td>{formatVnd(row.productRevenue)}</td>
                      <td>{formatVnd(row.cogs)}</td>
                      <td>
                        {formatVnd(row.grossMargin)}
                        <span className="text-muted ms-1 fs-13">
                          ({formatPercent(row.grossMarginPercent)})
                        </span>
                      </td>
                    </tr>
                  ))
                : null}
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
  rows: SellerSalesReportProduct[];
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
                <th>Revenue</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    Loading report…
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
              {!loading
                ? rows.map((row) => (
                    <tr key={row.productId}>
                      <td className="text-truncate" style={{ maxWidth: 180 }}>
                        {row.productName}
                      </td>
                      <td>{row.unitsSold}</td>
                      <td>{formatVnd(row.productRevenue)}</td>
                      <td>{formatPercent(row.grossMarginPercent)}</td>
                    </tr>
                  ))
                : null}
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
