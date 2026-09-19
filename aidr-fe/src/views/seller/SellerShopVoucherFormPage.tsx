import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminDatePicker } from '../../components/admin/AdminDatePicker';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { FormField } from '../../components/admin/FormField';
import {
  emptySystemVoucherForm,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  type SystemVoucherFormValues,
} from '../../components/admin/systemVoucherFormConstants';
import { useSellerShopVoucherDetail, useSellerShopVouchers } from '../../hooks/useSellerShopVouchers';
import { useToast } from '../../hooks/useToast';
import {
  canSubmitSystemVoucherForm,
  type SystemVoucherFormField,
  validateSystemVoucherFormFields,
} from '../../utils/systemVoucherFormValidation';
import { visibleFieldErrors } from '../../utils/formValidation';

type Mode = 'create' | 'edit';

export function SellerShopVoucherFormPage() {
  const { id } = useParams();
  const mode: Mode = id ? 'edit' : 'create';
  const navigate = useNavigate();
  const toast = useToast();
  const { mutating, create, update, loadOne } = useSellerShopVouchers(undefined, { autoLoad: false });
  const existing = useSellerShopVoucherDetail(id);

  const [form, setForm] = useState<SystemVoucherFormValues>(emptySystemVoucherForm());
  const [initial, setInitial] = useState<SystemVoucherFormValues>(emptySystemVoucherForm());
  const hydratedIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(mode === 'edit');
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<SystemVoucherFormField, boolean>>>({});

  useEffect(() => {
    hydratedIdRef.current = null;
  }, [id]);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;

    const apply = (item: NonNullable<typeof existing>) => {
      if (hydratedIdRef.current === id) return;
      const values = emptySystemVoucherForm({
        code: item.code,
        name: item.name,
        description: item.description ?? '',
        discountType: item.discountType === 'FixedAmount' ? 'FixedAmount' : 'Percent',
        discountValue: String(item.discountValue),
        maxDiscountAmount: item.maxDiscountAmount != null ? String(item.maxDiscountAmount) : '',
        minOrderAmount: String(item.minOrderAmount),
        usageLimit: item.usageLimit != null ? String(item.usageLimit) : '',
        perUserLimit: String(item.perUserLimit),
        startsAt: toDatetimeLocalValue(item.startsAt),
        endsAt: toDatetimeLocalValue(item.endsAt),
        isActive: item.isActive,
      });
      setForm(values);
      setInitial(values);
      hydratedIdRef.current = id;
    };

    if (existing) {
      apply(existing);
      setLoadingDetail(false);
      return;
    }

    let cancelled = false;
    setLoadingDetail(true);
    void loadOne(id)
      .then((item) => {
        if (!cancelled) apply(item);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load voucher.';
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
  }, [existing, id, loadOne, mode, toast]);

  const errors = useMemo(() => validateSystemVoucherFormFields(form, mode), [form, mode]);
  const visible = visibleFieldErrors(errors, touched, submitted);
  const canSubmit = canSubmitSystemVoucherForm(form, initial, mode, errors) && !mutating;

  function markTouched(field: SystemVoucherFormField) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function patchForm(patch: Partial<SystemVoucherFormValues>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setSubmitError(null);

    const nextErrors = validateSystemVoucherFormFields(form, mode);
    if (Object.keys(nextErrors).length > 0 || !canSubmitSystemVoucherForm(form, initial, mode, nextErrors)) {
      return;
    }

    try {
      const maxDiscount = form.maxDiscountAmount.trim()
        ? Number(form.maxDiscountAmount.trim())
        : null;
      const usageLimit = form.usageLimit.trim() ? Number(form.usageLimit.trim()) : null;

      if (mode === 'create') {
        await create({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          maxDiscountAmount: maxDiscount,
          minOrderAmount: Number(form.minOrderAmount),
          usageLimit,
          perUserLimit: Number(form.perUserLimit),
          startsAt: fromDatetimeLocalValue(form.startsAt),
          endsAt: fromDatetimeLocalValue(form.endsAt),
          isActive: form.isActive,
        });
        toast.success('Shop voucher created.');
      } else if (id) {
        await update(id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          maxDiscountAmount: maxDiscount,
          minOrderAmount: Number(form.minOrderAmount),
          usageLimit,
          perUserLimit: Number(form.perUserLimit),
          startsAt: fromDatetimeLocalValue(form.startsAt),
          endsAt: fromDatetimeLocalValue(form.endsAt),
        });
        toast.success('Shop voucher updated.');
      }
      navigate('/seller/vouchers');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save voucher.';
      setSubmitError(message);
      toast.error(message);
    }
  }

  if (loadingDetail) {
    return <p className="text-muted">Loading voucher…</p>;
  }

  if (loadError) {
    return (
      <div className="alert alert-danger" role="alert">
        {loadError}{' '}
        <Link to="/seller/vouchers" className="alert-link">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      {submitError && (
        <div className="alert alert-danger" role="alert">
          {submitError}
        </div>
      )}

      <div className="row">
        <div className="col-lg-5">
          {mode === 'create' && (
            <div className="card">
              <div className="card-header">
                <h4 className="card-title">Voucher Status</h4>
              </div>
              <div className="card-body">
                <div className="d-flex gap-4">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="voucherStatus"
                      id="shop-voucher-active"
                      checked={form.isActive}
                      onChange={() => patchForm({ isActive: true })}
                    />
                    <label className="form-check-label" htmlFor="shop-voucher-active">
                      Active
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="voucherStatus"
                      id="shop-voucher-inactive"
                      checked={!form.isActive}
                      onChange={() => patchForm({ isActive: false })}
                    />
                    <label className="form-check-label" htmlFor="shop-voucher-inactive">
                      Inactive
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h4 className="card-title">Date Schedule</h4>
            </div>
            <div className="card-body">
              <FormField label="Start date" htmlFor="shop-voucher-starts" error={visible.startsAt}>
                <AdminDatePicker
                  id="shop-voucher-starts"
                  enableTime
                  value={form.startsAt}
                  onChange={(next) => {
                    patchForm({ startsAt: next });
                    markTouched('startsAt');
                  }}
                />
              </FormField>
              <FormField label="End date" htmlFor="shop-voucher-ends" error={visible.endsAt}>
                <AdminDatePicker
                  id="shop-voucher-ends"
                  enableTime
                  value={form.endsAt}
                  onChange={(next) => {
                    patchForm({ endsAt: next });
                    markTouched('endsAt');
                  }}
                />
              </FormField>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card">
            <div className="card-header">
              <h4 className="card-title">Voucher Information</h4>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-lg-6">
                  <FormField label="Voucher code" htmlFor="shop-voucher-code" error={visible.code}>
                    <input
                      id="shop-voucher-code"
                      type="text"
                      className="form-control"
                      placeholder="e.g. SHOP20K"
                      value={form.code}
                      disabled={mode === 'edit'}
                      onChange={(e) => patchForm({ code: e.target.value.toUpperCase() })}
                      onBlur={() => markTouched('code')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField label="Name" htmlFor="shop-voucher-name" error={visible.name}>
                    <input
                      id="shop-voucher-name"
                      type="text"
                      className="form-control"
                      placeholder="Campaign name"
                      value={form.name}
                      onChange={(e) => patchForm({ name: e.target.value })}
                      onBlur={() => markTouched('name')}
                    />
                  </FormField>
                </div>
                <div className="col-12">
                  <FormField
                    label="Description (optional)"
                    htmlFor="shop-voucher-description"
                    error={visible.description}
                  >
                    <textarea
                      id="shop-voucher-description"
                      className="form-control"
                      rows={3}
                      value={form.description}
                      onChange={(e) => patchForm({ description: e.target.value })}
                      onBlur={() => markTouched('description')}
                    />
                  </FormField>
                </div>
              </div>

              <h4 className="card-title mb-3 mt-2">Discount</h4>
              <div className="row">
                <div className="col-lg-6">
                  <FormField
                    label="Discount type"
                    htmlFor="shop-voucher-discount-type"
                    error={visible.discountType}
                  >
                    <AdminSelect
                      id="shop-voucher-discount-type"
                      value={form.discountType}
                      onChange={(value) =>
                        patchForm({
                          discountType: value === 'FixedAmount' ? 'FixedAmount' : 'Percent',
                        })
                      }
                      onBlur={() => markTouched('discountType')}
                      options={[
                        { value: 'Percent', label: 'Percent' },
                        { value: 'FixedAmount', label: 'Fixed amount' },
                      ]}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField
                    label={form.discountType === 'Percent' ? 'Discount (%)' : 'Discount amount (VND)'}
                    htmlFor="shop-voucher-discount-value"
                    error={visible.discountValue}
                  >
                    <input
                      id="shop-voucher-discount-value"
                      type="number"
                      min={0}
                      step="0.01"
                      className="form-control"
                      value={form.discountValue}
                      onChange={(e) => patchForm({ discountValue: e.target.value })}
                      onBlur={() => markTouched('discountValue')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Max discount amount (optional)"
                    htmlFor="shop-voucher-max-discount"
                    error={visible.maxDiscountAmount}
                  >
                    <input
                      id="shop-voucher-max-discount"
                      type="number"
                      min={0}
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 50000"
                      value={form.maxDiscountAmount}
                      onChange={(e) => patchForm({ maxDiscountAmount: e.target.value })}
                      onBlur={() => markTouched('maxDiscountAmount')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Minimum order amount"
                    htmlFor="shop-voucher-min-order"
                    error={visible.minOrderAmount}
                  >
                    <input
                      id="shop-voucher-min-order"
                      type="number"
                      min={0}
                      step="0.01"
                      className="form-control"
                      value={form.minOrderAmount}
                      onChange={(e) => patchForm({ minOrderAmount: e.target.value })}
                      onBlur={() => markTouched('minOrderAmount')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Usage limit (optional)"
                    htmlFor="shop-voucher-usage-limit"
                    error={visible.usageLimit}
                  >
                    <input
                      id="shop-voucher-usage-limit"
                      type="number"
                      min={1}
                      step={1}
                      className="form-control"
                      placeholder="Unlimited if empty"
                      value={form.usageLimit}
                      onChange={(e) => patchForm({ usageLimit: e.target.value })}
                      onBlur={() => markTouched('usageLimit')}
                    />
                  </FormField>
                </div>
                <div className="col-lg-6">
                  <FormField
                    label="Per-user limit"
                    htmlFor="shop-voucher-per-user"
                    error={visible.perUserLimit}
                  >
                    <input
                      id="shop-voucher-per-user"
                      type="number"
                      min={1}
                      step={1}
                      className="form-control"
                      value={form.perUserLimit}
                      onChange={(e) => patchForm({ perUserLimit: e.target.value })}
                      onBlur={() => markTouched('perUserLimit')}
                    />
                  </FormField>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 mt-3">
                <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                  {mutating
                    ? 'Saving…'
                    : mode === 'create'
                      ? 'Create Voucher'
                      : 'Save Changes'}
                </button>
                <Link to="/seller/vouchers" className="btn btn-light">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
