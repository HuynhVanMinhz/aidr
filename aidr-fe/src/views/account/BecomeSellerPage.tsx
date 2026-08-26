import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  createSellerRegistration,
  getMySellerRegistration,
  type BuyerSellerRegistration,
} from '../../services/sellerRegistrationApi';
import { sellerRegistrationBadgeClass } from '../../utils/adminBadge';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  canSubmitBuyerSellerRegistrationForm,
  parseDocumentUrls,
  validateBuyerSellerRegistrationForm,
  type BuyerSellerRegistrationFormField,
  type BuyerSellerRegistrationFormValues,
} from '../../utils/buyerSellerRegistrationValidation';
import { visibleFieldErrors } from '../../utils/formValidation';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function hasSellerRole(roles: string[]) {
  return roles.some((role) => role.toUpperCase() === 'SELLER');
}

function isFormLocked(registration: BuyerSellerRegistration | null, isSeller: boolean) {
  if (isSeller) return true;
  if (!registration) return false;
  return registration.status === 'Pending' || registration.status === 'Approved';
}

export function BecomeSellerPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const isSeller = hasSellerRole(roles);

  const [registration, setRegistration] = useState<BuyerSellerRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<BuyerSellerRegistrationFormValues>({
    shopName: '',
    businessInfo: '',
    documentUrls: '',
  });
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<BuyerSellerRegistrationFormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void getMySellerRegistration()
      .then((data) => {
        if (cancelled) return;
        setRegistration(data);
        if (data) {
          setForm({
            shopName: data.shopName,
            businessInfo: data.businessInfo ?? '',
            documentUrls: data.documentUrls.join('\n'),
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const locked = isFormLocked(registration, isSeller);

  const fieldErrors = useMemo(() => validateBuyerSellerRegistrationForm(form), [form]);
  const visibleErrors = visibleFieldErrors(fieldErrors, touched, submitted);
  const canSubmit = !locked && canSubmitBuyerSellerRegistrationForm(form, dirty, fieldErrors);

  function updateField<K extends BuyerSellerRegistrationFormField>(key: K, value: string) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked) return;

    setSubmitted(true);
    setSubmitError(null);

    const errors = validateBuyerSellerRegistrationForm(form);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await createSellerRegistration({
        shopName: form.shopName.trim(),
        businessInfo: form.businessInfo.trim() || null,
        documentUrls: parseDocumentUrls(form.documentUrls),
      });
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Unable to submit seller registration.');
      }
      setRegistration(result.data);
      setDirty(false);
      setSubmitted(false);
      toast.success('Seller registration submitted. We will review your application soon.');
    } catch (err) {
      const message = getApiErrorMessage(err);
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="account-details-content-box">
        <p className="account-muted">Loading registration…</p>
      </div>
    );
  }

  return (
    <div className="account-details-content-box">
      {loadError ? <div className="auth-alert auth-alert--error">{loadError}</div> : null}

      {isSeller ? (
        <div className="auth-alert auth-alert--success">
          You already have a seller account.{' '}
          <Link to="/seller">Open Seller Center</Link>
        </div>
      ) : null}

      {registration ? (
        <div className="account-details-content-item mb-4">
          <div className="checkout-bill-address-title">
            <h2>Application status</h2>
          </div>
          <p>
            Status:{' '}
            <span className={sellerRegistrationBadgeClass(registration.status)}>
              {registration.status}
            </span>
          </p>
          <p className="account-muted mb-1">Submitted {formatDate(registration.createdAt)}</p>
          {registration.reviewedAt ? (
            <p className="account-muted mb-1">Reviewed {formatDate(registration.reviewedAt)}</p>
          ) : null}
          {registration.adminNote ? (
            <div className="buyer-return-note mt-3">
              <strong>Admin note:</strong> {registration.adminNote}
            </div>
          ) : null}
        </div>
      ) : null}

      <form className="checkout-bill-address-form" onSubmit={handleSubmit} noValidate>
        <div className="account-details-content-item">
          <div className="checkout-bill-address-title">
            <h2>{registration ? 'Registration details' : 'Apply to become a seller'}</h2>
          </div>

          {submitError ? <div className="auth-alert auth-alert--error">{submitError}</div> : null}

          {locked && !isSeller ? (
            <p className="account-muted">
              Your application is under review or already approved. You cannot edit it at this time.
            </p>
          ) : null}

          <div className="row">
            <div className="form-group col-md-12">
              <label htmlFor="seller-shop-name">Shop name *</label>
              <input
                id="seller-shop-name"
                type="text"
                className="form-control"
                value={form.shopName}
                disabled={locked}
                onChange={(e) => updateField('shopName', e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, shopName: true }))}
              />
              {visibleErrors.shopName ? (
                <p className="form-field-error">{visibleErrors.shopName}</p>
              ) : null}
            </div>

            <div className="form-group col-md-12">
              <label htmlFor="seller-business-info">Business information</label>
              <textarea
                id="seller-business-info"
                className="form-control"
                rows={4}
                value={form.businessInfo}
                disabled={locked}
                placeholder="Describe your business, product categories, and experience."
                onChange={(e) => updateField('businessInfo', e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, businessInfo: true }))}
              />
              {visibleErrors.businessInfo ? (
                <p className="form-field-error">{visibleErrors.businessInfo}</p>
              ) : null}
            </div>

            <div className="form-group col-md-12">
              <label htmlFor="seller-document-urls">Supporting document URLs</label>
              <textarea
                id="seller-document-urls"
                className="form-control"
                rows={4}
                value={form.documentUrls}
                disabled={locked}
                placeholder="One URL per line (business license, ID, storefront photos…)"
                onChange={(e) => updateField('documentUrls', e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, documentUrls: true }))}
              />
              {visibleErrors.documentUrls ? (
                <p className="form-field-error">{visibleErrors.documentUrls}</p>
              ) : null}
            </div>
          </div>

          {!locked ? (
            <div className="account-form-actions">
              <button type="submit" className="btn-default" disabled={!canSubmit || submitting}>
                {submitting ? 'Submitting…' : registration ? 'Resubmit application' : 'Submit application'}
              </button>
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
