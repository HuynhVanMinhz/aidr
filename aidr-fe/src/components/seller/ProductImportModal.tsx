import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconifyIcon } from '../admin/IconifyIcon';
import {
  downloadSellerProductTemplate,
  importSellerProducts,
  previewSellerProductImport,
} from '../../services/sellerProductExcelApi';
import type {
  SellerInventoryImportRow,
  SellerProductImportPreview,
  SellerProductImportResult,
  SellerProductImportRow,
} from '../../types/sellerProductExcel';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatVnd } from '../../utils/sellerProductUi';

type ProductImportModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called after a run that changed something, so the list can reload. */
  onImported: (result: SellerProductImportResult) => void;
};

type Stage = 'pick' | 'preview' | 'done';

const ACCEPT = '.xlsx';

/**
 * Pick a file, see exactly what it would do, then commit. The file is sent twice
 * on purpose — once to check and once to run — so the server keeps no half-done
 * import between the two steps.
 */
export function ProductImportModal({ open, onClose, onImported }: ProductImportModalProps) {
  const [stage, setStage] = useState<Stage>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SellerProductImportPreview | null>(null);
  const [result, setResult] = useState<SellerProductImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) return;
    // Reset on close so reopening never shows the previous file's verdict.
    setStage('pick');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onClose]);

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!chosen) return;

    setFile(chosen);
    setError(null);
    setBusy(true);

    try {
      const response = await previewSellerProductImport(chosen);
      setPreview(response.data ?? null);
      setStage('preview');
    } catch (err) {
      setError(getApiErrorMessage(err));
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setError(null);
    setBusy(true);

    try {
      const response = await importSellerProducts(file);
      const imported = response.data ?? null;
      setResult(imported);
      setStage('done');
      if (imported) onImported(imported);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleTemplate() {
    setError(null);
    try {
      await downloadSellerProductTemplate();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  if (!open) return null;

  const importable = preview
    ? preview.createCount + preview.updateCount + preview.stockRowCount
    : 0;

  return createPortal(
    <>
      <div
        className="modal-backdrop fade show"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-import-title"
      >
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="product-import-title">
                Import products from Excel
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                disabled={busy}
                onClick={onClose}
              />
            </div>

            <div className="modal-body">
              {error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : null}

              {stage === 'pick' ? (
                <PickStage
                  busy={busy}
                  inputRef={inputRef}
                  onChoose={() => inputRef.current?.click()}
                  onFileChosen={handleFileChosen}
                  onTemplate={handleTemplate}
                />
              ) : null}

              {stage === 'preview' && preview ? (
                <PreviewStage file={file} preview={preview} />
              ) : null}

              {stage === 'done' && result ? <DoneStage result={result} /> : null}
            </div>

            <div className="modal-footer">
              {stage === 'preview' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-light"
                    disabled={busy}
                    onClick={() => {
                      setStage('pick');
                      setPreview(null);
                      setFile(null);
                    }}
                  >
                    Choose another file
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || importable === 0}
                    onClick={handleImport}
                  >
                    {busy ? 'Importing...' : `Import ${importable} row${importable === 1 ? '' : 's'}`}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-light" disabled={busy} onClick={onClose}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

type PickStageProps = {
  busy: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChoose: () => void;
  onFileChosen: (event: ChangeEvent<HTMLInputElement>) => void;
  onTemplate: () => void;
};

function PickStage({ busy, inputRef, onChoose, onFileChosen, onTemplate }: PickStageProps) {
  return (
    <div className="text-center py-3">
      <IconifyIcon icon="solar:file-check-bold-duotone" className="fs-48 text-primary" />
      <p className="mt-2 mb-1 fw-medium">Choose an .xlsx file</p>
      <p className="text-muted fs-13">
        Nothing is saved yet — you will see what every row does before anything is written.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="d-none"
        onChange={onFileChosen}
      />

      <div className="d-flex justify-content-center gap-2 mt-3">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onChoose}>
          {busy ? 'Reading file...' : 'Select file'}
        </button>
        <button type="button" className="btn btn-outline-light" disabled={busy} onClick={onTemplate}>
          Download template
        </button>
      </div>

      <p className="text-muted fs-13 mt-3 mb-0">
        The template carries the column list, your category ids and a sheet explaining each
        column. An exported file can be edited and imported straight back.
      </p>
      <p className="text-muted fs-13 mt-2 mb-0">
        The Variants sheet prices each configuration and gives it its own photo. For any photo
        you can paste the picture straight onto the row instead of hunting for a link — it is
        uploaded when you confirm the import, never while you are only previewing it.
      </p>
    </div>
  );
}

function PreviewStage({ file, preview }: { file: File | null; preview: SellerProductImportPreview }) {
  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <span className="text-muted fs-13 text-truncate" style={{ maxWidth: 280 }}>
          {file?.name}
        </span>
        <Tally label="New" count={preview.createCount} className="bg-success-subtle text-success" />
        <Tally label="Updated" count={preview.updateCount} className="bg-info-subtle text-info" />
        <Tally
          label="Skipped"
          count={preview.errorCount}
          className="bg-danger-subtle text-danger"
        />
        {preview.stockRowCount > 0 ? (
          <Tally
            label="Stock lots"
            count={preview.stockRowCount}
            className="bg-primary-subtle text-primary"
          />
        ) : null}
        {preview.stockErrorCount > 0 ? (
          <Tally
            label="Stock skipped"
            count={preview.stockErrorCount}
            className="bg-danger-subtle text-danger"
          />
        ) : null}
      </div>

      {preview.updateCount > 0 ? (
        <div className="alert alert-info py-2 px-3 fs-13">
          {preview.updateCount} row{preview.updateCount === 1 ? '' : 's'} match a product you
          already sell and will overwrite it. Every product touched goes back to Pending for
          admin review.
        </div>
      ) : null}

      {preview.stockRowCount > 0 ? (
        <div className="alert alert-info py-2 px-3 fs-13">
          {preview.stockUnitCount.toLocaleString('vi-VN')} unit
          {preview.stockUnitCount === 1 ? '' : 's'} will be received as{' '}
          {preview.stockRowCount} new stock lot{preview.stockRowCount === 1 ? '' : 's'}. This adds
          to what you already hold — it does not replace it, so importing the same file twice
          receives the stock twice.
        </div>
      ) : null}

      {preview.warnings.map((warning) => (
        <div key={warning} className="alert alert-warning py-2 px-3 fs-13">
          {warning}
        </div>
      ))}

      <div className="table-responsive" style={{ maxHeight: 380 }}>
        <table className="table table-sm align-middle mb-0">
          <thead className="bg-light-subtle position-sticky top-0">
            <tr>
              <th style={{ width: 60 }}>Row</th>
              <th style={{ width: 90 }}>Action</th>
              <th>Name</th>
              <th>Category</th>
              <th className="text-end">Price</th>
              <th>Problems</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <ImportRow key={row.rowNumber} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      {preview.stockRows.length > 0 ? (
        <>
          <p className="fw-medium mb-2 mt-3">Inventory sheet</p>
          <div className="table-responsive" style={{ maxHeight: 300 }}>
            <table className="table table-sm align-middle mb-0">
              <thead className="bg-light-subtle position-sticky top-0">
                <tr>
                  <th style={{ width: 60 }}>Row</th>
                  <th style={{ width: 90 }}>Action</th>
                  <th>Product</th>
                  <th>Variant</th>
                  <th className="text-end">Qty</th>
                  <th className="text-end">Unit cost</th>
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {preview.stockRows.map((row) => (
                  <StockRow key={row.rowNumber} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}

function StockRow({ row }: { row: SellerInventoryImportRow }) {
  const dash = <span className="text-muted">—</span>;

  return (
    <tr className={row.action === 'Error' ? 'table-danger' : undefined}>
      <td>{row.rowNumber}</td>
      <td>
        <span
          className={
            row.action === 'Receive'
              ? 'badge bg-primary-subtle text-primary'
              : 'badge bg-danger-subtle text-danger'
          }
        >
          {row.action}
        </span>
      </td>
      <td>{row.productName || row.slug || dash}</td>
      <td>{row.variantSku || dash}</td>
      <td className="text-end">{row.quantity?.toLocaleString('vi-VN') ?? dash}</td>
      <td className="text-end">{row.unitCost?.toLocaleString('vi-VN') ?? dash}</td>
      <td>
        <ProblemList errors={row.errors} />
      </td>
    </tr>
  );
}

function DoneStage({ result }: { result: SellerProductImportResult }) {
  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <Tally label="Created" count={result.created} className="bg-success-subtle text-success" />
        <Tally label="Updated" count={result.updated} className="bg-info-subtle text-info" />
        <Tally label="Skipped" count={result.failed} className="bg-danger-subtle text-danger" />
        {result.stockLotsReceived > 0 ? (
          <Tally
            label="Stock lots"
            count={result.stockLotsReceived}
            className="bg-primary-subtle text-primary"
          />
        ) : null}
        {result.stockFailed > 0 ? (
          <Tally
            label="Stock skipped"
            count={result.stockFailed}
            className="bg-danger-subtle text-danger"
          />
        ) : null}
      </div>

      {result.stockLotsReceived > 0 ? (
        <p className="text-muted fs-13">
          {result.stockUnitsReceived.toLocaleString('vi-VN')} unit
          {result.stockUnitsReceived === 1 ? '' : 's'} received across{' '}
          {result.stockLotsReceived} lot{result.stockLotsReceived === 1 ? '' : 's'}.
        </p>
      ) : null}

      {result.created + result.updated > 0 ? (
        <p className="text-muted fs-13">
          Imported products are Pending until an admin reviews them, the same as products added
          by hand.
        </p>
      ) : null}

      {result.failedRows.length > 0 ? (
        <>
          <p className="fw-medium mb-2">These rows were skipped — fix them and import again:</p>
          <div className="table-responsive" style={{ maxHeight: 300 }}>
            <table className="table table-sm align-middle mb-0">
              <thead className="bg-light-subtle position-sticky top-0">
                <tr>
                  <th style={{ width: 60 }}>Row</th>
                  <th>Name</th>
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {result.failedRows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.name || <span className="text-muted">—</span>}</td>
                    <td>
                      <ProblemList errors={row.errors} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {result.failedStockRows.length > 0 ? (
        <>
          <p className="fw-medium mb-2 mt-3">These stock lots were not received:</p>
          <div className="table-responsive" style={{ maxHeight: 240 }}>
            <table className="table table-sm align-middle mb-0">
              <thead className="bg-light-subtle position-sticky top-0">
                <tr>
                  <th style={{ width: 60 }}>Row</th>
                  <th>Product</th>
                  <th className="text-end">Qty</th>
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {result.failedStockRows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.productName || row.slug || <span className="text-muted">—</span>}</td>
                    <td className="text-end">
                      {row.quantity?.toLocaleString('vi-VN') ?? <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <ProblemList errors={row.errors} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}

function ImportRow({ row }: { row: SellerProductImportRow }) {
  const badge =
    row.action === 'Create'
      ? 'badge bg-success-subtle text-success'
      : row.action === 'Update'
        ? 'badge bg-info-subtle text-info'
        : 'badge bg-danger-subtle text-danger';

  return (
    <tr className={row.action === 'Error' ? 'table-danger-subtle' : undefined}>
      <td className="text-muted">{row.rowNumber}</td>
      <td>
        <span className={badge}>{row.action === 'Error' ? 'Skip' : row.action}</span>
      </td>
      <td className="text-truncate" style={{ maxWidth: 220 }}>
        {row.name || <span className="text-muted">—</span>}
      </td>
      <td className="text-truncate" style={{ maxWidth: 200 }}>
        {row.categoryName || <span className="text-muted">—</span>}
      </td>
      <td className="text-end">
        {row.basePrice != null ? formatVnd(row.basePrice) : <span className="text-muted">—</span>}
      </td>
      <td>
        <ProblemList errors={row.errors} />
      </td>
    </tr>
  );
}

function ProblemList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return <span className="text-muted fs-13">—</span>;

  return (
    <ul className="mb-0 ps-3 fs-13 text-danger">
      {errors.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

function Tally({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className: string;
}) {
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span className={`badge ${className} fs-13`}>{count}</span>
      <span className="text-muted fs-13">{label}</span>
    </span>
  );
}
