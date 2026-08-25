import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { FormField } from '../../components/admin/FormField';
import { useSellerInventory } from '../../hooks/useSellerInventory';
import { useToast } from '../../hooks/useToast';
import type { SellerInventoryLot } from '../../types/sellerInventory';
import { visibleFieldErrors } from '../../utils/formValidation';
import {
  buildAdjustPayload,
  buildImportLotPayload,
  buildLowStockPayload,
  buildSellingPricePayload,
  canSubmitAdjustForm,
  canSubmitImportLotForm,
  canSubmitLowStockForm,
  canSubmitSellingPriceForm,
  emptyAdjustForm,
  emptyImportLotForm,
  validateAdjustForm,
  validateImportLotForm,
  validateLowStockForm,
  validateSellingPriceForm,
  type AdjustInventoryFormValues,
  type ImportLotFormValues,
  type LowStockFormValues,
  type SellingPriceFormValues,
} from '../../utils/sellerInventoryValidation';
import {
  formatDateTime,
  formatVnd,
  sellerLotStatusBadgeClass,
  sellerProductStatusBadgeClass,
} from '../../utils/sellerProductUi';

export function SellerInventoryDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { detail, detailLoading, detailError, mutating, loadOne, importLot, adjust, updatePrice, updateThreshold } =
    useSellerInventory();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void loadOne(id).catch(() => undefined);
  }, [id, loadOne]);

  if (detailLoading && !detail) {
    return <div className="text-muted py-5 text-center">Loading inventory...</div>;
  }

  if (detailError || !detail) {
    return (
      <div className="alert alert-danger" role="alert">
        {detailError || 'Product inventory not found.'}{' '}
        <Link to="/seller/inventory" className="alert-link">
          Back to inventory
        </Link>
      </div>
    );
  }

  const isDeleted = detail.status === 'Deleted';

  return (
    <>
      {actionError ? (
        <div className="alert alert-danger" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-1">{detail.name}</h4>
          <span className={sellerProductStatusBadgeClass(detail.status)}>{detail.status}</span>
          {detail.isLowStock ? (
            <span className="badge bg-warning-subtle text-warning ms-2">Low stock</span>
          ) : null}
        </div>
        <div className="d-flex gap-2">
          <Link to="/seller/inventory" className="btn btn-sm btn-light">
            Back to inventory
          </Link>
          <Link to={`/seller/products/${detail.productId}`} className="btn btn-sm btn-outline-light">
            Product details
          </Link>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="On hand"
            value={detail.stockQuantity}
            unit="Items"
            icon="solar:box-broken"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Reserved"
            value={detail.reservedQuantity}
            unit="Items"
            icon="solar:bag-check-broken"
            tone="info"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Available"
            value={detail.availableQuantity}
            unit="Sellable"
            icon="solar:cart-large-2-broken"
            tone={detail.isLowStock ? 'warning' : 'success'}
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Avg cost"
            value={detail.avgCostPrice != null ? formatVnd(detail.avgCostPrice) : '—'}
            icon="solar:wad-of-money-broken"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Est. margin / unit"
            value={
              detail.estimatedMarginPerUnit != null
                ? formatVnd(detail.estimatedMarginPerUnit)
                : '—'
            }
            unit="Sell − avg cost"
            icon="solar:chart-2-bold-duotone"
            tone={
              detail.estimatedMarginPerUnit == null
                ? 'primary'
                : detail.estimatedMarginPerUnit >= 0
                  ? 'success'
                  : 'danger'
            }
          />
        </div>
      </div>

      {isDeleted ? (
        <div className="alert alert-warning" role="alert">
          This product is deleted. Inventory and prices cannot be changed.
        </div>
      ) : (
        <div className="row">
          <div className="col-xl-6">
            <ImportLotCard
              productId={detail.productId}
              mutating={mutating}
              onError={(message) => {
                setActionError(message);
                if (message) toast.error(message);
              }}
              onSuccess={async () => {
                toast.success('Stock lot imported.');
                await loadOne(detail.productId);
              }}
              submit={importLot}
            />
            <AdjustStockCard
              lots={detail.lots}
              mutating={mutating}
              onError={(message) => {
                setActionError(message);
                if (message) toast.error(message);
              }}
              onSuccess={async () => {
                toast.success('Inventory adjusted.');
                await loadOne(detail.productId);
              }}
              submit={(payload) => adjust(detail.productId, payload)}
            />
          </div>
          <div className="col-xl-6">
            <SellingPriceCard
              productId={detail.productId}
              basePrice={detail.basePrice}
              salePrice={detail.salePrice}
              lastCostPrice={detail.lastCostPrice}
              mutating={mutating}
              onError={(message) => {
                setActionError(message);
                if (message) toast.error(message);
              }}
              onSuccess={async () => {
                toast.success('Selling price updated.');
                await loadOne(detail.productId);
              }}
              submit={updatePrice}
            />
            <LowStockCard
              productId={detail.productId}
              threshold={detail.lowStockThreshold}
              mutating={mutating}
              onError={(message) => {
                setActionError(message);
                if (message) toast.error(message);
              }}
              onSuccess={async () => {
                toast.success('Low-stock threshold updated.');
                await loadOne(detail.productId);
              }}
              submit={updateThreshold}
            />
          </div>
        </div>
      )}

      <LotsTable lots={detail.lots} />
      <TransactionsTable transactions={detail.recentTransactions} />
    </>
  );
}

function ImportLotCard({
  productId,
  mutating,
  onError,
  onSuccess,
  submit,
}: {
  productId: string;
  mutating: boolean;
  onError: (message: string | null) => void;
  onSuccess: () => Promise<void>;
  submit: ReturnType<typeof useSellerInventory>['importLot'];
}) {
  const [form, setForm] = useState<ImportLotFormValues>(emptyImportLotForm);
  const [touched, setTouched] = useState<Partial<Record<keyof ImportLotFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = validateImportLotForm(form);
  const visible = visibleFieldErrors(errors, touched, submitted);
  const canSubmit = canSubmitImportLotForm(form, errors);

  function setField<K extends keyof ImportLotFormValues>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!canSubmitImportLotForm(form, validateImportLotForm(form))) return;
    onError(null);
    try {
      await submit(productId, buildImportLotPayload(form));
      setForm(emptyImportLotForm());
      setTouched({});
      setSubmitted(false);
      await onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to import stock lot.';
      onError(message);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Import stock lot</h4>
      </div>
      <div className="card-body">
        <p className="text-muted fs-13">
          Adds a new lot with its own unit cost. Existing lots are not changed.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="row">
            <div className="col-md-6">
              <FormField label="Quantity" htmlFor="lot-qty" error={visible.quantity}>
                <input
                  id="lot-qty"
                  className="form-control"
                  value={form.quantity}
                  onChange={(e) => setField('quantity', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, quantity: true }))}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Unit cost (VND)" htmlFor="lot-cost" error={visible.unitCost}>
                <input
                  id="lot-cost"
                  className="form-control"
                  value={form.unitCost}
                  onChange={(e) => setField('unitCost', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, unitCost: true }))}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Lot code (optional)" htmlFor="lot-code" error={visible.lotCode}>
                <input
                  id="lot-code"
                  className="form-control"
                  placeholder="Auto-generated if empty"
                  value={form.lotCode}
                  onChange={(e) => setField('lotCode', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, lotCode: true }))}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Supplier" htmlFor="lot-supplier" error={visible.supplierName}>
                <input
                  id="lot-supplier"
                  className="form-control"
                  value={form.supplierName}
                  onChange={(e) => setField('supplierName', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, supplierName: true }))}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Invoice number" htmlFor="lot-invoice" error={visible.invoiceNumber}>
                <input
                  id="lot-invoice"
                  className="form-control"
                  value={form.invoiceNumber}
                  onChange={(e) => setField('invoiceNumber', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, invoiceNumber: true }))}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Received at" htmlFor="lot-received" error={visible.receivedAt}>
                <input
                  id="lot-received"
                  type="datetime-local"
                  className="form-control"
                  value={form.receivedAt}
                  onChange={(e) => setField('receivedAt', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, receivedAt: true }))}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Expires at" htmlFor="lot-expires" error={visible.expiresAt}>
                <input
                  id="lot-expires"
                  type="datetime-local"
                  className="form-control"
                  value={form.expiresAt}
                  onChange={(e) => setField('expiresAt', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, expiresAt: true }))}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Note" htmlFor="lot-note" error={visible.note}>
                <input
                  id="lot-note"
                  className="form-control"
                  value={form.note}
                  onChange={(e) => setField('note', e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, note: true }))}
                />
              </FormField>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || mutating}>
            Import lot
          </button>
        </form>
      </div>
    </div>
  );
}

function AdjustStockCard({
  lots,
  mutating,
  onError,
  onSuccess,
  submit,
}: {
  lots: SellerInventoryLot[];
  mutating: boolean;
  onError: (message: string | null) => void;
  onSuccess: () => Promise<void>;
  submit: (payload: ReturnType<typeof buildAdjustPayload>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<AdjustInventoryFormValues>(emptyAdjustForm);
  const [touched, setTouched] = useState<Partial<Record<keyof AdjustInventoryFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const lotOptions = useMemo(() => {
    const usable =
      form.mode === 'increase'
        ? lots.filter((lot) => lot.status !== 'Void')
        : lots.filter((lot) => lot.status === 'Open' && lot.quantityRemaining > 0);
    return [
      { value: '', label: 'Select lot' },
      ...usable.map((lot) => ({
        value: lot.lotId,
        label: `${lot.lotCode} · ${lot.quantityRemaining} left · ${formatVnd(lot.unitCost)}`,
      })),
    ];
  }, [form.mode, lots]);

  const errors = validateAdjustForm(form);
  const visible = visibleFieldErrors(errors, touched, submitted);
  const canSubmit = canSubmitAdjustForm(form, errors);
  const showLot = form.mode === 'increase' || form.mode === 'decrease-lot';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!canSubmitAdjustForm(form, validateAdjustForm(form))) return;
    onError(null);
    try {
      await submit(buildAdjustPayload(form));
      setForm(emptyAdjustForm());
      setTouched({});
      setSubmitted(false);
      await onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to adjust inventory.';
      onError(message);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Manual stock adjustment</h4>
      </div>
      <div className="card-body">
        <p className="text-muted fs-13">
          Record a recount or write-off. Available stock cannot go below reserved quantity. Increases
          must target an existing lot.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <FormField label="Adjustment type" htmlFor="adj-mode">
            <AdminSelect
              id="adj-mode"
              value={form.mode}
              options={[
                { value: 'decrease-fifo', label: 'Decrease (oldest lots first)' },
                { value: 'decrease-lot', label: 'Decrease a specific lot' },
                { value: 'increase', label: 'Increase a specific lot' },
              ]}
              onChange={(mode) => setForm((prev) => ({ ...prev, mode: mode as AdjustInventoryFormValues['mode'] }))}
            />
          </FormField>
          <FormField label="Quantity" htmlFor="adj-qty" error={visible.quantity}>
            <input
              id="adj-qty"
              className="form-control"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, quantity: true }))}
            />
          </FormField>
          {showLot ? (
            <FormField label="Lot" htmlFor="adj-lot" error={visible.lotId}>
              <AdminSelect
                id="adj-lot"
                value={form.lotId}
                options={lotOptions}
                onChange={(lotId) => setForm((prev) => ({ ...prev, lotId }))}
                onBlur={() => setTouched((t) => ({ ...t, lotId: true }))}
              />
            </FormField>
          ) : null}
          <FormField label="Note" htmlFor="adj-note" error={visible.note}>
            <input
              id="adj-note"
              className="form-control"
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, note: true }))}
            />
          </FormField>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || mutating}>
            Apply adjustment
          </button>
        </form>
      </div>
    </div>
  );
}

function SellingPriceCard({
  productId,
  basePrice,
  salePrice,
  lastCostPrice,
  mutating,
  onError,
  onSuccess,
  submit,
}: {
  productId: string;
  basePrice: number;
  salePrice?: number | null;
  lastCostPrice?: number | null;
  mutating: boolean;
  onError: (message: string | null) => void;
  onSuccess: () => Promise<void>;
  submit: ReturnType<typeof useSellerInventory>['updatePrice'];
}) {
  const initial: SellingPriceFormValues = {
    basePrice: String(basePrice),
    salePrice: salePrice != null ? String(salePrice) : '',
    reason: '',
  };
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof SellingPriceFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setForm({
      basePrice: String(basePrice),
      salePrice: salePrice != null ? String(salePrice) : '',
      reason: '',
    });
    setTouched({});
    setSubmitted(false);
  }, [basePrice, salePrice]);

  const errors = validateSellingPriceForm(form);
  const visible = visibleFieldErrors(errors, touched, submitted);
  const canSubmit = canSubmitSellingPriceForm(form, initial, errors);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const nextErrors = validateSellingPriceForm(form);
    if (!canSubmitSellingPriceForm(form, initial, nextErrors)) return;
    onError(null);
    try {
      await submit(productId, buildSellingPricePayload(form));
      await onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update selling price.';
      onError(message);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Selling price</h4>
      </div>
      <div className="card-body">
        <p className="text-muted fs-13">
          Catalog prices only. Lot unit costs stay unchanged.
          {lastCostPrice != null ? ` Last unit cost: ${formatVnd(lastCostPrice)}.` : ''}
        </p>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <FormField label="Base price (VND)" htmlFor="price-base" error={visible.basePrice}>
            <input
              id="price-base"
              className="form-control"
              value={form.basePrice}
              onChange={(e) => setForm((prev) => ({ ...prev, basePrice: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, basePrice: true }))}
            />
          </FormField>
          <FormField label="Sale price (optional)" htmlFor="price-sale" error={visible.salePrice}>
            <input
              id="price-sale"
              className="form-control"
              placeholder="Leave empty to clear"
              value={form.salePrice}
              onChange={(e) => setForm((prev) => ({ ...prev, salePrice: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, salePrice: true }))}
            />
          </FormField>
          <FormField label="Reason" htmlFor="price-reason" error={visible.reason}>
            <input
              id="price-reason"
              className="form-control"
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, reason: true }))}
            />
          </FormField>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || mutating}>
            Save selling price
          </button>
        </form>
      </div>
    </div>
  );
}

function LowStockCard({
  productId,
  threshold,
  mutating,
  onError,
  onSuccess,
  submit,
}: {
  productId: string;
  threshold: number;
  mutating: boolean;
  onError: (message: string | null) => void;
  onSuccess: () => Promise<void>;
  submit: ReturnType<typeof useSellerInventory>['updateThreshold'];
}) {
  const initial: LowStockFormValues = { lowStockThreshold: String(threshold) };
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof LowStockFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setForm({ lowStockThreshold: String(threshold) });
    setTouched({});
    setSubmitted(false);
  }, [threshold]);

  const errors = validateLowStockForm(form);
  const visible = visibleFieldErrors(errors, touched, submitted);
  const canSubmit = canSubmitLowStockForm(form, initial, errors);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const nextErrors = validateLowStockForm(form);
    if (!canSubmitLowStockForm(form, initial, nextErrors)) return;
    onError(null);
    try {
      await submit(productId, buildLowStockPayload(form));
      await onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update inventory settings.';
      onError(message);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Low-stock threshold</h4>
      </div>
      <div className="card-body">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <FormField
            label="Alert when available units are at or below"
            htmlFor="low-stock"
            error={visible.lowStockThreshold}
          >
            <input
              id="low-stock"
              className="form-control"
              value={form.lowStockThreshold}
              onChange={(e) => setForm({ lowStockThreshold: e.target.value })}
              onBlur={() => setTouched({ lowStockThreshold: true })}
            />
          </FormField>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || mutating}>
            Save threshold
          </button>
        </form>
      </div>
    </div>
  );
}

function LotsTable({ lots }: { lots: SellerInventoryLot[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Stock lots</h4>
      </div>
      <div className="table-responsive">
        <table className="table align-middle mb-0 table-hover table-centered">
          <thead className="bg-light-subtle">
            <tr>
              <th>Lot</th>
              <th>Received</th>
              <th>Remaining</th>
              <th>Unit cost</th>
              <th>Est. margin / unit</th>
              <th>Supplier</th>
              <th>Received at</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lots.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-muted">
                  No lots yet. Import a stock lot to add inventory.
                </td>
              </tr>
            ) : (
              lots.map((lot) => (
                <tr key={lot.lotId}>
                  <td>
                    <div className="fw-medium">{lot.lotCode}</div>
                    {lot.invoiceNumber ? (
                      <small className="text-muted">{lot.invoiceNumber}</small>
                    ) : null}
                  </td>
                  <td>{lot.quantityReceived}</td>
                  <td>{lot.quantityRemaining}</td>
                  <td>{formatVnd(lot.unitCost)}</td>
                  <td>
                    {lot.estimatedMarginPerUnit != null ? (
                      <span
                        className={
                          lot.estimatedMarginPerUnit >= 0
                            ? 'text-success fw-medium'
                            : 'text-danger fw-medium'
                        }
                      >
                        {formatVnd(lot.estimatedMarginPerUnit)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{lot.supplierName || '—'}</td>
                  <td>{formatDateTime(lot.receivedAt)}</td>
                  <td>
                    <span className={sellerLotStatusBadgeClass(lot.status)}>{lot.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionsTable({
  transactions,
}: {
  transactions: import('../../types/sellerInventory').SellerInventoryTransaction[];
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-0">Recent movements</h4>
      </div>
      <div className="table-responsive">
        <table className="table align-middle mb-0 table-hover table-centered">
          <thead className="bg-light-subtle">
            <tr>
              <th>When</th>
              <th>Reason</th>
              <th>Qty</th>
              <th>Lot</th>
              <th>Unit cost</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted">
                  No inventory transactions yet.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.inventoryTxId}>
                  <td>{formatDateTime(tx.createdAt)}</td>
                  <td>{tx.reason}</td>
                  <td className={tx.changeQty < 0 ? 'text-danger' : 'text-success'}>
                    {tx.changeQty > 0 ? `+${tx.changeQty}` : tx.changeQty}
                  </td>
                  <td>{tx.lotCode || '—'}</td>
                  <td>{tx.unitCost != null ? formatVnd(tx.unitCost) : '—'}</td>
                  <td>{tx.note || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
