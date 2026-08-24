import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useSellerProducts } from '../../hooks/useSellerProducts';
import { useToast } from '../../hooks/useToast';
import { formatVnd, sellerProductStatusBadgeClass } from '../../utils/sellerProductUi';

export function SellerProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { selectedProduct, detailLoading, detailError, mutating, loadOne, remove } =
    useSellerProducts();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void loadOne(id).catch(() => undefined);
  }, [id, loadOne]);

  async function handleDelete() {
    if (!id) return;
    setActionError(null);
    try {
      await remove(id);
      toast.success('Product deleted.');
      navigate('/seller/products');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete product.';
      setActionError(message);
      toast.error(message);
    }
  }

  if (detailLoading && !selectedProduct) {
    return <div className="text-muted py-5 text-center">Loading product...</div>;
  }

  if (detailError || !selectedProduct) {
    return (
      <div className="alert alert-danger" role="alert">
        {detailError || 'Product not found.'}{' '}
        <Link to="/seller/products" className="alert-link">
          Back to products
        </Link>
      </div>
    );
  }

  const product = selectedProduct;
  const primary =
    product.images.find((i) => i.isPrimary)?.imageUrl ?? product.images[0]?.imageUrl ?? null;
  const isDeleted = product.status === 'Deleted';

  return (
    <>
      {(actionError) && (
        <div className="alert alert-danger" role="alert">
          {actionError}
        </div>
      )}

      <div className="row">
        <div className="col-xl-4">
          <div className="card">
            <div className="card-body">
              {primary ? (
                <img src={primary} alt="" className="img-fluid rounded bg-light w-100" />
              ) : (
                <div className="rounded bg-light d-flex align-items-center justify-content-center py-5">
                  <IconifyIcon icon="solar:gallery-bold-duotone" className="fs-48 text-muted" />
                </div>
              )}
              {product.images.length > 1 ? (
                <div className="d-flex flex-wrap gap-2 mt-3">
                  {product.images.map((img) => (
                    <img
                      key={img.productImageId}
                      src={img.imageUrl}
                      alt=""
                      className="rounded avatar-md border"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h4 className="card-title mb-1">{product.name}</h4>
                <span className={sellerProductStatusBadgeClass(product.status)}>{product.status}</span>
              </div>
              <div className="d-flex gap-2">
                <Link to="/seller/products" className="btn btn-sm btn-light">
                  Back
                </Link>
                {!isDeleted ? (
                  <>
                    <Link to={`/seller/products/${product.productId}/edit`} className="btn btn-sm btn-primary">
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn btn-sm btn-soft-danger"
                      disabled={mutating}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <p className="text-muted mb-1">Category</p>
                  <p className="fw-medium mb-0">{product.categoryName}</p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Slug</p>
                  <p className="fw-medium mb-0">
                    <code>{product.slug}</code>
                  </p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Brand / Model</p>
                  <p className="fw-medium mb-0">
                    {[product.brand, product.modelNumber].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Condition</p>
                  <p className="fw-medium mb-0">{product.conditionType}</p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Price</p>
                  <p className="fw-medium mb-0">
                    {formatVnd(product.effectivePrice)}
                    {product.salePrice != null ? (
                      <span className="text-muted text-decoration-line-through ms-2">
                        {formatVnd(product.basePrice)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Stock</p>
                  <p className="fw-medium mb-0">
                    {product.stockQuantity} available · {product.reservedQuantity} reserved
                  </p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Warranty</p>
                  <p className="fw-medium mb-0">
                    {product.warrantyMonths != null ? `${product.warrantyMonths} months` : '—'}
                  </p>
                </div>
                <div className="col-md-6">
                  <p className="text-muted mb-1">Origin</p>
                  <p className="fw-medium mb-0">{product.originCountry || '—'}</p>
                </div>
                <div className="col-12">
                  <p className="text-muted mb-1">Short description</p>
                  <p className="mb-0">{product.shortDescription || '—'}</p>
                </div>
                <div className="col-12">
                  <p className="text-muted mb-1">Description</p>
                  <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                    {product.description || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminConfirmModal
        open={confirmDelete}
        title="Delete product"
        confirmLabel="Delete"
        confirmVariant="danger"
        confirming={mutating}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
      >
        Soft-delete <strong>{product.name}</strong>? Status will become Deleted.
      </AdminConfirmModal>
    </>
  );
}
