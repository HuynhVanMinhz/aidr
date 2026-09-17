import { useEffect, useId, useRef, useState } from 'react';
import {
  isReturnVideoUrl,
  returnEvidencePosterUrl,
  toPlayableReturnMediaUrl,
} from '../../utils/returnMedia';
import '../../styles/returnEvidence.css';

export type ReturnEvidenceItem = {
  evidenceId: string;
  evidenceType: string;
  mediaUrl: string;
};

type ReturnEvidencePanelProps = {
  evidences: ReturnEvidenceItem[];
  emptyLabel?: string;
};

function formatLabel(type: string) {
  if (type === 'Unboxing') return 'Unboxing';
  if (type === 'Testing') return 'Testing';
  return type || 'Evidence';
}

function InlineVideo({ url, title }: { url: string; title: string }) {
  const playable = toPlayableReturnMediaUrl(url);
  const poster = returnEvidencePosterUrl(url);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="return-evidence-player__fallback">
        <p className="mb-2">Unable to play this clip in the browser.</p>
        <a href={playable} target="_blank" rel="noreferrer" className="link-primary">
          Open in new tab
        </a>
      </div>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      className="return-evidence-player__video"
      controls
      playsInline
      preload="metadata"
      poster={poster}
      src={playable}
      title={title}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Evidence list for admin / seller detail pages — playable inline video.
 */
export function ReturnEvidencePanel({
  evidences,
  emptyLabel = 'No evidence uploaded.',
}: ReturnEvidencePanelProps) {
  if (evidences.length === 0) {
    return <p className="text-muted mb-0">{emptyLabel}</p>;
  }

  return (
    <div className="row g-3 return-evidence-panel">
      {evidences.map((evidence) => {
        const playable = toPlayableReturnMediaUrl(evidence.mediaUrl);
        const video = isReturnVideoUrl(evidence.mediaUrl);

        return (
          <div className="col-md-6" key={evidence.evidenceId}>
            <div className="border rounded p-2 h-100">
              <p className="fw-medium mb-2">{formatLabel(evidence.evidenceType)}</p>
              {video ? (
                <InlineVideo url={evidence.mediaUrl} title={formatLabel(evidence.evidenceType)} />
              ) : (
                <img
                  src={evidence.mediaUrl}
                  alt={formatLabel(evidence.evidenceType)}
                  className="w-100 rounded"
                  style={{ maxHeight: 240, objectFit: 'cover' }}
                />
              )}
              <a
                href={playable}
                target="_blank"
                rel="noreferrer"
                className="link-primary fs-12 d-inline-block mt-2"
              >
                Open in new tab
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ReturnEvidenceGalleryProps = {
  evidences: ReturnEvidenceItem[];
};

/**
 * Buyer storefront grid — click opens a lightbox video/image player.
 */
export function ReturnEvidenceGallery({ evidences }: ReturnEvidenceGalleryProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const active = evidences.find((e) => e.evidenceId === activeId) ?? null;

  useEffect(() => {
    if (!active) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (evidences.length === 0) {
    return (
      <p className="return-empty">No photos or videos were attached to this request.</p>
    );
  }

  return (
    <>
      <ul className="return-evidence-grid">
        {evidences.map((evidence) => {
          const video = isReturnVideoUrl(evidence.mediaUrl);
          const playable = toPlayableReturnMediaUrl(evidence.mediaUrl);
          const poster = returnEvidencePosterUrl(evidence.mediaUrl);

          return (
            <li key={evidence.evidenceId}>
              <button
                type="button"
                className="return-evidence"
                onClick={() => setActiveId(evidence.evidenceId)}
                aria-label={`View ${formatLabel(evidence.evidenceType)} evidence`}
              >
                <span className="return-evidence__media">
                  {video ? (
                    <>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video
                        src={playable}
                        poster={poster}
                        preload="metadata"
                        muted
                        playsInline
                      />
                      <span className="return-evidence__play" aria-hidden>
                        <i className="fa-solid fa-play" />
                      </span>
                    </>
                  ) : (
                    <img
                      src={evidence.mediaUrl}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.closest('.return-evidence')?.classList.add(
                          'return-evidence--broken',
                        );
                      }}
                    />
                  )}
                </span>
                <span className="return-evidence__label">{formatLabel(evidence.evidenceType)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {active ? (
        <div
          className="return-evidence-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={dialogRef}
          tabIndex={-1}
          onClick={() => setActiveId(null)}
        >
          <div
            className="return-evidence-lightbox__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="return-evidence-lightbox__head">
              <h4 id={titleId} className="return-evidence-lightbox__title">
                {formatLabel(active.evidenceType)}
              </h4>
              <button
                type="button"
                className="return-evidence-lightbox__close"
                aria-label="Close"
                onClick={() => setActiveId(null)}
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </div>
            <div className="return-evidence-lightbox__body">
              {isReturnVideoUrl(active.mediaUrl) ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  key={active.evidenceId}
                  src={toPlayableReturnMediaUrl(active.mediaUrl)}
                  poster={returnEvidencePosterUrl(active.mediaUrl)}
                  controls
                  playsInline
                  autoPlay
                  preload="auto"
                />
              ) : (
                <img src={active.mediaUrl} alt={formatLabel(active.evidenceType)} />
              )}
            </div>
            <a
              href={toPlayableReturnMediaUrl(active.mediaUrl)}
              target="_blank"
              rel="noreferrer"
              className="return-evidence-lightbox__open"
            >
              Open original in new tab
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}
