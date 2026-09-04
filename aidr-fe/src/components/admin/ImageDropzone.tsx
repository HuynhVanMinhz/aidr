import { useEffect, useRef, useState } from 'react';

type UploadResult = { secureUrl: string };

type ImageDropzoneProps = {
  /** Id for the hidden file input, so a <label htmlFor> still reaches it. */
  id: string;
  /** Current image URL, or '' when nothing is set yet. */
  value: string;
  /** Called with the uploaded URL once the upload succeeds. */
  onChange: (url: string) => void;
  upload: (file: File) => Promise<UploadResult>;
  /** Throws with a readable message when the file is not acceptable. */
  validate?: (file: File) => void;
  /** True when the host cannot accept an upload right now (saving, read-only). */
  disabled?: boolean;
  /** Heading in the empty state, e.g. "Drop your logo here". */
  emptyLabel: string;
  /** Small print under the heading — size and format limits. */
  hint?: string;
  previewAlt: string;
  /** Upload failures, so the page can show them where its other errors go. */
  onError?: (message: string) => void;
  onUploaded?: (url: string) => void;
};

/**
 * Click-or-drop image upload with an inline preview.
 *
 * The preview switches to a local blob the moment a file is chosen, so the box
 * shows the new image while the upload is still in flight rather than sitting
 * empty; the blob is revoked as soon as the hosted URL replaces it.
 */
export function ImageDropzone({
  id,
  value,
  onChange,
  upload,
  validate,
  disabled,
  emptyLabel,
  hint,
  previewAlt,
  onError,
  onUploaded,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  // A blob URL outlives the component unless it is revoked by hand.
  useEffect(
    () => () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = preview ?? (value.trim() || null);
  const busy = uploading || disabled;

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
      onError?.(err instanceof Error ? err.message : 'Image upload failed.');
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
      className={`aidr-dropzone${dragging ? ' is-dragging' : ''}${shown ? ' has-preview' : ''}${
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
        accept="image/*"
        className="d-none"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset first: picking the same file twice must fire change again.
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      {shown ? (
        <div className="aidr-dropzone__preview">
          <img src={shown} alt={previewAlt} />
          <div className="aidr-dropzone__overlay">
            <span className="btn btn-sm btn-light">
              {uploading ? 'Uploading…' : 'Change image'}
            </span>
          </div>
        </div>
      ) : (
        <div className="aidr-dropzone__empty">
          <div className="aidr-dropzone__badge">
            <i className="bx bx-cloud-upload" />
          </div>
          <h5 className="mt-3 mb-1">
            {uploading ? 'Uploading…' : dragging ? 'Drop image to upload' : emptyLabel}
          </h5>
          <p className="text-muted mb-2 fs-13">
            or <span className="text-primary fw-semibold">click to browse</span>
          </p>
          {hint ? <p className="text-muted mb-0 fs-12">{hint}</p> : null}
        </div>
      )}
    </div>
  );
}
