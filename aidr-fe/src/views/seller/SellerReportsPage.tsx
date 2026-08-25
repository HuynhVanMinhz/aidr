import { useMemo, useState, type FormEvent } from 'react';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { useSellerSalesReport } from '../../hooks/useSellerFinance';
import type { SellerSalesReportGranularity } from '../../types/sellerFinance';
import {
  defaultReportDateRange,
  formatPercent,
  formatReportPeriodLabel,
  SELLER_REPORT_GRANULARITY_OPTIONS,
} from '../../utils/sellerFinanceUi';
import { formatVnd } from '../../utils/sellerProductUi';

const defaults = defaultReportDateRange();

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

  const { report, loading, error } = useSellerSalesReport(query);

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

  const totals = report?.totals;

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
              <input
                id="report-from"
                type="date"
                className="form-control"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="report-to" className="form-label">
                To
              </label>
              <input
                id="report-to"
                type="date"
                className="form-control"
                value={to}
                onChange={(e) => setTo(e.target.value)}
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
            value={
              loading && !totals
                ? '…'
                : `${formatVnd(totals?.grossMargin ?? 0)} (${formatPercent(totals?.grossMarginPercent ?? 0)})`
            }
            icon="solar:chart-square-bold-duotone"
            tone="warning"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-7">
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
                    {loading && !report ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">
                          Loading report…
                        </td>
                      </tr>
                    ) : null}
                    {!loading && (report?.series.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">
                          No sales in this date range.
                        </td>
                      </tr>
                    ) : null}
                    {(report?.series ?? []).map((row) => (
                      <tr key={row.periodKey}>
                        <td className="fw-medium">
                          {formatReportPeriodLabel(row.periodKey, report?.granularity ?? 'day')}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-5">
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
                    {loading && !report ? (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-muted">
                          Loading report…
                        </td>
                      </tr>
                    ) : null}
                    {!loading && (report?.topProducts.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-muted">
                          No product sales in this range.
                        </td>
                      </tr>
                    ) : null}
                    {(report?.topProducts ?? []).map((row) => (
                      <tr key={row.productId}>
                        <td className="text-truncate" style={{ maxWidth: 180 }}>
                          {row.productName}
                        </td>
                        <td>{row.unitsSold}</td>
                        <td>{formatVnd(row.productRevenue)}</td>
                        <td>
                          {formatPercent(row.grossMarginPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

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
