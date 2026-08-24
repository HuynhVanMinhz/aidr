import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useSellerProducts } from '../../hooks/useSellerProducts';
import { useToast } from '../../hooks/useToast';
import {
  formatDateTime,
  formatVnd,
  sellerProductStatusBadgeClass,
} from '../../utils/sellerProductUi';

function discountPercent(basePrice: number, salePrice: number | null | undefined): number | null {
  if (salePrice == null || basePrice <= 0 || salePrice >= basePrice) return null;
  return Math.round(((basePrice - salePrice) / basePrice) * 100);
}

function StarRating({ rating }: { rating: number }) {
  return (
    <ul className="d-flex text-warning m-0 fs-20 list-unstyled">
      {Array.from({ length: 5 }, (_, index) => {
        const threshold = index + 1;
        let icon = 'bx bx-star';
        if (rating >= threshold) icon = 'bx bxs-star';
        else if (rating >= threshold - 0.5) icon = 'bx bxs-star-half';
        return (
          <li key={index}>
            <i className={icon} />
          </li>
        );
      })}
    </ul>
  );
}

export function SellerProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { selectedProduct, detailLoading, detailError, mutating, loadOne, remove } =
    useSellerProducts();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    void loadOne(id).catch(() => undefined);
  }, [id, loadOne]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedProduct?.productId]);

  const images = useMemo(() => {
    if (!selectedProduct) return [];
    const sorted = [...selectedProduct.images].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
    return sorted;
  }, [selectedProduct]);

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
  const isDeleted = product.status === 'Deleted';
  const activeImage = images[activeImageIndex] ?? images[0] ?? null;
  const available = Math.max(0, product.stockQuantity - product.reservedQuantity);
  const offPercent = discountPercent(product.basePrice, product.salePrice);
  const hasSale = product.salePrice != null && product.salePrice < product.basePrice;

  return (
    <>
      {actionError ? (
        <div className="alert alert-danger" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="row">
        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <div className="rounded bg-light overflow-hidden">
                {activeImage ? (
                  <img
                    src={activeImage.imageUrl}
                    alt={product.name}
                    className="img-fluid bg-light rounded w-100"
                  />
                ) : (
                  <div
                    className="d-flex align-items-center justify-content-center rounded bg-light"
                    style={{ minHeight: 280 }}
                  >
                    <IconifyIcon icon="solar:gallery-bold-duotone" className="fs-48 text-muted" />
                  </div>
                )}
              </div>

              {images.length > 1 ? (
                <div className="d-flex flex-wrap gap-2 mt-3">
                  {images.map((img, index) => (
                    <button
                      key={img.productImageId}
                      type="button"
                      className={`btn p-1 rounded bg-light border-0 ${
                        index === activeImageIndex ? 'border border-primary' : ''
                      }`}
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`Show image ${index + 1}`}
                    >
                      <img src={img.imageUrl} alt="" className="d-block avatar-xl rounded" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="card-footer border-top">
              <div className="row g-2">
                {!isDeleted ? (
                  <>
                    <div className="col-lg-5">
                      <Link
                        to={`/seller/products/${product.productId}/edit`}
                        className="btn btn-primary d-flex align-items-center justify-content-center gap-2 w-100"
                      >
                        <i className="bx bx-edit fs-18" />
                        Edit
                      </Link>
                    </div>
                    <div className="col-lg-5">
                      <Link
                        to={`/seller/products/${product.productId}/inventory`}
                        className="btn btn-light d-flex align-items-center justify-content-center gap-2 w-100"
                      >
                        <i className="bx bx-package fs-18" />
                        Inventory
                      </Link>
                    </div>
                    <div className="col-lg-2">
                      <button
                        type="button"
                        className="btn btn-soft-danger d-inline-flex align-items-center justify-content-center fs-20 rounded w-100"
                        disabled={mutating}
                        onClick={() => setConfirmDelete(true)}
                        title="Delete"
                        aria-label="Delete product"
                      >
                        <IconifyIcon icon="solar:trash-bin-minimalistic-2-broken" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="col-12">
                    <Link
                      to="/seller/products"
                      className="btn btn-light d-flex align-items-center justify-content-center gap-2 w-100"
                    >
                      Back to products
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span className={sellerProductStatusBadgeClass(product.status)}>{product.status}</span>
                {product.isFeatured ? (
                  <span className="badge bg-success text-light fs-14 py-1 px-2">Featured</span>
                ) : null}
                {product.conditionType ? (
                  <span className="badge bg-light text-dark fs-14 py-1 px-2">{product.conditionType}</span>
                ) : null}
              </div>

              <p className="mb-1">
                <span className="fs-24 text-dark fw-medium">{product.name}</span>
              </p>

              <div className="d-flex gap-2 align-items-center">
                <StarRating rating={product.avgRating} />
                <p className="mb-0 fw-medium fs-18 text-dark">
                  {product.avgRating.toFixed(1)}{' '}
                  <span className="text-muted fs-13">({product.reviewCount} Review)</span>
                </p>
              </div>

              <h2 className="fw-medium my-3">
                {formatVnd(product.effectivePrice)}{' '}
                {hasSale ? (
                  <>
                    <span className="fs-16 text-decoration-line-through text-muted">
                      {formatVnd(product.basePrice)}
                    </span>
                    {offPercent != null ? (
                      <small className="text-danger ms-2">({offPercent}% Off)</small>
                    ) : null}
                  </>
                ) : null}
              </h2>

              <ul className="d-flex flex-column gap-2 list-unstyled fs-15 my-3">
                <li>
                  <i
                    className={`bx ${available > 0 ? 'bx-check text-success' : 'bx-x text-danger'}`}
                  />{' '}
                  {available > 0
                    ? `In stock · ${available} available`
                    : 'Out of stock'}
                </li>
                <li>
                  <i className="bx bx-check text-success" /> {product.stockQuantity} on hand ·{' '}
                  {product.reservedQuantity} reserved
                </li>
                <li>
                  <i className="bx bx-check text-success" /> Category:{' '}
                  <span className="text-dark fw-medium">{product.categoryName}</span>
                </li>
                {product.brand ? (
                  <li>
                    <i className="bx bx-check text-success" /> Brand:{' '}
                    <span className="text-dark fw-medium">{product.brand}</span>
                  </li>
                ) : null}
              </ul>

              <h4 className="text-dark fw-medium">Description :</h4>
              <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>
                {product.shortDescription || product.description || 'No description provided.'}
              </p>
              {product.shortDescription && product.description ? (
                <p className="text-muted mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                  {product.description}
                </p>
              ) : null}

              <div className="mt-3">
                <Link to="/seller/products" className="link-primary text-decoration-underline link-offset-2">
                  Back to product list <i className="bx bx-arrow-to-right align-middle fs-16" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="card bg-light-subtle">
            <div className="card-body">
              <div className="row">
                <div className="col-lg-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="avatar bg-light d-flex align-items-center justify-content-center rounded">
                      <IconifyIcon
                        icon="solar:box-bold-duotone"
                        className="fs-35 text-primary"
                      />
                    </div>
                    <div>
                      <p className="text-dark fw-medium fs-16 mb-1">{product.stockQuantity} on hand</p>
                      <p className="mb-0">{available} available to sell</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="avatar bg-light d-flex align-items-center justify-content-center rounded">
                      <IconifyIcon
                        icon="solar:bag-check-bold-duotone"
                        className="fs-35 text-primary"
                      />
                    </div>
                    <div>
                      <p className="text-dark fw-medium fs-16 mb-1">{product.soldCount} sold</p>
                      <p className="mb-0">{product.reservedQuantity} reserved</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="avatar bg-light d-flex align-items-center justify-content-center rounded">
                      <IconifyIcon
                        icon="solar:eye-bold-duotone"
                        className="fs-35 text-primary"
                      />
                    </div>
                    <div>
                      <p className="text-dark fw-medium fs-16 mb-1">{product.viewCount} views</p>
                      <p className="mb-0">{product.reviewCount} reviews</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="avatar bg-light d-flex align-items-center justify-content-center rounded">
                      <IconifyIcon
                        icon="solar:calendar-bold-duotone"
                        className="fs-35 text-primary"
                      />
                    </div>
                    <div>
                      <p className="text-dark fw-medium fs-16 mb-1">Updated</p>
                      <p className="mb-0">{formatDateTime(product.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h4 className="card-title">Items Detail</h4>
            </div>
            <div className="card-body">
              <ul className="d-flex flex-column gap-2 list-unstyled fs-14 text-muted mb-0">
                <li>
                  <span className="fw-medium text-dark">Product ID</span>
                  <span className="mx-2">:</span>
                  <code>{product.productId}</code>
                </li>
                <li>
                  <span className="fw-medium text-dark">Slug</span>
                  <span className="mx-2">:</span>
                  {product.slug}
                </li>
                <li>
                  <span className="fw-medium text-dark">Category</span>
                  <span className="mx-2">:</span>
                  {product.categoryName}
                </li>
                <li>
                  <span className="fw-medium text-dark">Brand</span>
                  <span className="mx-2">:</span>
                  {product.brand || '—'}
                </li>
                <li>
                  <span className="fw-medium text-dark">Item model number</span>
                  <span className="mx-2">:</span>
                  {product.modelNumber || '—'}
                </li>
                <li>
                  <span className="fw-medium text-dark">Condition</span>
                  <span className="mx-2">:</span>
                  {product.conditionType}
                </li>
                <li>
                  <span className="fw-medium text-dark">Country of Origin</span>
                  <span className="mx-2">:</span>
                  {product.originCountry || '—'}
                </li>
                <li>
                  <span className="fw-medium text-dark">Warranty</span>
                  <span className="mx-2">:</span>
                  {product.warrantyMonths != null ? `${product.warrantyMonths} months` : '—'}
                </li>
                <li>
                  <span className="fw-medium text-dark">Base price</span>
                  <span className="mx-2">:</span>
                  {formatVnd(product.basePrice)}
                </li>
                <li>
                  <span className="fw-medium text-dark">Sale price</span>
                  <span className="mx-2">:</span>
                  {product.salePrice != null ? formatVnd(product.salePrice) : '—'}
                </li>
                <li>
                  <span className="fw-medium text-dark">Created</span>
                  <span className="mx-2">:</span>
                  {formatDateTime(product.createdAt)}
                </li>
                <li>
                  <span className="fw-medium text-dark">Published</span>
                  <span className="mx-2">:</span>
                  {formatDateTime(product.publishedAt)}
                </li>
              </ul>
              {!isDeleted ? (
                <div className="mt-3">
                  <Link
                    to={`/seller/products/${product.productId}/edit`}
                    className="link-primary text-decoration-underline link-offset-2"
                  >
                    Edit product details <i className="bx bx-arrow-to-right align-middle fs-16" />
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h4 className="card-title">Rating summary</h4>
            </div>
            <div className="card-body">
              <div className="d-flex align-items-center gap-3">
                <div className="avatar-lg bg-light rounded d-flex align-items-center justify-content-center">
                  <span className="fs-24 fw-semibold text-dark">{product.avgRating.toFixed(1)}</span>
                </div>
                <div>
                  <StarRating rating={product.avgRating} />
                  <p className="mb-0 mt-1 text-muted">
                    Based on {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <p className="text-muted mt-3 mb-0">
                Customer reviews will appear here once buyers leave feedback on this product.
              </p>
              <div className="mt-3">
                <Link
                  to={`/seller/products/${product.productId}/inventory`}
                  className="link-primary text-decoration-underline link-offset-2"
                >
                  Manage inventory &amp; pricing{' '}
                  <i className="bx bx-arrow-to-right align-middle fs-16" />
                </Link>
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
