import type { VariantDraft } from '../../utils/sellerProductVariants';

/** What the seller typed for one configuration. Blank means "receive nothing". */
export type StockDraft = {
  quantity: string;
  unitCost: string;
};

/** The key a single-configuration product's stock is filed under. */
export const SINGLE_STOCK_KEY = '__single';

export type StockDelivery = {
  rows: Record<string, StockDraft>;
  lotCode: string;
  supplierName: string;
  invoiceNumber: string;
  note: string;
};

export const emptyStockDelivery = (): StockDelivery => ({
  rows: {},
  lotCode: '',
  supplierName: '',
  invoiceNumber: '',
  note: '',
});

export function stockRowOf(delivery: StockDelivery, key: string): StockDraft {
  return delivery.rows[key] ?? { quantity: '', unitCost: '' };
}

/** Rows the seller actually filled in - the rest are simply not a delivery. */
export function filledStockRows(delivery: StockDelivery): Array<{ key: string } & StockDraft> {
  return Object.entries(delivery.rows)
    .filter(([, row]) => row.quantity.trim() !== '' || row.unitCost.trim() !== '')
    .map(([key, row]) => ({ key, ...row }));
}

/**
 * Validates the delivery on its own terms. Quantity and cost travel together:
 * a quantity with no cost would land in the lot ledger with nothing to cost the
 * eventual sale against, and a cost with no quantity receives nothing.
 */
export function validateStockDelivery(delivery: StockDelivery): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const row of filledStockRows(delivery)) {
    const quantity = Number(row.quantity);
    const unitCost = Number(row.unitCost);

    if (!row.quantity.trim()) {
      errors[row.key] = 'Enter a quantity, or clear the unit cost.';
    } else if (!Number.isInteger(quantity) || quantity <= 0) {
      errors[row.key] = 'Quantity must be a whole number above zero.';
    } else if (!row.unitCost.trim()) {
      errors[row.key] = 'Enter what you paid per unit for this lot.';
    } else if (!Number.isFinite(unitCost) || unitCost < 0) {
      errors[row.key] = 'Unit cost must be zero or more.';
    }
  }

  return errors;
}

type ProductStockSectionProps = {
  mode: 'create' | 'edit';
  /** Empty when the product is sold as a single configuration. */
  variantRows: VariantDraft[];
  /** Stock already held, shown for context on a single-configuration product. */
  currentStock?: number;
  delivery: StockDelivery;
  onChange: (next: StockDelivery) => void;
  errors: Record<string, string>;
  disabled?: boolean;
};

/**
 * Receiving stock while adding or editing a product.
 *
 * Deliberately not a "stock level" field. Stock here is held as FIFO lots that
 * each carry the cost paid for them, so the only honest thing a form can do is
 * receive a new lot; overwriting a level would leave the units already sold
 * costed against a number nobody ever paid.
 */
export function ProductStockSection({
  mode,
  variantRows,
  currentStock,
  delivery,
  onChange,
  errors,
  disabled,
}: ProductStockSectionProps) {
  const hasVariants = variantRows.length > 0;

  function setRow(key: string, patch: Partial<StockDraft>) {
    onChange({
      ...delivery,
      rows: { ...delivery.rows, [key]: { ...stockRowOf(delivery, key), ...patch } },
    });
  }

  function setField(key: keyof Omit<StockDelivery, 'rows'>, value: string) {
    onChange({ ...delivery, [key]: value });
  }

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="card-title mb-1">{mode === 'create' ? 'Opening stock' : 'Receive stock'}</h4>
        <p className="text-muted fs-13 mb-0">
          {mode === 'create'
            ? 'Optional. Fill this in to stock the product as soon as it is created.'
            : 'Optional. This adds a new lot on top of what you already hold - it never rewrites existing stock or its cost.'}
        </p>
      </div>
      <div className="card-body">
        {hasVariants ? (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Variant</th>
                  {mode === 'edit' ? <th className="text-end">On hand</th> : null}
                  <th style={{ width: 140 }}>Receive qty</th>
                  <th style={{ width: 180 }}>Unit cost</th>
                </tr>
              </thead>
              <tbody>
                {variantRows.map((variant) => {
                  const row = stockRowOf(delivery, variant.key);
                  const label =
                    Object.values(variant.attributes).filter(Boolean).join(' / ') ||
                    variant.sku ||
                    'Variant';

                  return (
                    <tr key={variant.key}>
                      <td>
                        <span className="d-block">{label}</span>
                        {variant.sku ? (
                          <span className="text-muted fs-12">{variant.sku}</span>
                        ) : null}
                      </td>
                      {mode === 'edit' ? (
                        <td className="text-end">
                          {variant.stockQuantity ?? <span className="text-muted">-</span>}
                        </td>
                      ) : null}
                      <td>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className={`form-control form-control-sm${errors[variant.key] ? ' is-invalid' : ''}`}
                          value={row.quantity}
                          disabled={disabled}
                          onChange={(e) => setRow(variant.key, { quantity: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className={`form-control form-control-sm${errors[variant.key] ? ' is-invalid' : ''}`}
                          value={row.unitCost}
                          disabled={disabled}
                          onChange={(e) => setRow(variant.key, { unitCost: e.target.value })}
                        />
                        {errors[variant.key] ? (
                          <div className="invalid-feedback d-block fs-12">
                            {errors[variant.key]}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="row">
            <div className="col-lg-6">
              <label className="form-label" htmlFor="stock-quantity">
                Receive quantity
                {mode === 'edit' && currentStock !== undefined ? (
                  <span className="text-muted fw-normal"> · {currentStock} on hand</span>
                ) : null}
              </label>
              <input
                id="stock-quantity"
                type="number"
                min={1}
                step={1}
                className={`form-control${errors[SINGLE_STOCK_KEY] ? ' is-invalid' : ''}`}
                value={stockRowOf(delivery, SINGLE_STOCK_KEY).quantity}
                disabled={disabled}
                onChange={(e) => setRow(SINGLE_STOCK_KEY, { quantity: e.target.value })}
              />
            </div>
            <div className="col-lg-6">
              <label className="form-label" htmlFor="stock-unit-cost">
                Unit cost
              </label>
              <input
                id="stock-unit-cost"
                type="number"
                min={0}
                className={`form-control${errors[SINGLE_STOCK_KEY] ? ' is-invalid' : ''}`}
                value={stockRowOf(delivery, SINGLE_STOCK_KEY).unitCost}
                disabled={disabled}
                onChange={(e) => setRow(SINGLE_STOCK_KEY, { unitCost: e.target.value })}
              />
              {errors[SINGLE_STOCK_KEY] ? (
                <div className="invalid-feedback d-block fs-12">{errors[SINGLE_STOCK_KEY]}</div>
              ) : null}
              <p className="text-muted fs-12 mt-1 mb-0">
                What you paid per unit. It costs this lot only; earlier lots keep theirs.
              </p>
            </div>
          </div>
        )}

        <div className="row mt-3">
          <div className="col-lg-4">
            <label className="form-label" htmlFor="stock-lot-code">
              Lot code <span className="text-muted fw-normal">optional</span>
            </label>
            <input
              id="stock-lot-code"
              type="text"
              className="form-control"
              value={delivery.lotCode}
              disabled={disabled}
              onChange={(e) => setField('lotCode', e.target.value)}
            />
          </div>
          <div className="col-lg-4">
            <label className="form-label" htmlFor="stock-supplier">
              Supplier <span className="text-muted fw-normal">optional</span>
            </label>
            <input
              id="stock-supplier"
              type="text"
              className="form-control"
              value={delivery.supplierName}
              disabled={disabled}
              onChange={(e) => setField('supplierName', e.target.value)}
            />
          </div>
          <div className="col-lg-4">
            <label className="form-label" htmlFor="stock-invoice">
              Invoice no. <span className="text-muted fw-normal">optional</span>
            </label>
            <input
              id="stock-invoice"
              type="text"
              className="form-control"
              value={delivery.invoiceNumber}
              disabled={disabled}
              onChange={(e) => setField('invoiceNumber', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
