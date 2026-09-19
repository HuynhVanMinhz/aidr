import { useEffect, useRef, useState } from 'react';

type UploadResult = { secureUrl: string };

type VideoDropzoneProps = {
  id: string;
  value: string;
  onChange: (url: string) => void;
  upload: (file: File) => Promise<UploadResult>;
  validate?: (file: File) => void;
  disabled?: boolean;
  emptyLabel: string;
  hint?: string;
  onError?: (message: string) => void;
  onUploaded?: (url: string) => void;
};

/**
 * Click-or-drop video upload with an inline preview - same interaction as shop
 * image dropzones, but for return evidence clips.
 */
export function VideoDropzone({
  id,
  value,
  onChange,
  upload,
  validate,
  disabled,
  emptyLabel,
  hint,
  onError,
  onUploaded,
}: VideoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = preview ?? (value.trim() || null);
  const busy = uploading || Boolean(disabled);

  function replacePreview(next: string | null) {
    setPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return next;
    });
  }

  async function handleFile(file: File) {
    try {
      validate?.(file);
      replacePreview(URL.createObjectURL(file));
      setUploading(true);
      const uploaded = await upload(file);
      replacePreview(null);
      onChange(uploaded.secureUrl);
      onUploaded?.(uploaded.secureUrl);
    } catch (err) {
      replacePreview(null);
      onError?.(err instanceof Error ? err.message : 'Video upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function openPicker() {
    if (busy) return;
    inputRef.current?.click();
  }

  return (
    <div
      className={`account-dropzone${dragging ? ' is-dragging' : ''}${shown ? ' has-preview' : ''}${
        uploading ? ' is-uploading' : ''
      }`}
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        openPicker();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!busy) setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        if (busy) return;
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
        className="account-dropzone__input"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      {shown ? (
        <div className="account-dropzone__preview">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={shown} preload="metadata" muted playsInline />
          <div className="account-dropzone__overlay">
            <span className="account-btn account-btn--secondary account-btn--sm">
              {uploading ? 'Uploading…' : 'Change video'}
            </span>
          </div>
        </div>
      ) : (
        <div className="account-dropzone__empty">
          <span className="account-dropzone__badge" aria-hidden>
            <i className="fa-solid fa-cloud-arrow-up" />
          </span>
          <p className="account-dropzone__title">
            {uploading ? 'Uploading…' : dragging ? 'Drop video to upload' : emptyLabel}
          </p>
          <p className="account-dropzone__browse">
            or <span>click to browse</span>
          </p>
          {hint ? <p className="account-dropzone__hint">{hint}</p> : null}
        </div>
      )}
    </div>
  );
}
