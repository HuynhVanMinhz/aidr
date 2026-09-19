import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AdminDatePicker } from '../../components/admin/AdminDatePicker';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import {
  StockVoucherModal,
  type StockVoucherRow,
} from '../../components/seller/StockVoucherModal';
import { listSellerStockImports } from '../../services/sellerInventoryApi';
import type { SellerStockImportListItem, SellerStockImportSummary } from '../../types/sellerInventory';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  formatDateTime,
  formatVnd,
  sellerLotStatusBadgeClass,
} from '../../utils/sellerProductUi';

const PAGE_SIZE = 20;

const emptySummary: SellerStockImportSummary = {
  lotCount: 0,
  openLotCount: 0,
  unitsReceived: 0,
  unitsRemaining: 0,
};

export function SellerStockImportHistoryPage() {
  const [items, setItems] = useState<SellerStockImportListItem[]>([]);
  const [summary, setSummary] = useState<SellerStockImportSummary>(emptySummary);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [voucherLot, setVoucherLot] = useState<SellerStockImportListItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, from, to]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listSellerStockImports({
      q: debouncedQ || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !result.data) {
          throw new Error(result.message || 'Unable to load import history.');
        }
        setItems(result.data.items);
        setSummary(result.data.summary);
        setTotalCount(result.data.totalCount);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err));
          setItems([]);
          setSummary(emptySummary);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQ, status, from, to, page]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setDebouncedQ(q.trim());
    setPage(1);
  }

  const voucherRows: StockVoucherRow[] = voucherLot
    ? [
        { label: 'Lot code', value: voucherLot.lotCode },
        { label: 'Product', value: voucherLot.productName },
        { label: 'Variant', value: voucherLot.variantName?.trim() || 'Default' },
        { label: 'Quantity received', value: String(voucherLot.quantityReceived) },
        { label: 'Quantity remaining', value: String(voucherLot.quantityRemaining) },
        { label: 'Unit cost', value: formatVnd(voucherLot.unitCost) },
        {
          label: 'Supplier',
          value: voucherLot.supplierName?.trim() || 'No supplier listed',
        },
        {
          label: 'Supplier invoice',
          value: voucherLot.invoiceNumber?.trim() || '-',
        },
        { label: 'Status', value: voucherLot.status },
      ]
    : [];

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Import lots"
            value={summary.lotCount}
            unit="Lots"
            icon="solar:clipboard-list-broken"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Open lots"
            value={summary.openLotCount}
            unit="Active"
            icon="solar:box-broken"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Units received"
            value={summary.unitsReceived}
            unit="Items"
            icon="solar:login-3-broken"
            tone="info"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Units remaining"
            value={summary.unitsRemaining}
            unit="On hand"
            icon="solar:reorder-broken"
            tone="warning"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h4 className="card-title mb-0">Import history</h4>
                <p className="text-muted mb-0 fs-13 mt-1">
                  Stock lots received into your shop. Print a stock-in voucher anytime.
                </p>
              </div>
              <Link to="/seller/inventory" className="btn btn-sm btn-outline-light">
                Back to inventory
              </Link>
            </div>

            <div className="card-body border-bottom">
              <form className="row g-2 align-items-end" onSubmit={handleSearchSubmit}>
                <div className="col-md-3">
                  <label htmlFor="import-history-q" className="form-label">
                    Search
                  </label>
                  <input
                    id="import-history-q"
                    type="search"
                    className="form-control form-control-sm"
                    placeholder="Product, lot, supplier, invoice…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <label htmlFor="import-history-status" className="form-label">
                    Status
                  </label>
                  <AdminSelect
                    id="import-history-status"
                    size="sm"
                    value={status}
                    options={[
                      { value: '', label: 'All statuses' },
                      { value: 'Open', label: 'Open' },
                      { value: 'Depleted', label: 'Depleted' },
                      { value: 'Void', label: 'Void' },
                    ]}
                    onChange={setStatus}
                  />
                </div>
                <div className="col-md-2">
                  <label htmlFor="import-history-from" className="form-label">
                    From
                  </label>
                  <AdminDatePicker
                    id="import-history-from"
                    value={from}
                    maxDate={to || undefined}
                    onChange={setFrom}
                    className="form-control form-control-sm"
                  />
                </div>
                <div className="col-md-2">
                  <label htmlFor="import-history-to" className="form-label">
                    To
                  </label>
                  <AdminDatePicker
                    id="import-history-to"
                    value={to}
                    minDate={from || undefined}
                    onChange={setTo}
                    className="form-control form-control-sm"
                  />
                </div>
                <div className="col-md-3 d-flex gap-2">
                  <button type="submit" className="btn btn-sm btn-primary">
                    Search
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light"
                    onClick={() => {
                      setQ('');
                      setDebouncedQ('');
                      setStatus('');
                      setFrom('');
                      setTo('');
                      setPage(1);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>

            {error ? (
              <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                {error}
              </div>
            ) : null}

            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover table-centered">
                <thead className="bg-light-subtle">
                  <tr>
                    <th>Received</th>
                    <th>Product</th>
                    <th>Lot</th>
                    <th>Qty</th>
                    <th>Unit cost</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        Loading…
                      </td>
                    </tr>
                  ) : null}
                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        No stock imports yet.{' '}
                        <Link to="/seller/inventory" className="alert-link">
                          Open inventory
                        </Link>{' '}
                        to receive a lot.
                      </td>
                    </tr>
                  ) : null}
                  {items.map((item) => (
                    <tr key={item.lotId}>
                      <td className="text-nowrap">{formatDateTime(item.receivedAt)}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="rounded bg-light avatar-md d-flex align-items-center justify-content-center overflow-hidden">
                            {item.primaryImageUrl ? (
                              <img src={item.primaryImageUrl} alt="" className="avatar-md" />
                            ) : (
                              <IconifyIcon
                                icon="solar:box-bold-duotone"
                                className="fs-24 text-muted"
                              />
                            )}
                          </div>
                          <div>
                            <Link
                              to={`/seller/products/${item.productId}/inventory`}
                              className="text-dark fw-medium fs-15"
                            >
                              {item.productName}
                            </Link>
                            {item.variantName ? (
                              <p className="text-muted mb-0 fs-13">{item.variantName}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="fw-medium">{item.lotCode}</div>
                        {item.invoiceNumber ? (
                          <div className="text-muted fs-13">Inv. {item.invoiceNumber}</div>
                        ) : null}
                      </td>
                      <td>
                        <div>
                          {item.quantityRemaining} / {item.quantityReceived}
                        </div>
                        <div className="text-muted fs-13">remaining / received</div>
                      </td>
                      <td>{formatVnd(item.unitCost)}</td>
                      <td>{item.supplierName?.trim() || '-'}</td>
                      <td>
                        <span className={`badge ${sellerLotStatusBadgeClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-soft-primary"
                            onClick={() => setVoucherLot(item)}
                          >
                            Voucher
                          </button>
                          <Link
                            to={`/seller/products/${item.productId}/inventory`}
                            className="btn btn-sm btn-soft-secondary"
                          >
                            Product
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={totalCount}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>

      <StockVoucherModal
        open={voucherLot != null}
        kind="in"
        title="Stock-in voucher"
        productName={voucherLot?.productName ?? ''}
        voucherCode={voucherLot?.lotCode ?? ''}
        occurredAt={voucherLot?.receivedAt ?? ''}
        rows={voucherRows}
        note={voucherLot?.note}
        onClose={() => setVoucherLot(null)}
      />
    </>
  );
}
