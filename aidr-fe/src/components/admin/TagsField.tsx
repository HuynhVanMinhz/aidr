import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { IconifyIcon } from './IconifyIcon';
import { parseTagList, serializeTagList, splitTags } from '../../utils/structuredJson';

type TagsFieldProps = {
  id?: string;
  /** The stored JSON array, e.g. `["flagship","5g"]`. Empty string means none. */
  value: string;
  onChange: (json: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxTags?: number;
  suggestions?: string[];
  invalid?: boolean;
};

export function TagsField({
  id,
  value,
  onChange,
  onBlur,
  placeholder = 'Type a tag and press Enter',
  maxTags = 30,
  suggestions = [],
  invalid = false,
}: TagsFieldProps) {
  const parsed = parseTagList(value);
  const [tags, setTags] = useState<string[]>(parsed.value);
  const [raw, setRaw] = useState(parsed.recognized ? null : value);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // What we last pushed upwards, so an echo of our own value does not clobber
  // whatever the seller is halfway through typing.
  const emitted = useRef(value);

  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const next = parseTagList(value);
    setTags(next.value);
    setRaw(next.recognized ? null : value);
  }, [value]);

  function commit(next: string[]) {
    const capped = next.slice(0, maxTags);
    setTags(capped);
    const json = serializeTagList(capped);
    emitted.current = json;
    onChange(json);
  }

  function addFrom(text: string) {
    const additions = splitTags(text);
    if (!additions.length) return;
    const lower = new Set(tags.map((t) => t.toLowerCase()));
    commit([...tags, ...additions.filter((t) => !lower.has(t.toLowerCase()))]);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addFrom(draft);
      return;
    }
    if (event.key === 'Backspace' && !draft && tags.length) {
      event.preventDefault();
      commit(tags.slice(0, -1));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    if (!text.includes(',') && !text.includes('\n')) return;
    event.preventDefault();
    addFrom(text);
  }

  if (raw !== null) {
    return (
      <RawJsonEscapeHatch
        id={id}
        value={raw}
        hint="This field holds a value the tag editor cannot show. Edit it as JSON, or clear it to start over."
        onChange={(next) => {
          setRaw(next);
          emitted.current = next;
          onChange(next);
        }}
        onReset={() => {
          setRaw(null);
          commit([]);
        }}
        onBlur={onBlur}
      />
    );
  }

  const unusedSuggestions = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div>
      <div
        className={`tag-field form-control${invalid ? ' is-invalid' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span key={tag} className="tag-field__chip">
            {tag}
            <button
              type="button"
              className="tag-field__remove"
              aria-label={`Remove ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                commit(tags.filter((t) => t !== tag));
              }}
            >
              <IconifyIcon icon="solar:close-circle-bold" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="tag-field__input"
          placeholder={tags.length ? '' : placeholder}
          value={draft}
          disabled={tags.length >= maxTags}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            addFrom(draft);
            onBlur?.();
          }}
        />
      </div>

      <div className="form-text d-flex flex-wrap align-items-center gap-2 mt-2">
        <span>
          Press Enter or comma to add. {tags.length}/{maxTags} used.
        </span>
        {unusedSuggestions.slice(0, 6).map((s) => (
          <button
            key={s}
            type="button"
            className="tag-field__suggestion"
            onClick={() => addFrom(s)}
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

type RawJsonEscapeHatchProps = {
  id?: string;
  value: string;
  hint: string;
  onChange: (value: string) => void;
  onReset: () => void;
  onBlur?: () => void;
};

/**
 * Shown only when an existing value does not fit the structured editor. It is
 * the old textarea, kept for exactly the case it was needed for.
 */
export function RawJsonEscapeHatch({
  id,
  value,
  hint,
  onChange,
  onReset,
  onBlur,
}: RawJsonEscapeHatchProps) {
  return (
    <div className="raw-json-field">
      <div className="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 mb-2">
        <IconifyIcon icon="solar:danger-triangle-bold" className="fs-18 flex-shrink-0" />
        <span className="fs-13">{hint}</span>
      </div>
      <textarea
        id={id}
        className="form-control font-monospace"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <button type="button" className="btn btn-sm btn-outline-danger mt-2" onClick={onReset}>
        Clear and use the editor
      </button>
    </div>
  );
}
