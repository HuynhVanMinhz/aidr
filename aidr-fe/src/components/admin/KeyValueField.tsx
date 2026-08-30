import { useEffect, useId, useRef, useState } from 'react';
import { IconifyIcon } from './IconifyIcon';
import { RawJsonEscapeHatch } from './TagsField';
import {
  emptyKeyValueRow,
  parseKeyValueRows,
  serializeKeyValueRows,
  type KeyValueRow,
} from '../../utils/structuredJson';

type KeyValueFieldProps = {
  id?: string;
  /** The stored JSON object, e.g. `{"ram":"12GB"}`. Empty string means none. */
  value: string;
  onChange: (json: string) => void;
  onBlur?: () => void;
  keyLabel?: string;
  valueLabel?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  keySuggestions?: string[];
  invalid?: boolean;
};

/** One blank row so the first pair can be typed without hunting for a button. */
function withBlankRow(rows: KeyValueRow[]): KeyValueRow[] {
  return rows.length ? rows : [emptyKeyValueRow()];
}

export function KeyValueField({
  id,
  value,
  onChange,
  onBlur,
  keyLabel = 'Name',
  valueLabel = 'Value',
  keyPlaceholder = 'RAM',
  valuePlaceholder = '12GB',
  addLabel = 'Add row',
  keySuggestions = [],
  invalid = false,
}: KeyValueFieldProps) {
  const parsed = parseKeyValueRows(value);
  const [rows, setRows] = useState<KeyValueRow[]>(() => withBlankRow(parsed.value));
  const [raw, setRaw] = useState(parsed.recognized ? null : value);
  const emitted = useRef(value);
  const listId = useId();

  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const next = parseKeyValueRows(value);
    setRows(withBlankRow(next.value));
    setRaw(next.recognized ? null : value);
  }, [value]);

  function commit(next: KeyValueRow[]) {
    setRows(next);
    const json = serializeKeyValueRows(next);
    emitted.current = json;
    onChange(json);
  }

  function patchRow(rowId: string, patch: Partial<KeyValueRow>) {
    commit(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  if (raw !== null) {
    return (
      <RawJsonEscapeHatch
        id={id}
        value={raw}
        hint="This field holds a value the table editor cannot show — nested objects or a non-object value. Edit it as JSON, or clear it to start over."
        onChange={(next) => {
          setRaw(next);
          emitted.current = next;
          onChange(next);
        }}
        onReset={() => {
          setRaw(null);
          commit(withBlankRow([]));
        }}
        onBlur={onBlur}
      />
    );
  }

  // A key typed twice would silently lose the earlier row on save; flag it here.
  const duplicateKeys = new Set(
    rows
      .map((r) => r.key.trim().toLowerCase())
      .filter((k, i, all) => k && all.indexOf(k) !== i),
  );

  return (
    <div className={`kv-field${invalid ? ' kv-field--invalid' : ''}`}>
      <datalist id={listId}>
        {keySuggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="kv-field__head">
        <span>{keyLabel}</span>
        <span>{valueLabel}</span>
        <span aria-hidden />
      </div>

      {rows.map((row, index) => {
        const duplicate = duplicateKeys.has(row.key.trim().toLowerCase());
        return (
          <div className="kv-field__row" key={row.id}>
            <input
              id={index === 0 ? id : undefined}
              type="text"
              className={`form-control${duplicate ? ' is-invalid' : ''}`}
              list={listId}
              aria-label={`${keyLabel} ${index + 1}`}
              placeholder={keyPlaceholder}
              value={row.key}
              onChange={(e) => patchRow(row.id, { key: e.target.value })}
              onBlur={onBlur}
            />
            <input
              type="text"
              className="form-control"
              aria-label={`${valueLabel} ${index + 1}`}
              placeholder={valuePlaceholder}
              value={row.value}
              onChange={(e) => patchRow(row.id, { value: e.target.value })}
              onBlur={onBlur}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-danger kv-field__remove"
              aria-label={`Remove ${row.key.trim() || 'row'}`}
              disabled={rows.length === 1 && !row.key && !row.value}
              onClick={() => commit(withBlankRow(rows.filter((r) => r.id !== row.id)))}
            >
              <IconifyIcon icon="solar:trash-bin-minimalistic-2-outline" />
            </button>
          </div>
        );
      })}

      {duplicateKeys.size > 0 ? (
        <p className="form-field-error d-block mb-0 mt-1">
          Duplicate names are highlighted — only the last one would be saved.
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-sm btn-outline-primary mt-2"
        onClick={() => commit([...rows, emptyKeyValueRow()])}
      >
        <IconifyIcon icon="solar:add-circle-outline" className="me-1" />
        {addLabel}
      </button>
    </div>
  );
}
