import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { FormField } from '../../components/admin/FormField';
import {
  emptyCategoryForm,
  type CategoryFormValues,
} from '../../components/admin/categoryFormConstants';
import { useAdminCategories } from '../../hooks/useAdminCategories';
import { useToast } from '../../hooks/useToast';
import { selectAdminCategoryById } from '../../store/adminSlice';
import { useAppSelector } from '../../store/hooks';
import {
  canSubmitCategoryForm,
  type CategoryFormField,
  validateCategoryFormFields,
} from '../../utils/categoryFormValidation';
import { categoryDisplayOrderOptions, wouldCreateCategoryCycle } from '../../utils/categorySortUi';
import { visibleFieldErrors } from '../../utils/formValidation';
import { isCloudinaryConfigured, uploadCategoryImageToCloudinary, validateCategoryImageFile } from '../../utils/cloudinaryUpload';
import { slugFromName } from '../../utils/validators';

type Mode = 'create' | 'edit';

export function AdminCategoryFormPage() {
  const { id } = useParams();
  const mode: Mode = id ? 'edit' : 'create';
  const categoryId = id ? Number(id) : NaN;
  const navigate = useNavigate();
  const { categoryOptions, mutating, create, update, loadOne, loadOptions } = useAdminCategories(
    undefined,
    { autoLoad: false },
  );
  const toast = useToast();
  const existing = useAppSelector(selectAdminCategoryById(Number.isFinite(categoryId) ? categoryId : -1));

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const [form, setForm] = useState<CategoryFormValues>(emptyCategoryForm());
  const [initial, setInitial] = useState<CategoryFormValues>(emptyCategoryForm());
  const hydratedIdRef = useRef<number | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(mode === 'edit');
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<CategoryFormField, boolean>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // preview local blob
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    hydratedIdRef.current = null;
  }, [categoryId]);

  useEffect(() => {
    if (mode !== 'edit' || !Number.isFinite(categoryId)) return;

    const apply = (item: NonNullable<typeof existing>) => {
      if (hydratedIdRef.current === categoryId) return;
      const values = emptyCategoryForm({
        name: item.name,
        slug: item.slug,
        description: item.description ?? '',
        imageUrl: item.imageUrl ?? '',
        parentId: item.parentId ? String(item.parentId) : '',
        sortOrder: String(item.sortOrder),
        isActive: item.isActive,
      });
      setForm(values);
      setInitial(values);
      hydratedIdRef.current = categoryId;
    };

    if (existing) {
      apply(existing);
      setLoadingDetail(false);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    void loadOne(categoryId)
      .then((item) => {
        if (!cancelled) apply(item);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load category.';
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
  }, [categoryId, existing, loadOne, mode, toast]);

  const errors = useMemo(() => validateCategoryFormFields(form, mode), [form, mode]);
  const displayErrors = useMemo(() => visibleFieldErrors(errors, touched, submitted), [errors, touched, submitted]);
  const canSubmit = canSubmitCategoryForm(form, initial, mode, errors);
  const effectiveImageUrl = imagePreview ?? form.imageUrl;

  const parentOptions = categoryOptions.filter((c) => {
    if (!Number.isFinite(categoryId)) return true;
    return !wouldCreateCategoryCycle(categoryOptions, categoryId, c.categoryId);
  });

  function markTouched(field: CategoryFormField) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function patch<K extends keyof CategoryFormValues>(key: K, value: CategoryFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCategoryImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadCategoryImageFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadCategoryImageFile(file: File) {
    setImageUploadError(null);
    setSubmitError(null);

    const prevPreview = imagePreview;
    let localPreview: string | null = null;
    try {
      validateCategoryImageFile(file);
      if (!isCloudinaryConfigured()) {
        throw new Error('Cloudinary is not configured — unable to upload image.');
      }

      if (prevPreview?.startsWith('blob:')) URL.revokeObjectURL(prevPreview);
      localPreview = URL.createObjectURL(file);
      setImagePreview(localPreview);

      setUploadingImage(true);
      const uploaded = await uploadCategoryImageToCloudinary(file);

      setImagePreview(null);
      patch('imageUrl', uploaded.secureUrl);
      markTouched('imageUrl');
      toast.success('Image uploaded.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image upload failed.';
      setImageUploadError(message);
      setImagePreview(null);
      markTouched('imageUrl');
      toast.error(message);
    } finally {
      setUploadingImage(false);
      if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const nextErrors = validateCategoryFormFields(form, mode);
    if (Object.keys(nextErrors).length > 0 || !canSubmitCategoryForm(form, initial, mode, nextErrors)) return;

    setImageUploadError(null);
    setSubmitError(null);
    try {
      if (mode === 'create') {
        await create({
          name: form.name.trim(),
          slug: form.slug.trim().toLowerCase(),
          description: form.description.trim(),
          imageUrl: form.imageUrl.trim(),
          parentId: form.parentId ? Number(form.parentId) : null,
          sortOrder: Number(form.sortOrder),
          isActive: form.isActive,
        });
        toast.success('Category created.');
      } else {
        await update(categoryId, {
          name: form.name.trim(),
          description: form.description.trim(),
          imageUrl: form.imageUrl.trim(),
          sortOrder: Number(form.sortOrder),
          parentId: form.parentId ? Number(form.parentId) : null,
        });
        toast.success('Category updated.');
      }
      navigate('/admin/categories');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save category.';
      setSubmitError(message);
      toast.error(message);
    }
  }

  if (loadingDetail) return <p className="text-muted">Loading category...</p>;

  if (loadError) {
    return (
      <div className="alert alert-danger" role="alert">
        {loadError}{' '}
        <Link to="/admin/categories" className="alert-link">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <div className="row">
        <div className="col-xl-3 col-lg-4">
          <div className="card">
            <div className="card-body">
              <div className="aidr-category-preview">
                {effectiveImageUrl ? (
                  <img src={effectiveImageUrl} alt="" className="aidr-category-preview__image" />
                ) : (
                  <div className="aidr-category-preview__empty">
                    <div className="aidr-category-preview__icon">
                      <i className="bx bx-image-alt" />
                    </div>
                    <p className="mb-0 text-muted fs-13">Thumbnail preview</p>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <h4 className="mb-2">
                  {form.name.trim() || (mode === 'create' ? 'New Category' : 'Edit Category')}
                </h4>
                {mode === 'edit' && form.slug ? (
                  <span className="badge bg-info-subtle text-info">{form.slug}</span>
                ) : mode === 'create' && form.slug ? (
                  <span className="badge bg-info-subtle text-info">{form.slug}</span>
                ) : (
                  <span className="badge bg-light text-muted">slug preview</span>
                )}
              </div>
            </div>
            <div className="card-footer border-top">
              <div className="d-flex flex-nowrap gap-2">
                <button
                  type="submit"
                  className="btn btn-outline-secondary flex-fill text-nowrap"
                  disabled={!canSubmit || mutating || uploadingImage}
                >
                  {mode === 'create' ? 'Create' : 'Save'}
                </button>
                <Link to="/admin/categories" className="btn btn-primary flex-fill text-nowrap">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>

          <div className="col-xl-9 col-lg-8 ">
            {submitError ? <div className="alert alert-danger">{submitError}</div> : null}

            <div className="card">
              <div className="card-header">
                <h4 className="card-title">Add Thumbnail Photo</h4>
              </div>
              <div className="card-body">
                <FormField
                  label="Thumbnail Photo"
                  htmlFor="category-image"
                  error={imageUploadError ?? displayErrors.imageUrl}
                >
                  <div
                    className={`aidr-dropzone${isDragging ? ' is-dragging' : ''}${effectiveImageUrl ? ' has-preview' : ''}${uploadingImage ? ' is-uploading' : ''}`}
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
                    onDragEnter={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      if (!uploadingImage && !mutating) setIsDragging(true);
                    }}
                    onDragOver={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                    }}
                    onDragLeave={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      setIsDragging(false);
                    }}
                    onDrop={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      setIsDragging(false);
                      if (uploadingImage || mutating) return;
                      const file = ev.dataTransfer.files?.[0];
                      if (file) void uploadCategoryImageFile(file);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      id="category-image"
                      type="file"
                      accept="image/*"
                      className="d-none"
                      disabled={uploadingImage || mutating}
                      onChange={handleCategoryImageChange}
                    />

                    {effectiveImageUrl ? (
                      <div className="aidr-dropzone__preview">
                        <img src={effectiveImageUrl} alt="Category thumbnail preview" />
                        <div className="aidr-dropzone__overlay">
                          <span className="btn btn-sm btn-light">
                            {uploadingImage ? 'Uploading…' : 'Change image'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="aidr-dropzone__empty">
                        <div className="aidr-dropzone__badge">
                          <i className="bx bx-cloud-upload" />
                        </div>
                        <h5 className="mt-3 mb-1">
                          {isDragging ? 'Drop image to upload' : 'Drop your image here'}
                        </h5>
                        <p className="text-muted mb-2 fs-13">
                          or <span className="text-primary fw-semibold">click to browse</span>
                        </p>
                        <p className="text-muted mb-0 fs-12">
                          PNG, JPG, WEBP · max 2MB · square crop recommended
                        </p>
                      </div>
                    )}
                  </div>
                </FormField>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h4 className="card-title">General Information</h4>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-lg-6">
                    <FormField label="Category Title" htmlFor="category-name" error={displayErrors.name}>
                      <input
                        id="category-name"
                        className="form-control"
                        placeholder="Enter Title"
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

                  {mode === 'create' ? (
                    <div className="col-lg-6">
                      <FormField label="Slug" htmlFor="category-slug" error={displayErrors.slug}>
                        <input
                          id="category-slug"
                          className="form-control"
                          placeholder="dien-thoai"
                          value={form.slug}
                          onBlur={() => markTouched('slug')}
                          onChange={(e) => {
                            setSlugTouched(true);
                            patch('slug', e.target.value);
                          }}
                        />
                      </FormField>
                    </div>
                  ) : (
                    <div className="col-lg-6">
                      <FormField label="Slug" htmlFor="category-slug-readonly">
                        <div id="category-slug-readonly" className="pt-1">
                          <span className="badge bg-info-subtle text-info fs-13">{form.slug || '—'}</span>
                        </div>
                      </FormField>
                    </div>
                  )}

                  <div className="col-lg-6">
                    <FormField label="Parent Category" htmlFor="category-parent" error={displayErrors.parentId}>
                      <AdminSelect
                        id="category-parent"
                        value={form.parentId}
                        placeholder="Select Parent (Optional)"
                        options={[
                          { value: '', label: 'None — root category' },
                          ...parentOptions.map((c) => ({
                            value: String(c.categoryId),
                            label: c.name,
                          })),
                        ]}
                        onBlur={() => markTouched('parentId')}
                        onChange={(next) => patch('parentId', next)}
                      />
                    </FormField>
                  </div>

                  <div className="col-lg-6">
                    <FormField
                      label="Display order"
                      htmlFor="category-sort"
                      error={displayErrors.sortOrder}
                    >
                      <AdminSelect
                        id="category-sort"
                        value={form.sortOrder}
                        options={categoryDisplayOrderOptions(Number(form.sortOrder))}
                        onBlur={() => markTouched('sortOrder')}
                        onChange={(next) => patch('sortOrder', next)}
                      />
                    </FormField>
                  </div>

                  {mode === 'create' ? (
                    <div className="col-lg-6 d-flex align-items-center">
                      <div className="form-check form-switch mt-3">
                        <input
                          id="category-active"
                          className="form-check-input"
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(e) => patch('isActive', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="category-active">
                          Active
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <div className="col-lg-12">
                    <FormField label="Description" htmlFor="category-description" error={displayErrors.description}>
                      <textarea
                        id="category-description"
                        className="form-control bg-light-subtle"
                        rows={7}
                        placeholder="Type description"
                        value={form.description}
                        onBlur={() => markTouched('description')}
                        onChange={(e) => patch('description', e.target.value)}
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-light mb-3 rounded">
              <div className="d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="submit"
                  className="btn btn-outline-secondary text-nowrap"
                  disabled={!canSubmit || mutating || uploadingImage}
                >
                  {mode === 'create' ? 'Create Category' : 'Save Changes'}
                </button>
                <Link to="/admin/categories" className="btn btn-primary text-nowrap">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
    </form>
  );
}
