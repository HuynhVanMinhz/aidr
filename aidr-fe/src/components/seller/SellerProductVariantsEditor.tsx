import { useState } from 'react';
import { IconifyIcon } from '../admin/IconifyIcon';
import { TagsField } from '../admin/TagsField';
import { parseTagList, serializeTagList } from '../../utils/structuredJson';
import { formatVnd } from '../../utils/sellerProductUi';
import {
  combinationCount,
  MAX_VARIANT_OPTIONS,
  MAX_VARIANTS,
  regenerateVariantGrid,
  variantLabel,
  type VariantDraft,
  type VariantOptionDraft,
} from '../../utils/sellerProductVariants';

type Props = {
  options: VariantOptionDraft[];
  rows: VariantDraft[];
  onOptionsChange: (options: VariantOptionDraft[]) => void;
  onRowsChange: (rows: VariantDraft[]) => void;
  /** Seeds the price of freshly generated rows so the seller is not typing the same number. */
  fallbackPrice: string;
  rowErrors: Record<string, string>;
  formError: string | null;
  disabled?: boolean;
};

/**
 * Declaring the axes and pricing the grid they produce.
 *
 * The two halves are deliberately separate steps: editing an axis does not silently rewrite
 * the grid underneath the seller, because a regeneration drops the rows for combinations
 * that no longer exist. "Generate" is an explicit action, and the pending-changes hint says
 * when it is worth pressing.
 *
 * Styling follows the seller area's own conventions — Bootstrap buttons and utilities, the
 * same as KeyValueField and the inventory tables — rather than the storefront theme.
 */
export function SellerProductVariantsEditor({
  options,
  rows,
  onOptionsChange,
  onRowsChange,
  fallbackPrice,
  rowErrors,
  formError,
  disabled,
}: Props) {
  const [bulkPrice, setBulkPrice] = useState('');
  const [generateHint, setGenerateHint] = useState<string | null>(null);

  const expected = combinationCount(options);
  const enabled = options.length > 0;
  // Regenerating is worth doing when the grid no longer matches the axes.
  const stale = enabled && expected !== rows.length;

  function patchOption(index: number, patch: Partial<VariantOptionDraft>) {
    onOptionsChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function addOption() {
    if (options.length >= MAX_VARIANT_OPTIONS) return;
    onOptionsChange([...options, { name: '', values: [] }]);
  }

  function removeOption(index: number) {
    const next = options.filter((_, i) => i !== index);
    onOptionsChange(next);
    onRowsChange(next.length === 0 ? [] : regenerateVariantGrid(next, rows, { price: fallbackPrice }));
  }

  function generate() {
    const next = regenerateVariantGrid(options, rows, { price: fallbackPrice });
    const added = next.filter((r) => !rows.some((prev) => prev.key === r.key)).length;
    const removed = rows.filter((r) => !next.some((n) => n.key === r.key)).length;
    onRowsChange(next);
    if (next.length === 0) {
      setGenerateHint('Add option names and values first, then generate again.');
    } else if (added === 0 && removed === 0) {
      setGenerateHint(
        `List already has ${next.length} variant${next.length === 1 ? '' : 's'} — nothing new to add.`,
      );
    } else {
      const parts: string[] = [`Showing ${next.length} variant${next.length === 1 ? '' : 's'}`];
      if (added) parts.push(`${added} added`);
      if (removed) parts.push(`${removed} removed`);
      setGenerateHint(`${parts.join(' · ')}. Set price (and optional sale price) on each row.`);
    }
  }

  function patchRow(key: string, patch: Partial<VariantDraft>) {
    onRowsChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function applyBulkPrice() {
    if (!bulkPrice.trim()) return;
    onRowsChange(rows.map((r) => ({ ...r, price: bulkPrice.trim() })));
  }

  if (!enabled) {
    return (
      <>
        <p className="text-muted fs-13 mb-2">
          This product is sold at a single price. Add options if the price differs by
          configuration — for example an iPhone that costs more in 256GB than in 128GB.
        </p>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          disabled={disabled}
          onClick={() => onOptionsChange([{ name: '', values: [] }])}
        >
          <IconifyIcon icon="solar:add-circle-outline" className="me-1" />
          Add variant options
        </button>
      </>
    );
  }

  return (
    <>
      {options.map((option, index) => (
        <div className="variant-option border rounded p-3 mb-2" key={index}>
          <div className="d-flex align-items-start gap-2 mb-2">
            <input
              type="text"
              className="form-control"
              placeholder="Option name (e.g. Color)"
              value={option.name}
              disabled={disabled}
              onChange={(e) => patchOption(index, { name: e.target.value })}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-danger variant-option__remove"
              aria-label={`Remove option ${option.name || index + 1}`}
              disabled={disabled}
              onClick={() => removeOption(index)}
            >
              <IconifyIcon icon="solar:trash-bin-trash-outline" />
            </button>
          </div>
          <TagsField
            value={serializeTagList(option.values)}
            onChange={(json) => patchOption(index, { values: parseTagList(json).value })}
            placeholder="Type a value and press Enter (e.g. Orange)"
          />
        </div>
      ))}

      <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          disabled={disabled || options.length >= MAX_VARIANT_OPTIONS}
          onClick={addOption}
        >
          <IconifyIcon icon="solar:add-circle-outline" className="me-1" />
          Add option
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={disabled || expected === 0}
          onClick={generate}
        >
          <IconifyIcon icon="solar:refresh-outline" className="me-1" />
          Generate {expected} variant{expected === 1 ? '' : 's'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger ms-auto"
          disabled={disabled}
          onClick={() => {
            onOptionsChange([]);
            onRowsChange([]);
          }}
        >
          Remove all options
        </button>
      </div>

      {expected > MAX_VARIANTS && (
        <p className="text-warning fs-13 mt-2 mb-0">
          These options produce {expected} combinations; only the first {MAX_VARIANTS} will be
          created. Reduce the number of values.
        </p>
      )}
      {stale && expected <= MAX_VARIANTS && (
        <p className="text-warning fs-13 mt-2 mb-0">
          The options changed. Press Generate to rebuild the list — combinations that no longer
          exist will be removed.
        </p>
      )}
      {generateHint && !stale && (
        <p className="text-muted fs-13 mt-2 mb-0" role="status">
          {generateHint}
        </p>
      )}
      {formError && <p className="form-field-error invalid-feedback d-block mt-2">{formError}</p>}

      {rows.length > 0 && (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <input
              type="number"
              min={0}
              step={1000}
              className="form-control form-control-sm variant-bulk-price"
              placeholder="Price for every variant"
              value={bulkPrice}
              disabled={disabled}
              onChange={(e) => setBulkPrice(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={disabled || !bulkPrice.trim()}
              onClick={applyBulkPrice}
            >
              Apply to all
            </button>
          </div>

          <div className="table-responsive mt-2">
            <table className="table table-hover align-middle variant-table mb-0">
              <thead className="bg-light-subtle">
                <tr>
                  <th>Configuration</th>
                  <th>SKU</th>
                  <th>Price (VND)</th>
                  <th>Sale price</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const error = rowErrors[row.key];
                  const price = Number(row.price);
                  return (
                    <tr key={row.key}>
                      <td>
                        <span className="fw-medium">{variantLabel(options, row.attributes)}</span>
                        {error && (
                          <span className="d-block text-danger fs-12 text-wrap">{error}</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Optional"
                          value={row.sku}
                          disabled={disabled}
                          onChange={(e) => patchRow(row.key, { sku: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          className={`form-control form-control-sm${error ? ' is-invalid' : ''}`}
                          value={row.price}
                          disabled={disabled}
                          onChange={(e) => patchRow(row.key, { price: e.target.value })}
                        />
                        {row.price.trim() && Number.isFinite(price) ? (
                          <span className="d-block text-muted fs-12 mt-1">{formatVnd(price)}</span>
                        ) : null}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          className="form-control form-control-sm"
                          placeholder="None"
                          value={row.salePrice}
                          disabled={disabled}
                          onChange={(e) => patchRow(row.key, { salePrice: e.target.value })}
                        />
                      </td>
                      <td>
                        {/* Stock is owned by Inventory: it is summed from the lots a seller
                            imports against this variant, so it is shown, never typed. */}
                        <span className="text-muted fs-13">
                          {row.variantId == null
                            ? 'Add stock in Inventory'
                            : `${row.stockQuantity ?? 0} in stock`}
                        </span>
                      </td>
                      <td>
                        <div className="form-check form-switch mb-0">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`variant-active-${row.key}`}
                            checked={row.isActive}
                            disabled={disabled}
                            onChange={(e) => patchRow(row.key, { isActive: e.target.checked })}
                          />
                          <label
                            className="form-check-label fs-13"
                            htmlFor={`variant-active-${row.key}`}
                          >
                            {row.isActive ? 'On sale' : 'Hidden'}
                          </label>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-muted fs-13 mt-2 mb-0">
            With variants, the product&apos;s own base price becomes the cheapest variant, which
            is what the storefront shows as &ldquo;from&rdquo;. Stock for each configuration comes
            from Inventory, one lot at a time.
          </p>
        </>
      )}
    </>
  );
}
