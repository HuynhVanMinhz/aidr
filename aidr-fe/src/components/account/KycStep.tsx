import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { verifyKyc } from '../../services/kycApi';
import type { KycVerification } from '../../types/kyc';
import { getApiErrorMessage } from '../../utils/apiError';
import { isCloudinaryConfigured, uploadKycImageToCloudinary } from '../../utils/cloudinaryUpload';


type Slot = 'front' | 'back' | 'selfie';

type Props = {
  kyc: KycVerification | null;
  onVerified: (result: KycVerification) => void;
};

const SLOT_META: Record<Slot, { title: string; hint: string; required: boolean }> = {
  front: {
    title: 'ID card - front',
    hint: 'All four corners in frame, no glare.',
    required: true,
  },
  back: {
    title: 'ID card - back',
    hint: 'Optional, but speeds up review.',
    required: false,
  },
  selfie: {
    title: 'Your photo',
    hint: 'Face the camera in good light, no hat or sunglasses.',
    required: true,
  },
};

export function KycStep({ kyc, onVerified }: Props) {
  const toast = useToast();
  const [urls, setUrls] = useState<Record<Slot, string>>({ front: '', back: '', selfie: '' });
  const [uploading, setUploading] = useState<Slot | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const inputs = {
    front: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
    selfie: useRef<HTMLInputElement>(null),
  };

  const cloudinaryReady = isCloudinaryConfigured();
  const passed = kyc?.status === 'Passed';
  const manualReview = kyc?.status === 'ManualReview';
  // The automated check never ran, so there are no OCR fields to show - only the
  // photos the applicant uploaded, which a person will read.
  const awaitingHuman = kyc?.provider === 'MANUAL';
  const canVerify = Boolean(urls.front && urls.selfie) && consentAccepted && !verifying;

  async function handlePick(slot: Slot, file: File | undefined) {
    if (!file) return;
    setUploading(slot);
    try {
      const uploaded = await uploadKycImageToCloudinary(file);
      setUrls((prev) => ({ ...prev, [slot]: uploaded.secureUrl }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to upload the photo.');
    } finally {
      setUploading(null);
      inputs[slot].current?.value && (inputs[slot].current!.value = '');
    }
  }

  async function handleVerify() {
    setVerifying(true);
    try {
      const result = await verifyKyc({
        frontImageUrl: urls.front,
        backImageUrl: urls.back || null,
        selfieImageUrl: urls.selfie,
      });
      const data = result.data;
      if (!data) throw new Error(result.message || 'Verification failed.');

      onVerified(data);
      if (data.status === 'Passed') {
        toast.success('Identity verified.');
      } else if (data.status === 'ManualReview') {
        toast.info(data.failureReason ?? 'A staff member will review your photos.');
      } else {
        toast.error(data.failureReason ?? 'Verification did not pass.');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to verify your identity.'));
    } finally {
      setVerifying(false);
    }
  }

  if (passed || manualReview) {
    return (
      <div className="kyc-result">
        <p className={`kyc-result__badge${manualReview ? ' kyc-result__badge--review' : ''}`}>
          <i className={`fa-solid ${manualReview ? 'fa-hourglass-half' : 'fa-circle-check'}`} aria-hidden />
          {manualReview ? 'Awaiting manual review' : 'Identity verified'}
        </p>
        {kyc?.isMock ? (
          <p className="kyc-step__warning">
            This result came from the local mock, not a real identity check. Set{' '}
            <code>Gemini:ApiKey</code> (or another provider key) and turn <code>Ekyc:UseMock</code> off before going live.
          </p>
        ) : null}

        {manualReview ? (
          <p className="kyc-result__hint">
            {kyc?.failureReason ??
              'Your photos were not a clear match, so a staff member will check them. You can still continue.'}
          </p>
        ) : null}

        {awaitingHuman ? (
          <>
            <div className="kyc-result__photos">
              {(
                [
                  ['Front', kyc?.frontImageUrl],
                  ['Back', kyc?.backImageUrl],
                  ['Portrait', kyc?.selfieImageUrl],
                ] as const
              )
                .filter(([, url]) => Boolean(url))
                .map(([label, url]) => (
                  <figure key={label} className="kyc-result__photo">
                    <img src={url as string} alt={`${label} of your submitted document`} />
                    <figcaption>{label}</figcaption>
                  </figure>
                ))}
            </div>
            <p className="kyc-result__note">
              These are the photos our team will check. Your shop name will be taken from the ID
              card once they confirm it.
            </p>
          </>
        ) : (
          <>
            <dl className="kyc-result__facts">
              <dt>Full name</dt>
              <dd>{kyc?.fullName || 'Not read from the card'}</dd>
              <dt>Document</dt>
              <dd>
                {kyc?.documentType || 'ID'} ·{' '}
                {kyc?.documentNumberMask || 'Number not read'}
              </dd>
              <dt>Date of birth</dt>
              <dd>{kyc?.dateOfBirth || 'Not read from the card'}</dd>
              {kyc?.faceMatchSimilarity != null ? (
                <>
                  <dt>Face match</dt>
                  <dd>{(kyc.faceMatchSimilarity * 100).toFixed(1)}%</dd>
                </>
              ) : null}
            </dl>
            <p className="kyc-result__note">
              Your shop will be registered under this name. It comes from the ID card and cannot be
              edited.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="kyc-step">
      {!cloudinaryReady ? (
        <p className="kyc-step__warning">
          Photo upload is not configured. Add <code>VITE_CLOUDINARY_*</code> to the frontend
          environment before verifying.
        </p>
      ) : null}

      {kyc?.status === 'Failed' && kyc.failureReason ? (
        <p className="kyc-step__warning">{kyc.failureReason}</p>
      ) : null}

      <p className="kyc-step__lead">
        We verify your identity before you can sell. Your ID photos are used only for this check.
        Images are uploaded to our storage provider and may be reviewed by our team. We keep a
        masked document number and do not sell your KYC data. See our{' '}
        <Link to="/privacy#identity-verification">Privacy Policy</Link> for details.
      </p>

      <div className="kyc-slot-grid">
        {(Object.keys(SLOT_META) as Slot[]).map((slot) => {
          const meta = SLOT_META[slot];
          const url = urls[slot];

          return (
            <div key={slot} className={`kyc-slot${url ? ' kyc-slot--filled' : ''}`}>
              <div className="kyc-slot__preview">
                {url ? (
                  <img src={url} alt={meta.title} />
                ) : (
                  <i
                    className={`fa-solid ${slot === 'selfie' ? 'fa-user' : 'fa-id-card'}`}
                    aria-hidden
                  />
                )}
              </div>
              <p className="kyc-slot__title">
                {meta.title}
                {meta.required ? <span aria-hidden> *</span> : null}
              </p>
              <p className="kyc-slot__hint">{meta.hint}</p>
              <input
                ref={inputs[slot]}
                type="file"
                accept="image/*"
                className="kyc-slot__input"
                onChange={(e) => void handlePick(slot, e.target.files?.[0])}
                disabled={!cloudinaryReady || uploading !== null}
              />
              <button
                type="button"
                className="account-btn account-btn--secondary account-btn--sm"
                disabled={!cloudinaryReady || uploading !== null}
                onClick={() => inputs[slot].current?.click()}
              >
                {uploading === slot ? 'Uploading…' : url ? 'Replace photo' : 'Choose photo'}
              </button>
            </div>
          );
        })}
      </div>

      <label className="kyc-step__consent">
        <input
          type="checkbox"
          checked={consentAccepted}
          onChange={(e) => setConsentAccepted(e.target.checked)}
          disabled={!cloudinaryReady || verifying}
        />
        <span>I understand how my ID photos will be used for identity verification.</span>
      </label>

      <button
        type="button"
        className="account-btn account-btn--primary"
        disabled={!canVerify}
        onClick={() => void handleVerify()}
      >
        {verifying ? 'Verifying…' : 'Verify my identity'}
      </button>
    </div>
  );
}
