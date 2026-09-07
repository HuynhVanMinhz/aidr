import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { CloseIcon, ImageIcon, PaperclipIcon, SendIcon, TagIcon } from './ChatIcons';
import { ChatProductPicker } from './ChatProductPicker';
import { useToast } from '../../hooks/useToast';
import { buildProductLink } from '../../utils/chatUi';
import { isCloudinaryConfigured, uploadChatImageToCloudinary } from '../../utils/cloudinaryUpload';
import type { ProductListItem } from '../../types/catalog';

const MAX_CONTENT = 2000;
const MAX_ATTACHMENT_URL = 512;
/** Show the counter only when the limit is close enough to matter. */
const COUNTER_THRESHOLD = MAX_CONTENT - 200;
const MAX_TEXTAREA_PX = 140;

export type ChatComposerHandle = {
  /** Used by the conversation pane's drop target. */
  attachFiles: (files: FileList | File[]) => void;
};

type ChatComposerProps = {
  threadId: string | null;
  peerName: string;
  shopId: string | null;
  shopName: string;
  sending: boolean;
  onSend: (payload: { content: string | null; attachmentUrl: string | null }) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
};

type Attachment = {
  url: string;
  /** Object URL shown while the upload is still running. */
  previewUrl: string;
  name: string;
  uploading: boolean;
};

type ProductChip = {
  productId: string;
  name: string;
};

function linkError(url: string): string | null {
  if (!url) return null;
  if (url.length > MAX_ATTACHMENT_URL) {
    return `Link must not exceed ${MAX_ATTACHMENT_URL} characters.`;
  }
  if (!/^https?:\/\//i.test(url)) return 'Link must start with http:// or https://';
  return null;
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer(
    { threadId, peerName, shopId, shopName, sending, onSend, onTyping },
    ref,
  ) {
    const toast = useToast();
    const [draft, setDraft] = useState('');
    const [productChips, setProductChips] = useState<ProductChip[]>([]);
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [urlDraft, setUrlDraft] = useState('');
    const [showUrlField, setShowUrlField] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const urlInputRef = useRef<HTMLInputElement | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    const canUpload = isCloudinaryConfigured();

    function releaseObjectUrl() {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }

    function clearAttachment() {
      releaseObjectUrl();
      setAttachment(null);
    }

    async function uploadImage(file: File) {
      releaseObjectUrl();
      const previewUrl = URL.createObjectURL(file);
      objectUrlRef.current = previewUrl;
      setAttachment({ url: '', previewUrl, name: file.name, uploading: true });

      try {
        const { secureUrl } = await uploadChatImageToCloudinary(file);
        if (secureUrl.length > MAX_ATTACHMENT_URL) {
          throw new Error('The uploaded image URL is too long to send.');
        }
        setAttachment((current) =>
          current ? { ...current, url: secureUrl, uploading: false } : current,
        );
      } catch (err) {
        clearAttachment();
        toast.error(err instanceof Error ? err.message : 'Unable to upload the image.');
      }
    }

    function attachFiles(files: FileList | File[]) {
      const file = Array.from(files).find((item) => item.type.startsWith('image/'));
      if (!file) {
        toast.error('Only image files can be attached.');
        return;
      }
      if (!canUpload) {
        toast.error('Image upload is not configured. Paste an image link instead.');
        setShowUrlField(true);
        return;
      }
      void uploadImage(file);
    }

    useImperativeHandle(ref, () => ({ attachFiles }));

    // A draft belongs to the conversation it was typed in.
    useEffect(() => {
      setDraft('');
      setProductChips([]);
      setUrlDraft('');
      setShowUrlField(false);
      setPickerOpen(false);
      clearAttachment();
    }, [threadId]);

    useEffect(() => releaseObjectUrl, []);

    useEffect(() => {
      const node = textareaRef.current;
      if (!node) return;

      node.style.height = 'auto';
      // scrollHeight covers content + padding only; the box is border-box, so add the borders back
      // or the last line gets clipped.
      const borders = node.offsetHeight - node.clientHeight;
      node.style.height = `${Math.min(node.scrollHeight + borders, MAX_TEXTAREA_PX)}px`;
    }, [draft]);

    useEffect(() => {
      if (showUrlField) urlInputRef.current?.focus();
    }, [showUrlField]);

    // Stop broadcasting "typing" when the composer unmounts or the thread changes.
    useEffect(() => {
      return () => {
        if (threadId) onTyping(false);
      };
    }, [onTyping, threadId]);

    const trimmedUrl = urlDraft.trim();
    const urlError = linkError(trimmedUrl);
    const attachmentUrl = attachment?.url || trimmedUrl;
    const busy = sending || Boolean(attachment?.uploading);
    const canSend =
      Boolean(threadId) &&
      !busy &&
      !urlError &&
      Boolean(draft.trim() || attachmentUrl || productChips.length > 0);

    async function submit() {
      if (!canSend || !threadId) return;

      const linkSuffix = productChips
        .map((chip) => buildProductLink(chip.productId))
        .join(' ');
      const text = draft.trim();
      const content = [text, linkSuffix].filter(Boolean).join(' ') || null;

      await onSend({
        content,
        attachmentUrl: attachmentUrl || null,
      });

      setDraft('');
      setProductChips([]);
      setUrlDraft('');
      setShowUrlField(false);
      clearAttachment();
      textareaRef.current?.focus();
    }

    function handleSubmit(event: FormEvent) {
      event.preventDefault();
      // The workspace already surfaces the failure as a toast and keeps the draft.
      void submit().catch(() => {});
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void submit().catch(() => {});
      }
    }

    function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.some((file) => file.type.startsWith('image/'))) {
        event.preventDefault();
        attachFiles(files);
      }
    }

    function handleChange(value: string) {
      setDraft(value);
      if (threadId) onTyping(value.trim().length > 0);
    }

    function handlePickProduct(product: ProductListItem) {
      setPickerOpen(false);
      setProductChips((current) => {
        if (current.some((chip) => chip.productId === product.productId)) return current;
        return [...current, { productId: product.productId, name: product.name }];
      });
      textareaRef.current?.focus();
    }

    function removeProductChip(productId: string) {
      setProductChips((current) => current.filter((chip) => chip.productId !== productId));
    }

    return (
      <form className="chat-composer" onSubmit={handleSubmit}>
        {pickerOpen && shopId ? (
          <ChatProductPicker
            shopId={shopId}
            shopName={shopName}
            onPick={handlePickProduct}
            onClose={() => setPickerOpen(false)}
          />
        ) : null}

        {attachment ? (
          <div className="chat-composer__preview">
            <img src={attachment.url || attachment.previewUrl} alt="" />
            <span className="chat-composer__preview-body">
              <span className="chat-composer__preview-name">{attachment.name}</span>
              <span className="chat-composer__preview-state">
                {attachment.uploading ? 'Uploading…' : 'Ready to send'}
              </span>
            </span>
            {attachment.uploading ? <span className="chat-spinner" aria-hidden="true" /> : null}
            <button
              type="button"
              className="chat-icon-btn"
              onClick={clearAttachment}
              aria-label="Remove image"
            >
              <CloseIcon />
            </button>
          </div>
        ) : null}

        {showUrlField ? (
          <div className="chat-composer__attachment">
            <input
              ref={urlInputRef}
              type="url"
              className={`chat-input${urlError ? ' is-invalid' : ''}`}
              placeholder="https://… link to an image or file"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              maxLength={MAX_ATTACHMENT_URL}
              aria-label="Attachment link"
              aria-invalid={Boolean(urlError)}
            />
            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => {
                setUrlDraft('');
                setShowUrlField(false);
              }}
              aria-label="Remove attachment link"
            >
              <CloseIcon />
            </button>
          </div>
        ) : null}

        {urlError ? (
          <p className="chat-composer__error" role="alert">
            {urlError}
          </p>
        ) : null}

        {productChips.length > 0 ? (
          <div className="chat-composer__chips" aria-label="Products to share">
            {productChips.map((chip) => (
              <span key={chip.productId} className="chat-composer__chip">
                <TagIcon />
                <span className="chat-composer__chip-name">{chip.name}</span>
                <button
                  type="button"
                  className="chat-composer__chip-remove"
                  onClick={() => removeProductChip(chip.productId)}
                  aria-label={`Remove ${chip.name}`}
                >
                  <CloseIcon />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="chat-composer__row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="chat-composer__file"
            onChange={(e) => {
              if (e.target.files?.length) attachFiles(e.target.files);
              e.target.value = '';
            }}
            tabIndex={-1}
          />

          <button
            type="button"
            className="chat-icon-btn"
            onClick={() => (canUpload ? fileInputRef.current?.click() : setShowUrlField(true))}
            title={canUpload ? 'Send a photo' : 'Attach an image link'}
            aria-label={canUpload ? 'Send a photo' : 'Attach an image link'}
            disabled={!threadId || busy}
          >
            <ImageIcon />
          </button>

          <button
            type="button"
            className={`chat-icon-btn${pickerOpen ? ' is-active' : ''}`}
            onClick={() => setPickerOpen((v) => !v)}
            title="Share a product"
            aria-label="Share a product"
            aria-pressed={pickerOpen}
            disabled={!threadId || !shopId}
          >
            <TagIcon />
          </button>

          {canUpload ? (
            <button
              type="button"
              className={`chat-icon-btn chat-composer__link-btn${showUrlField ? ' is-active' : ''}`}
              onClick={() => setShowUrlField((v) => !v)}
              title="Attach a link"
              aria-label="Attach a link"
              aria-pressed={showUrlField}
              disabled={!threadId}
            >
              <PaperclipIcon />
            </button>
          ) : null}

          <textarea
            ref={textareaRef}
            className="chat-composer__input"
            placeholder={threadId ? `Message ${peerName}…` : 'Select a conversation first'}
            value={draft}
            rows={1}
            maxLength={MAX_CONTENT}
            disabled={!threadId || sending}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => threadId && onTyping(false)}
            aria-label="Message"
          />

          <button
            type="submit"
            className="chat-send-btn"
            disabled={!canSend}
            aria-label="Send message"
            title="Send (Enter)"
          >
            {busy ? <span className="chat-spinner" aria-hidden="true" /> : <SendIcon />}
          </button>
        </div>

        <div className="chat-composer__hint">
          <span>
            <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
            {canUpload ? ' · drag, drop or paste an image' : ''}
          </span>
          {draft.length > COUNTER_THRESHOLD ? (
            <span className="chat-composer__counter">
              {draft.length}/{MAX_CONTENT}
            </span>
          ) : null}
        </div>
      </form>
    );
  },
);
