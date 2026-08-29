import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { KycStep } from '../../components/account/KycStep';
import { SelectField } from '../../components/common/SelectField';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
import { getMyKyc } from '../../services/kycApi';
import {
  createSellerRegistration,
  getMySellerRegistration,
  updateSellerRegistration,
} from '../../services/sellerRegistrationApi';
import type { KycVerification } from '../../types/kyc';
import type {
  BuyerSellerRegistration,
  SellerBusinessType,
} from '../../types/sellerRegistration';
import { sellerRegistrationBadgeClass } from '../../utils/adminBadge';
import { getApiErrorMessage } from '../../utils/apiError';
import { isCloudinaryConfigured, uploadKycImageToCloudinary } from '../../utils/cloudinaryUpload';
import { formatOrderDate } from '../../utils/orderUi';

const BUSINESS_TYPES: { value: SellerBusinessType; label: string; hint: string }[] = [
  {
    value: 'Individual',
    label: 'Individual',
    hint: 'Selling under your own name. No tax code or licence needed.',
  },
  {
    value: 'Household',
    label: 'Household business',
    hint: 'Registered household. Tax code and business licence required.',
  },
  {
    value: 'Company',
    label: 'Company',
    hint: 'Registered company. Tax code and business licence required.',
  },
];

type Form = {
  shopName: string;
  businessType: SellerBusinessType;
  taxCode: string;
  businessAddress: string;
  contactPhone: string;
  contactEmail: string;
  businessInfo: string;
  licenseImageUrl: string;
};

const EMPTY_FORM: Form = {
  shopName: '',
  businessType: 'Individual',
  taxCode: '',
  businessAddress: '',
  contactPhone: '',
  contactEmail: '',
  businessInfo: '',
  licenseImageUrl: '',
};

const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/;

export function BecomeSellerPage() {
  const toast = useToast();
  const { roles } = useAuth();
  const isSeller = roles.includes('Seller');

  const [kyc, setKyc] = useState<KycVerification | null>(null);
  const [registration, setRegistration] = useState<BuyerSellerRegistration | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const licenseInput = useRef<HTMLInputElement>(null);

  useToastMessage(loadError);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [kycResult, regResult] = await Promise.all([
          getMyKyc(),
          getMySellerRegistration(),
        ]);
        if (cancelled) return;

        setKyc(kycResult);
        setRegistration(regResult);

        if (regResult) {
          setForm({
            shopName: regResult.shopName ?? '',
            businessType: regResult.businessType ?? 'Individual',
            taxCode: regResult.taxCode ?? '',
            businessAddress: regResult.businessAddress ?? '',
            contactPhone: regResult.contactPhone ?? '',
            contactEmail: regResult.contactEmail ?? '',
            businessInfo: regResult.businessInfo ?? '',
            licenseImageUrl: regResult.licenseImageUrl ?? '',
          });
        }
        setLoadError(null);
      } catch (err) {
        if (!cancelled) setLoadError(getApiErrorMessage(err, 'Unable to load your application.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const kycDone = Boolean(kyc?.canStartSellerApplication);
  const editing = !registration || registration.canEdit;
  const needsLicense = form.businessType !== 'Individual';

  const errors = useMemo(() => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.shopName.trim()) next.shopName = 'Shop name is required.';
    else if (form.shopName.trim().length < 3) next.shopName = 'Use at least 3 characters.';

    if (needsLicense) {
      if (!form.taxCode.trim()) next.taxCode = 'Tax code is required for this business type.';
      else if (!TAX_CODE_PATTERN.test(form.taxCode.trim()))
        next.taxCode = 'Use 10 digits, optionally followed by -NNN.';

      if (!form.licenseImageUrl) next.licenseImageUrl = 'Upload the business licence.';
    }

    if (form.contactEmail.trim() && !form.contactEmail.includes('@')) {
      next.contactEmail = 'Enter a valid email address.';
    }
    return next;
  }, [form, needsLicense]);

  const canSubmit = kycDone && editing && Object.keys(errors).length === 0 && !submitting;

  function patch<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLicensePick(file: File | undefined) {
    if (!file) return;
    setUploadingLicense(true);
    try {
      const uploaded = await uploadKycImageToCloudinary(file);
      patch('licenseImageUrl', uploaded.secureUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to upload the licence.');
    } finally {
      setUploadingLicense(false);
      if (licenseInput.current) licenseInput.current.value = '';
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const payload = {
        shopName: form.shopName.trim(),
        businessType: form.businessType,
        taxCode: needsLicense ? form.taxCode.trim() : null,
        businessAddress: form.businessAddress.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        businessInfo: form.businessInfo.trim() || null,
        licenseImageUrl: needsLicense ? form.licenseImageUrl : null,
      };

      const result = registration
        ? await updateSellerRegistration(payload)
        : await createSellerRegistration(payload);

      if (!result.success || !result.data) {
        throw new Error(result.message || 'Unable to submit your application.');
      }

      setRegistration(result.data);
      toast.success(result.message || 'Application submitted.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to submit your application.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="account-page">
        <p className="account-muted">Loading your application…</p>
      </div>
    );
  }

  if (isSeller) {
    return (
      <div className="account-page">
        <div className="account-empty">
          <p>You already have a seller account.</p>
          <Link to="/seller" className="account-btn account-btn--primary">
            Open Seller Center
          </Link>
        </div>
      </div>
    );
  }

  /* Progress: identity → business profile → review. */
  const steps = [
    { key: 'kyc', label: 'Identity', done: kycDone },
    { key: 'profile', label: 'Business profile', done: Boolean(registration) },
    { key: 'review', label: 'Admin review', done: registration?.status === 'Approved' },
  ];
  const activeIndex = !kycDone ? 0 : !registration ? 1 : 2;

  return (
    <div className="account-page seller-apply">
      <ol className="seller-steps">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={`seller-steps__item${
              step.done ? ' is-done' : index === activeIndex ? ' is-active' : ''
            }`}
          >
            <span className="seller-steps__marker">
              {step.done ? <i className="fa-solid fa-check" aria-hidden /> : index + 1}
            </span>
            <span className="seller-steps__label">{step.label}</span>
          </li>
        ))}
      </ol>

      {registration ? (
        <section className="account-card seller-status">
          <div className="seller-status__head">
            <div>
              <h3 className="order-card__title seller-status__title">Application status</h3>
              <p className="seller-status__meta">
                Submitted {formatOrderDate(registration.createdAt)}
                {registration.updatedAt && registration.updatedAt !== registration.createdAt
                  ? ` · updated ${formatOrderDate(registration.updatedAt)}`
                  : ''}
              </p>
            </div>
            <span className={sellerRegistrationBadgeClass(registration.status)}>
              {registration.status === 'NeedsMoreInfo' ? 'More info needed' : registration.status}
            </span>
          </div>

          {registration.adminNote ? (
            <p className="order-note">
              <strong>Note from the review team:</strong> {registration.adminNote}
            </p>
          ) : null}

          {registration.canEdit ? (
            <p className="seller-status__hint">
              Update the form below and submit again — you do not need to redo the identity check.
            </p>
          ) : registration.status === 'Pending' ? (
            <p className="seller-status__hint">
              We are reviewing your application. You cannot edit it while it is under review.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="account-card">
        <h3 className="order-card__title">
          Step 1 — Identity
          {kycDone ? <span className="order-card__count">Done</span> : null}
        </h3>
        <KycStep kyc={kyc} onVerified={setKyc} />
      </section>

      <section className={`account-card${kycDone ? '' : ' seller-locked'}`}>
        <h3 className="order-card__title">
          Step 2 — Business profile
          {kycDone && !editing ? (
            <span className="order-card__count order-card__count--muted">Locked</span>
          ) : null}
        </h3>

        {/*
          The reason the fields are dead sits in the status card at the top of the
          page, which is off-screen by the time you reach the form. Repeat it here.
        */}
        {kycDone && !editing ? (
          <p className="seller-lock-notice">
            <i className="fa-solid fa-lock" aria-hidden />
            <span>
              {registration?.status === 'Approved'
                ? 'Your application was approved, so this form is closed. Change your shop details from the seller dashboard.'
                : 'These fields are read-only while your application is being reviewed. You can edit them again if the team asks for changes or rejects the application.'}
            </span>
          </p>
        ) : null}

        {!kycDone ? (
          <p className="account-muted">
            Finish the identity check first. It only takes a minute.
          </p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <fieldset disabled={!editing} className="seller-fieldset">
              <div className="seller-form__row">
                <label className="seller-field">
                  <span className="seller-field__label">Shop name *</span>
                  <input
                    className="seller-input"
                    value={form.shopName}
                    maxLength={150}
                    onChange={(e) => patch('shopName', e.target.value)}
                    placeholder="TechZone Official"
                  />
                  {errors.shopName ? (
                    <span className="form-field-error">{errors.shopName}</span>
                  ) : null}
                </label>

                <div className="seller-field">
                  <span className="seller-field__label">How are you selling? *</span>
                  <SelectField
                    value={form.businessType}
                    options={BUSINESS_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    onChange={(value) => patch('businessType', value as SellerBusinessType)}
                  />
                  <span className="seller-field__hint">
                    {BUSINESS_TYPES.find((t) => t.value === form.businessType)?.hint}
                  </span>
                </div>
              </div>

              {needsLicense ? (
                <div className="seller-form__row">
                  <label className="seller-field">
                    <span className="seller-field__label">Tax code *</span>
                    <input
                      className="seller-input"
                      value={form.taxCode}
                      maxLength={32}
                      inputMode="numeric"
                      onChange={(e) => patch('taxCode', e.target.value)}
                      placeholder="0123456789"
                    />
                    {errors.taxCode ? (
                      <span className="form-field-error">{errors.taxCode}</span>
                    ) : null}
                  </label>

                  <div className="seller-field">
                    <span className="seller-field__label">Business licence *</span>
                    <div className="seller-license">
                      {form.licenseImageUrl ? (
                        <a href={form.licenseImageUrl} target="_blank" rel="noreferrer">
                          <img src={form.licenseImageUrl} alt="Business licence" />
                        </a>
                      ) : (
                        <span className="seller-license__empty">
                          <i className="fa-regular fa-file-lines" aria-hidden />
                        </span>
                      )}
                      <input
                        ref={licenseInput}
                        type="file"
                        accept="image/*"
                        className="kyc-slot__input"
                        onChange={(e) => void handleLicensePick(e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        className="account-btn account-btn--secondary account-btn--sm"
                        disabled={uploadingLicense || !isCloudinaryConfigured()}
                        onClick={() => licenseInput.current?.click()}
                      >
                        {uploadingLicense
                          ? 'Uploading…'
                          : form.licenseImageUrl
                            ? 'Replace'
                            : 'Upload licence'}
                      </button>
                    </div>
                    {errors.licenseImageUrl ? (
                      <span className="form-field-error">{errors.licenseImageUrl}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="seller-form__row">
                <label className="seller-field">
                  <span className="seller-field__label">Contact phone</span>
                  <input
                    className="seller-input"
                    value={form.contactPhone}
                    maxLength={20}
                    inputMode="tel"
                    onChange={(e) => patch('contactPhone', e.target.value)}
                    placeholder="0900000000"
                  />
                </label>
                <label className="seller-field">
                  <span className="seller-field__label">Contact email</span>
                  <input
                    className="seller-input"
                    value={form.contactEmail}
                    maxLength={256}
                    onChange={(e) => patch('contactEmail', e.target.value)}
                    placeholder="shop@example.com"
                  />
                  {errors.contactEmail ? (
                    <span className="form-field-error">{errors.contactEmail}</span>
                  ) : null}
                </label>
              </div>

              <label className="seller-field">
                <span className="seller-field__label">Business address</span>
                <input
                  className="seller-input"
                  value={form.businessAddress}
                  maxLength={300}
                  onChange={(e) => patch('businessAddress', e.target.value)}
                  placeholder="Warehouse or store address"
                />
              </label>

              <label className="seller-field">
                <span className="seller-field__label">What will you sell?</span>
                <textarea
                  className="seller-input seller-input--area"
                  rows={3}
                  maxLength={1000}
                  value={form.businessInfo}
                  onChange={(e) => patch('businessInfo', e.target.value)}
                  placeholder="Product categories, brands, where you source from…"
                />
              </label>
            </fieldset>

            {editing ? (
              <div className="order-detail__actions">
                <button
                  type="submit"
                  className="account-btn account-btn--primary"
                  disabled={!canSubmit}
                >
                  {submitting
                    ? 'Submitting…'
                    : registration
                      ? 'Resubmit application'
                      : 'Submit application'}
                </button>
              </div>
            ) : null}
          </form>
        )}
      </section>
    </div>
  );
}
