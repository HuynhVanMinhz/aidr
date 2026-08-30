import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { ProductImportModal } from '../../components/seller/ProductImportModal';
import { SELLER_PRODUCT_STATUS_FILTERS } from '../../components/seller/sellerProductFormConstants';
import { useSellerProducts } from '../../hooks/useSellerProducts';
import { exportSellerProducts } from '../../services/sellerProductExcelApi';
import { useToast } from '../../hooks/useToast';
import type { SellerProductListItem, SellerProductStatusFilter } from '../../types/seller';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatVnd, sellerProductStatusBadgeClass } from '../../utils/sellerProductUi';

export function SellerProductListPage() {
  const { products, paging, listLoading, listError, mutating, loadList, remove } = useSellerProducts();
  const toast = useToast();
  const [status, setStatus] = useState<SellerProductStatusFilter>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<SellerProductListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void loadList({
      status: status || undefined,
      q: q.trim() || undefined,
      page,
      pageSize: 20,
    });
  }, [loadList, status, page]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    void loadList({
      status: status || undefined,
      q: q.trim() || undefined,
      page: 1,
      pageSize: 20,
    });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await remove(deleteTarget.productId);
      toast.success('Product deleted.');
      setDeleteTarget(null);
      void loadList({
        status: status || undefined,
        q: q.trim() || undefined,
        page,
        pageSize: 20,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete product.';
      setActionError(message);
      toast.error(message);
    }
  }

  function reloadCurrentPage() {
    void loadList({
      status: status || undefined,
      q: q.trim() || undefined,
      page,
      pageSize: 20,
    });
  }

  async function handleExport() {
    setActionError(null);
    setExporting(true);
    try {
      // The filters go along, the paging does not — the file is the whole result.
      await exportSellerProducts({
        status: status || undefined,
        q: q.trim() || undefined,
      });
      toast.success('Export downloaded.');
    } catch (err) {
      const message = getApiErrorMessage(err);
      setActionError(message);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(paging.totalPages, 1);

  return (
    <>
      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">All Product List</h4>
              <form
                className="d-flex flex-nowrap align-items-center gap-2"
                onSubmit={handleSearchSubmit}
              >
                <AdminSelect
                  id="seller-product-status"
                  size="sm"
                  block={false}
                  value={status}
                  options={SELLER_PRODUCT_STATUS_FILTERS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  onChange={(next) => {
                    setStatus(next as SellerProductStatusFilter);
                    setPage(1);
                  }}
                />
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search name / brand..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ width: 220, flex: '0 0 auto' }}
                />
                <button type="submit" className="btn btn-sm btn-outline-light text-nowrap">
                  Search
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light text-nowrap"
                  disabled={exporting}
                  onClick={handleExport}
                >
                  <IconifyIcon icon="solar:file-download-outline" className="me-1" />
                  {exporting ? 'Exporting...' : 'Export Excel'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light text-nowrap"
                  onClick={() => setImportOpen(true)}
                >
                  <IconifyIcon icon="solar:file-send-outline" className="me-1" />
                  Import Excel
                </button>
                <Link to="/seller/products/new" className="btn btn-sm btn-primary text-nowrap">
                  Add Product
                </Link>
              </form>
            </div>

            {(listError || actionError) && (
              <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                {actionError || listError}
              </div>
            )}

            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover table-centered">
                <thead className="bg-light-subtle">
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading && products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : null}
                  {!listLoading && products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        No products yet.{' '}
                        <Link to="/seller/products/new" className="alert-link">
                          Create your first product
                        </Link>
                        .
                      </td>
                    </tr>
                  ) : null}
                  {products.map((product) => (
                    <tr key={product.productId}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="rounded bg-light avatar-md d-flex align-items-center justify-content-center overflow-hidden">
                            {product.primaryImageUrl ? (
                              <img src={product.primaryImageUrl} alt="" className="avatar-md" />
                            ) : (
                              <IconifyIcon icon="solar:box-bold-duotone" className="fs-24 text-muted" />
                            )}
                          </div>
                          <div>
                            <Link
                              to={`/seller/products/${product.productId}`}
                              className="text-dark fw-medium fs-15"
                            >
                              {product.name}
                            </Link>
                            <p className="text-muted mb-0 mt-1 fs-13">
                              {product.brand ? `${product.brand} · ` : ''}
                              {product.conditionType}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>{formatVnd(product.effectivePrice)}</div>
                        {product.salePrice != null ? (
                          <small className="text-muted text-decoration-line-through">
                            {formatVnd(product.basePrice)}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <p className="mb-1 text-muted">
                          <span className="text-dark fw-medium">{product.stockQuantity} Item</span> Left
                        </p>
                        <p className="mb-0 text-muted">{product.reservedQuantity} Reserved</p>
                      </td>
                      <td>{product.categoryName}</td>
                      <td>
                        <span className={sellerProductStatusBadgeClass(product.status)}>{product.status}</span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            to={`/seller/products/${product.productId}`}
                            className="btn btn-light btn-sm"
                            title="View"
                          >
                            <IconifyIcon icon="solar:eye-broken" className="align-middle fs-18" />
                          </Link>
                          {product.status !== 'Deleted' ? (
                            <>
                              <Link
                                to={`/seller/products/${product.productId}/inventory`}
                                className="btn btn-soft-success btn-sm"
                                title="Inventory"
                              >
                                <IconifyIcon icon="solar:box-minimalistic-broken" className="align-middle fs-18" />
                              </Link>
                              <Link
                                to={`/seller/products/${product.productId}/edit`}
                                className="btn btn-soft-primary btn-sm"
                                title="Edit"
                              >
                                <IconifyIcon icon="solar:pen-2-broken" className="align-middle fs-18" />
                              </Link>
                              <button
                                type="button"
                                className="btn btn-soft-danger btn-sm"
                                title="Delete"
                                disabled={mutating}
                                onClick={() => setDeleteTarget(product)}
                              >
                                <IconifyIcon
                                  icon="solar:trash-bin-minimalistic-2-broken"
                                  className="align-middle fs-18"
                                />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-footer border-top">
              <nav aria-label="Product list pagination">
                <ul className="pagination justify-content-end mb-0">
                  <li className={`page-item${page <= 1 ? ' disabled' : ''}`}>
                    <button
                      type="button"
                      className="page-link"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                  </li>
                  <li className="page-item active">
                    <span className="page-link">
                      {paging.page} / {totalPages}
                    </span>
                  </li>
                  <li className={`page-item${page >= totalPages ? ' disabled' : ''}`}>
                    <button
                      type="button"
                      className="page-link"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <AdminConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete product"
        confirmLabel="Delete"
        confirmVariant="danger"
        confirming={mutating}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      >
        Soft-delete <strong>{deleteTarget?.name}</strong>? It will be hidden from your active catalog
        (status Deleted).
      </AdminConfirmModal>

      <ProductImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(result) => {
          const written = result.created + result.updated;
          if (written > 0) {
            toast.success(`${result.created} created, ${result.updated} updated.`);
            reloadCurrentPage();
          }
          if (result.failed > 0) {
            toast.error(`${result.failed} row(s) were skipped — see the list in the dialog.`);
          }
        }}
      />
    </>
  );
}
