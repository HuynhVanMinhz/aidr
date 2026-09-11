import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FormField } from '../../components/admin/FormField';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { KeyValueField } from '../../components/admin/KeyValueField';
import { TagsField } from '../../components/admin/TagsField';
import {
  emptySellerProductForm,
  SELLER_PRODUCT_CONDITIONS,
  PRODUCT_SPEC_SUGGESTIONS,
  PRODUCT_TAG_SUGGESTIONS,
  SELLER_PRODUCT_MAX_IMAGES,
  SELLER_PRODUCT_MAX_IMAGE_URL,
  type SellerProductFormValues,
  type SellerProductStagedImage,
} from '../../components/seller/sellerProductFormConstants';
import {
  emptyStockDelivery,
  filledStockRows,
  ProductStockSection,
  SINGLE_STOCK_KEY,
  validateStockDelivery,
  type StockDelivery,
} from '../../components/seller/ProductStockSection';
import { SellerProductVariantsEditor } from '../../components/seller/SellerProductVariantsEditor';
import { useCategories } from '../../hooks/useCatalog';
import { importSellerStockLot } from '../../services/sellerInventoryApi';
import { useSellerProducts } from '../../hooks/useSellerProducts';
import { useToast } from '../../hooks/useToast';
import type { CategoryTreeNode } from '../../types/catalog';
import type { SellerProductDetail } from '../../types/seller';
import { tryValidateField, visibleFieldErrors } from '../../utils/formValidation';
import {
  isCloudinaryConfigured,
  uploadProductImageToCloudinary,
  validateProductImageFile,
} from '../../utils/cloudinaryUpload';
import {
  buildSellerProductPayload,
  canSubmitSellerProductForm,
  type SellerProductFormField,
  validateSellerProductFormFields,
} from '../../utils/sellerProductValidation';
import { formatVnd } from '../../utils/sellerProductUi';
import {
  detailToVariantDrafts,
  draftsToPayload,
  validateVariantDrafts,
  variantDraftsSignature,
  type VariantDraft,
  type VariantOptionDraft,
} from '../../utils/sellerProductVariants';
import { slugFromName, validateImageUrl } from '../../utils/validators';

type Mode = 'create' | 'edit';

type CategoryOption = { id: number; label: string; depth: number; groupLabel?: string };

/**
 * The dropdown shows depth with indentation and weight rather than a run of
 * dashes, so the label stays clean everywhere else it is reused.
 */
function flattenCategories(
  nodes: CategoryTreeNode[],
  depth = 0,
  parentName?: string,
): CategoryOption[] {
  const rows: CategoryOption[] = [];
  for (const node of nodes) {
    rows.push({ id: node.categoryId, label: node.name, depth, groupLabel: parentName });
    if (node.children?.length) {
      rows.push(...flattenCategories(node.children, depth + 1, node.name));
    }
  }
  return rows;
}

function detailToForm(item: SellerProductDetail): SellerProductFormValues {
  return emptySellerProductForm({
    categoryId: String(item.categoryId),
    name: item.name,
    slug: item.slug,
    shortDescription: item.shortDescription ?? '',
    description: item.description ?? '',
    brand: item.brand ?? '',
    modelNumber: item.modelNumber ?? '',
    conditionType: item.conditionType || 'New',
    basePrice: String(item.basePrice),
    salePrice: item.salePrice != null ? String(item.salePrice) : '',
    warrantyMonths: item.warrantyMonths != null ? String(item.warrantyMonths) : '',
    originCountry: item.originCountry ?? '',
    tagsJson: item.tagsJson ?? '',
    specsJson: item.specsJson ?? '',
  });
}

function detailToImages(item: SellerProductDetail): SellerProductStagedImage[] {
  return item.images.map((img, index) => ({
    localId: img.productImageId || `img-${index}`,
    imageUrl: img.imageUrl,
    publicId: img.publicId,
    sortOrder: img.sortOrder,
    isPrimary: img.isPrimary,
  }));
}

function imagesEqual(a: SellerProductStagedImage[], b: SellerProductStagedImage[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((img, index) => {
    const prev = b[index];
    return (
      prev &&
      img.imageUrl === prev.imageUrl &&
      (img.publicId ?? null) === (prev.publicId ?? null) &&
      img.isPrimary === prev.isPrimary &&
      img.sortOrder === prev.sortOrder
    );
  });
}

export function SellerProductFormPage() {
  const { id } = useParams();
  const mode: Mode = id ? 'edit' : 'create';
  const navigate = useNavigate();
  const toast = useToast();
  const { create, update, uploadImages, loadOne, mutating } = useSellerProducts();
  const { categories, loading: categoriesLoading } = useCategories();
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);

  const [form, setForm] = useState<SellerProductFormValues>(emptySellerProductForm());
  const [initial, setInitial] = useState<SellerProductFormValues>(emptySellerProductForm());
  const [images, setImages] = useState<SellerProductStagedImage[]>([]);
  const [initialImages, setInitialImages] = useState<SellerProductStagedImage[]>([]);
  const [variantOptions, setVariantOptions] = useState<VariantOptionDraft[]>([]);
  const [variantRows, setVariantRows] = useState<VariantDraft[]>([]);
  // Kept so an edit that never touches the variant editor can omit them from the payload,
  // which the API reads as "leave the stored variants alone".
  const [variantsTouched, setVariantsTouched] = useState(false);
  // The variant grid as it was loaded, so an edit confined to it still enables Save.
  const [initialVariantSignature, setInitialVariantSignature] = useState(() =>
    variantDraftsSignature([], []),
  );
  // Stock rides alongside the product form but is written through the inventory
  // service afterwards: a lot can only be received once the product has an id.
  const [stock, setStock] = useState<StockDelivery>(emptyStockDelivery());
  // Derived, so a corrected quantity clears its own message instead of waiting
  // for the next submit.
  const [stockSubmitted, setStockSubmitted] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | undefined>(undefined);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(mode === 'edit');
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<SellerProductFormField, boolean>>>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrlError, setImageUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;

    let cancelled = false;
    setLoadingDetail(true);
    setLoadError(null);
    void loadOne(id)
      .then((item) => {
        if (cancelled) return;
        const values = detailToForm(item);
        const staged = detailToImages(item);
        setForm(values);
        setInitial(values);
        setImages(staged);
        setInitialImages(staged);
        const drafts = detailToVariantDrafts(item);
        setVariantOptions(drafts.options);
        setVariantRows(drafts.rows);
        setInitialVariantSignature(variantDraftsSignature(drafts.options, drafts.rows));
        setVariantsTouched(false);
        setCurrentStock(item.stockQuantity);
        // A delivery is per-save; reopening the product must not re-receive one.
        setStock(emptyStockDelivery());
        setStockSubmitted(false);
        setSlugTouched(true);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load product.';
          setLoadError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
    // toast.error is stable; omit toast object to avoid remount loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadOne, mode]);

  const errors = useMemo(
    () => validateSellerProductFormFields(form, images, { requireImages: mode === 'create' }),
    [form, images, mode],
  );
  const displayErrors = useMemo(
    () => visibleFieldErrors(errors, touched, submitted),
    [errors, touched, submitted],
  );
  const variantValidation = useMemo(
    () => validateVariantDrafts(variantOptions, variantRows),
    [variantOptions, variantRows],
  );
  const stockErrors = useMemo(
    () => (stockSubmitted ? validateStockDelivery(stock) : {}),
    [stock, stockSubmitted],
  );
  const hasPendingStock = useMemo(() => filledStockRows(stock).length > 0, [stock]);

  const variantsValid =
    variantValidation.formError === null &&
    Object.keys(variantValidation.rowErrors).length === 0;

  const variantsDirty = useMemo(
    () => variantDraftsSignature(variantOptions, variantRows) !== initialVariantSignature,
    [variantOptions, variantRows, initialVariantSignature],
  );

  const canSubmit =
    canSubmitSellerProductForm(
      form,
      initial,
      images,
      initialImages,
      mode,
      errors,
      hasPendingStock,
      variantsDirty,
    ) && variantsValid;

  const previewImage = images.find((i) => i.isPrimary)?.imageUrl ?? images[0]?.imageUrl ?? null;
  const previewBasePrice = Number(form.basePrice);
  const previewSalePrice = form.salePrice.trim() ? Number(form.salePrice) : null;
  const previewEffective =
    previewSalePrice != null && Number.isFinite(previewSalePrice)
      ? previewSalePrice
      : Number.isFinite(previewBasePrice)
        ? previewBasePrice
        : 0;

  function markTouched(field: SellerProductFormField) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function patch<K extends keyof SellerProductFormValues>(key: K, value: SellerProductFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImagesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setImageUploadError(null);
    setSubmitError(null);

    if (!isCloudinaryConfigured()) {
      const message = 'Cloudinary is not configured — unable to upload images.';
      setImageUploadError(message);
      markTouched('images');
      toast.error(message);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const remaining = SELLER_PRODUCT_MAX_IMAGES - images.length;
    if (remaining <= 0) {
      const message = `A product can have at most ${SELLER_PRODUCT_MAX_IMAGES} images.`;
      setImageUploadError(message);
      markTouched('images');
      toast.error(message);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const toUpload = files.slice(0, remaining);
    setUploadingImage(true);
    try {
      const uploaded: SellerProductStagedImage[] = [];
      for (const file of toUpload) {
        validateProductImageFile(file);
        const result = await uploadProductImageToCloudinary(file);
        uploaded.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          imageUrl: result.secureUrl,
          publicId: result.publicId,
          sortOrder: images.length + uploaded.length,
          isPrimary: false,
        });
      }

      setImages((prev) => {
        const next = [...prev, ...uploaded];
        if (!next.some((i) => i.isPrimary) && next.length > 0) {
          next[0] = { ...next[0], isPrimary: true };
        }
        return next.map((img, index) => ({ ...img, sortOrder: index }));
      });
      markTouched('images');
      toast.success(uploaded.length === 1 ? 'Image uploaded.' : `${uploaded.length} images uploaded.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image upload failed.';
      setImageUploadError(message);
      markTouched('images');
      toast.error(message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function addImageFromUrl() {
    setImageUploadError(null);
    setSubmitError(null);

    const urlError = tryValidateField(() =>
      validateImageUrl(imageUrlInput, SELLER_PRODUCT_MAX_IMAGE_URL),
    );
    if (urlError) {
      setImageUrlError(urlError);
      markTouched('images');
      return;
    }

    const trimmed = imageUrlInput.trim();
    if (images.some((img) => img.imageUrl === trimmed)) {
      setImageUrlError('This image URL is already added.');
      markTouched('images');
      return;
    }

    if (images.length >= SELLER_PRODUCT_MAX_IMAGES) {
      const message = `A product can have at most ${SELLER_PRODUCT_MAX_IMAGES} images.`;
      setImageUrlError(message);
      markTouched('images');
      toast.error(message);
      return;
    }

    setImages((prev) => {
      const next = [
        ...prev,
        {
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          imageUrl: trimmed,
          publicId: null,
          sortOrder: prev.length,
          isPrimary: false,
        },
      ];
      if (!next.some((i) => i.isPrimary) && next.length > 0) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next.map((img, index) => ({ ...img, sortOrder: index }));
    });
    setImageUrlInput('');
    setImageUrlError(null);
    markTouched('images');
    toast.success('Image URL added.');
  }

  function setPrimary(localId: string) {
    setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.localId === localId })));
    markTouched('images');
  }

  function removeImage(localId: string) {
    setImages((prev) => {
      const next = prev.filter((img) => img.localId !== localId).map((img, index) => ({
        ...img,
        sortOrder: index,
      }));
      if (next.length > 0 && !next.some((i) => i.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
    markTouched('images');
  }

  /**
   * Receives the typed delivery against the saved product.
   *
   * Runs after the product is written, because a lot needs a product id — and a
   * variant row needs the id the server assigned it, which is why each draft is
   * matched back to the saved variant by id, then SKU, then its attributes.
   */
  async function receiveStock(saved: SellerProductDetail): Promise<string[]> {
    const rows = filledStockRows(stock);
    if (rows.length === 0) return [];

    const failures: string[] = [];

    for (const row of rows) {
      let variantId: string | null = null;

      if (row.key !== SINGLE_STOCK_KEY) {
        const draft = variantRows.find((v) => v.key === row.key);
        if (!draft) continue;

        const match =
          (draft.variantId
            ? saved.variants.find((v) => v.variantId === draft.variantId)
            : undefined) ??
          (draft.sku.trim()
            ? saved.variants.find(
                (v) => (v.sku ?? '').trim().toLowerCase() === draft.sku.trim().toLowerCase(),
              )
            : undefined) ??
          saved.variants.find((v) =>
            Object.entries(draft.attributes).every(([name, value]) => v.attributes[name] === value),
          );

        if (!match) {
          failures.push(`no saved variant matched "${row.key}".`);
          continue;
        }
        variantId = match.variantId;
      }

      try {
        await importSellerStockLot(saved.productId, {
          variantId,
          lotCode: stock.lotCode.trim() || null,
          quantity: Number(row.quantity),
          unitCost: Number(row.unitCost),
          supplierName: stock.supplierName.trim() || null,
          invoiceNumber: stock.invoiceNumber.trim() || null,
          note: stock.note.trim() || null,
        });
      } catch (err) {
        failures.push(err instanceof Error ? err.message : 'the lot was refused.');
      }
    }

    return failures;
  }

  /** The product is already saved, so a refused lot is reported, not thrown. */
  function reportSave(message: string, stockFailures: string[]) {
    toast.success(message);
    if (stockFailures.length > 0) {
      toast.error(`Stock was not received: ${stockFailures.join(' ')}`);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const nextErrors = validateSellerProductFormFields(form, images, {
      requireImages: mode === 'create',
    });

    setStockSubmitted(true);
    const nextStockErrors = validateStockDelivery(stock);

    if (
      Object.keys(nextErrors).length > 0 ||
      Object.keys(nextStockErrors).length > 0 ||
      !canSubmitSellerProductForm(
        form,
        initial,
        images,
        initialImages,
        mode,
        nextErrors,
        hasPendingStock,
        variantsDirty,
      ) ||
      !variantsValid
    ) {
      return;
    }

    setImageUploadError(null);
    setSubmitError(null);

    try {
      const payload = buildSellerProductPayload(form);
      // Omitted entirely when the seller never opened the editor, so an ordinary edit
      // cannot wipe variants it was not shown.
      const variantPayload =
        mode === 'create' || variantsTouched
          ? draftsToPayload(variantOptions, variantRows)
          : {};
      const imagePayload = images.map((img, index) => ({
        imageUrl: img.imageUrl,
        publicId: img.publicId ?? null,
        sortOrder: index,
        isPrimary: img.isPrimary,
      }));

      if (mode === 'create') {
        const created = await create({ ...payload, ...variantPayload, images: imagePayload });
        reportSave('Product created and submitted for review.', await receiveStock(created));
        navigate(`/seller/products/${created.productId}`);
        return;
      }

      if (!id) return;
      const updated = await update(id, { ...payload, ...variantPayload });
      if (!imagesEqual(images, initialImages)) {
        await uploadImages(id, { images: imagePayload, replaceExisting: true });
      }
      reportSave('Product updated. Status reset to Pending for review.', await receiveStock(updated));
      navigate(`/seller/products/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save product.';
      setSubmitError(message);
      toast.error(message);
    }
  }

  if (loadingDetail) {
    return <div className="text-muted py-5 text-center">Loading product...</div>;
  }

  if (loadError) {
    return (
      <div className="alert alert-danger" role="alert">
        {loadError}{' '}
        <Link to="/seller/products" className="alert-link">
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      {(submitError || imageUploadError) && (
        <div className="alert alert-danger" role="alert">
          {submitError || imageUploadError}
        </div>
      )}

      <div className="row">
        <div className="col-xl-3 col-lg-4">
          <div className="card">
            <div className="card-body">
              {previewImage ? (
                <img src={previewImage} alt="" className="img-fluid rounded bg-light" />
              ) : (
                <div className="rounded bg-light d-flex align-items-center justify-content-center py-5">
                  <IconifyIcon icon="solar:gallery-bold-duotone" className="fs-48 text-muted" />
                </div>
              )}
              <div className="mt-3">
                <h4>
                  {form.name.trim() || 'Product name'}{' '}
                  <span className="fs-14 text-muted ms-1">
                    (
                    {flatCategories.find((c) => String(c.id) === form.categoryId)?.label ||
                      'Category'}
                    )
                  </span>
                </h4>
                <h5 className="text-dark fw-medium mt-3">Price :</h5>
                <h4 className="fw-semibold text-dark mt-2 d-flex align-items-center gap-2">
                  {previewSalePrice != null && Number.isFinite(previewSalePrice) ? (
                    <>
                      <span className="text-muted text-decoration-line-through">
                        {formatVnd(previewBasePrice || 0)}
                      </span>
                      {formatVnd(previewEffective)}
                    </>
                  ) : (
                    formatVnd(previewEffective)
                  )}
                </h4>
                <p className="text-muted mb-0 mt-2">
                  New products are submitted as <strong>Pending</strong> for admin review.
                </p>
              </div>
            </div>
            <div className="card-footer bg-light-subtle">
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <button
                  type="submit"
                  className="btn btn-primary flex-fill text-nowrap"
                  disabled={!canSubmit || mutating || uploadingImage}
                >
                  {mode === 'create' ? 'Create Product' : 'Save Changes'}
                </button>
                <Link to="/seller/products" className="btn btn-outline-light flex-fill text-nowrap">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-9 col-lg-8">
          <div className="card">
            <div className="card-header">
              <h4 className="card-title">Add Product Photo</h4>
            </div>
            <div className="card-body">
              <FormField label="Product images" htmlFor="product-images" error={displayErrors.images}>
                <div
                  className="dropzone"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (uploadingImage || mutating) return;
                    fileInputRef.current?.click();
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key !== 'Enter' && ev.key !== ' ') return;
                    if (uploadingImage || mutating) return;
                    fileInputRef.current?.click();
                  }}
                >
                  <input
                    ref={fileInputRef}
                    id="product-images"
                    type="file"
                    accept="image/*"
                    multiple
                    className="d-none"
                    disabled={uploadingImage || mutating}
                    onChange={(e) => void handleImagesSelected(e)}
                  />
                  <div className="dz-message needsclick">
                    <i className="bx bx-cloud-upload fs-48 text-primary" />
                    <h3 className="mt-4">
                      Drop your images here, or <span className="text-primary">click to browse</span>
                    </h3>
                    <span className="text-muted fs-13">
                      {uploadingImage
                        ? 'Uploading to Cloudinary…'
                        : `PNG, JPG up to 2MB. Max ${SELLER_PRODUCT_MAX_IMAGES} images.`}
                    </span>
                  </div>
                </div>
              </FormField>

              <div className="mt-3">
                <FormField
                  label="Or paste image URL"
                  htmlFor="product-image-url"
                  error={imageUrlError ?? undefined}
                >
                  <div className="input-group">
                    <input
                      id="product-image-url"
                      type="url"
                      className="form-control"
                      placeholder="https://example.com/image.jpg"
                      value={imageUrlInput}
                      disabled={uploadingImage || mutating}
                      onChange={(e) => {
                        setImageUrlInput(e.target.value);
                        if (imageUrlError) setImageUrlError(null);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key !== 'Enter') return;
                        ev.preventDefault();
                        if (uploadingImage || mutating || !imageUrlInput.trim()) return;
                        addImageFromUrl();
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      disabled={uploadingImage || mutating || !imageUrlInput.trim()}
                      onClick={addImageFromUrl}
                    >
                      Add
                    </button>
                  </div>
                </FormField>
              </div>

              {images.length > 0 ? (
                <div className="row g-2 mt-2">
                  {images.map((img) => (
                    <div className="col-6 col-md-3" key={img.localId}>
                      <div className="border rounded p-2 text-center">
                        <img src={img.imageUrl} alt="" className="img-fluid rounded mb-2" />
                        <div className="d-flex flex-column gap-1">
                          <button
                            type="button"
                            className={`btn btn-sm ${img.isPrimary ? 'btn-primary' : 'btn-light'}`}
                            onClick={() => setPrimary(img.localId)}
                          >
                            {img.isPrimary ? 'Primary' : 'Set primary'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-soft-danger"
                            onClick={() => removeImage(img.localId)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h4 className="card-title">Product Information</h4>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-lg-6">
                  <FormField label="Product Name" htmlFor="product-name" error={displayErrors.name}>
                    <input
                      id="product-name"
                      className="form-control"
                      placeholder="Items Name"
                      value={form.name}
                      onBlur={() => markTouched('name')}
                      onChange={(e) => {
                        const name = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          name,
                          slug: mode === 'create' && !slugTouched ? slugFromName(name) : prev.slug,
                        }));
                      }}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Product Categories"
                    htmlFor="product-categories"
                    error={displayErrors.categoryId}
                  >
                    <AdminSelect
                      id="product-categories"
                      value={form.categoryId}
                      disabled={categoriesLoading}
                      placeholder="Choose a category"
                      options={[
                        { value: '', label: 'Choose a category' },
                        ...flatCategories.map((c) => ({
                          value: String(c.id),
                          label: c.label,
                          depth: c.depth,
                          groupLabel: c.groupLabel,
                        })),
                      ]}
                      onBlur={() => markTouched('categoryId')}
                      onChange={(next) => patch('categoryId', next)}
                    />
                  </FormField>
                </div>
              </div>

              <div className="row">
                <div className="col-lg-6">
                  <FormField label="Slug" htmlFor="product-slug" error={displayErrors.slug}>
                    <input
                      id="product-slug"
                      className="form-control"
                      placeholder="galaxy-s24-ultra"
                      value={form.slug}
                      onBlur={() => markTouched('slug')}
                      onChange={(e) => {
                        setSlugTouched(true);
                        patch('slug', e.target.value);
                      }}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Condition"
                    htmlFor="product-condition"
                    error={displayErrors.conditionType}
                  >
                    <AdminSelect
                      id="product-condition"
                      value={form.conditionType}
                      options={SELLER_PRODUCT_CONDITIONS.map((c) => ({ value: c, label: c }))}
                      onBlur={() => markTouched('conditionType')}
                      onChange={(next) => patch('conditionType', next)}
                    />
                  </FormField>
                </div>
              </div>

              <div className="row">
                <div className="col-lg-4">
                  <FormField label="Brand" htmlFor="product-brand" error={displayErrors.brand}>
                    <input
                      id="product-brand"
                      className="form-control"
                      placeholder="Brand Name"
                      value={form.brand}
                      onBlur={() => markTouched('brand')}
                      onChange={(e) => patch('brand', e.target.value)}
                    />
                  </FormField>
                </div>
                <div className="col-lg-4">
                  <FormField
                    label="Model Number"
                    htmlFor="product-model"
                    error={displayErrors.modelNumber}
                  >
                    <input
                      id="product-model"
                      className="form-control"
                      placeholder="SM-S928B"
                      value={form.modelNumber}
                      onBlur={() => markTouched('modelNumber')}
                      onChange={(e) => patch('modelNumber', e.target.value)}
                    />
                  </FormField>
                </div>
                <div className="col-lg-4">
                  <FormField
                    label="Origin Country"
                    htmlFor="product-origin"
                    error={displayErrors.originCountry}
                  >
                    <input
                      id="product-origin"
                      className="form-control"
                      placeholder="Vietnam"
                      value={form.originCountry}
                      onBlur={() => markTouched('originCountry')}
                      onChange={(e) => patch('originCountry', e.target.value)}
                    />
                  </FormField>
                </div>
              </div>

              <div className="row">
                <div className="col-lg-12">
                  <FormField
                    label="Short Description"
                    htmlFor="product-short"
                    error={displayErrors.shortDescription}
                  >
                    <input
                      id="product-short"
                      className="form-control"
                      placeholder="Short summary for listings"
                      value={form.shortDescription}
                      onBlur={() => markTouched('shortDescription')}
                      onChange={(e) => patch('shortDescription', e.target.value)}
                    />
                  </FormField>
                </div>
              </div>

              <div className="row">
                <div className="col-lg-12">
                  <FormField
                    label="Description"
                    htmlFor="product-description"
                    error={displayErrors.description}
                  >
                    <textarea
                      id="product-description"
                      className="form-control bg-light-subtle"
                      rows={7}
                      placeholder="Short description about the product"
                      value={form.description}
                      onBlur={() => markTouched('description')}
                      onChange={(e) => patch('description', e.target.value)}
                    />
                  </FormField>
                </div>
              </div>

              <div className="row">
                <div className="col-lg-6">
                  <FormField label="Tags" htmlFor="product-tags" error={displayErrors.tagsJson}>
                    <TagsField
                      id="product-tags"
                      value={form.tagsJson}
                      placeholder="e.g. flagship, 5g"
                      suggestions={PRODUCT_TAG_SUGGESTIONS}
                      invalid={Boolean(displayErrors.tagsJson)}
                      onBlur={() => markTouched('tagsJson')}
                      onChange={(json) => patch('tagsJson', json)}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Specifications"
                    htmlFor="product-specs"
                    error={displayErrors.specsJson}
                  >
                    <KeyValueField
                      id="product-specs"
                      value={form.specsJson}
                      keyLabel="Specification"
                      valueLabel="Value"
                      keyPlaceholder="RAM"
                      valuePlaceholder="12GB"
                      addLabel="Add specification"
                      keySuggestions={PRODUCT_SPEC_SUGGESTIONS}
                      invalid={Boolean(displayErrors.specsJson)}
                      onBlur={() => markTouched('specsJson')}
                      onChange={(json) => patch('specsJson', json)}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h4 className="card-title">Pricing Details</h4>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-lg-4">
                  <FormField label="Base Price (VND)" htmlFor="product-price" error={displayErrors.basePrice}>
                    <div className="input-group mb-3">
                      <span className="input-group-text fs-20">₫</span>
                      <input
                        type="number"
                        id="product-price"
                        className="form-control"
                        placeholder="000"
                        min={0}
                        step="1000"
                        value={form.basePrice}
                        onBlur={() => markTouched('basePrice')}
                        onChange={(e) => patch('basePrice', e.target.value)}
                      />
                    </div>
                  </FormField>
                </div>
                <div className="col-lg-4">
                  <FormField
                    label="Sale Price (optional)"
                    htmlFor="product-sale"
                    error={displayErrors.salePrice}
                  >
                    <div className="input-group mb-3">
                      <span className="input-group-text fs-20">₫</span>
                      <input
                        type="number"
                        id="product-sale"
                        className="form-control"
                        placeholder="000"
                        min={0}
                        step="1000"
                        value={form.salePrice}
                        onBlur={() => markTouched('salePrice')}
                        onChange={(e) => patch('salePrice', e.target.value)}
                      />
                    </div>
                  </FormField>
                </div>
                <div className="col-lg-4">
                  <FormField
                    label="Warranty (months)"
                    htmlFor="product-warranty"
                    error={displayErrors.warrantyMonths}
                  >
                    <input
                      type="number"
                      id="product-warranty"
                      className="form-control"
                      placeholder="12"
                      min={0}
                      value={form.warrantyMonths}
                      onBlur={() => markTouched('warrantyMonths')}
                      onChange={(e) => patch('warrantyMonths', e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h4 className="card-title mb-1">Variants</h4>
              {/* Avoid Bootstrap .card-subtitle — its negative margin pulls this into the title. */}
              <p className="text-muted fs-13 mb-0 mt-1">
                Use these when the price depends on the configuration — colour, capacity, size.
                Each combination gets its own price, SKU and stock.
              </p>
            </div>
            <div className="card-body">
              <SellerProductVariantsEditor
                options={variantOptions}
                rows={variantRows}
                onOptionsChange={(next) => {
                  setVariantOptions(next);
                  setVariantsTouched(true);
                }}
                onRowsChange={(next) => {
                  setVariantRows(next);
                  setVariantsTouched(true);
                }}
                fallbackPrice={form.basePrice}
                rowErrors={variantValidation.rowErrors}
                formError={submitted || variantsTouched ? variantValidation.formError : null}
                disabled={mutating || uploadingImage}
                galleryImages={images.map((img) => img.imageUrl)}
                onUploadImage={
                  isCloudinaryConfigured()
                    ? async (file) => {
                        validateProductImageFile(file);
                        const result = await uploadProductImageToCloudinary(file);
                        return result.secureUrl;
                      }
                    : undefined
                }
              />
            </div>
          </div>

          <ProductStockSection
            mode={mode}
            variantRows={variantRows}
            currentStock={currentStock}
            delivery={stock}
            onChange={setStock}
            errors={stockErrors}
            disabled={mutating || uploadingImage}
          />

          <div className="p-3 bg-light mb-3 rounded">
            <div className="d-flex flex-nowrap justify-content-end align-items-center gap-2">
              <button
                type="submit"
                className="btn btn-primary text-nowrap"
                disabled={!canSubmit || mutating || uploadingImage}
              >
                {mode === 'create' ? 'Create Product' : 'Save Changes'}
              </button>
              <Link to="/seller/products" className="btn btn-outline-light text-nowrap">
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
