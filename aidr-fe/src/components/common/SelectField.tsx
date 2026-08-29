import { useEffect, useId, useRef, useState } from 'react';

export type SelectFieldOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: readonly SelectFieldOption[];
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Right-align the menu when the trigger sits at the end of a row. */
  menuAlign?: 'start' | 'end';
};

/**
 * The same dropdown the shop page uses for sorting, made reusable so filters
 * look identical everywhere instead of falling back to the native select.
 */
export function SelectField({
  value,
  options,
  onChange,
  label,
  placeholder = 'Select',
  disabled = false,
  menuAlign = 'start',
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="aidr-select-field">
      {label ? (
        <label className="aidr-select-field__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className={`aidr-select${open ? ' is-open' : ''}`} ref={rootRef}>
        <button
          id={id}
          type="button"
          className="aidr-select__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{selected?.label ?? placeholder}</span>
          <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} aria-hidden />
        </button>
        {open ? (
          <ul
            className={`aidr-select__menu${menuAlign === 'end' ? ' aidr-select__menu--end' : ''}`}
            role="listbox"
            aria-label={label ?? placeholder}
          >
            {options.map((opt) => (
              <li key={opt.value || 'all'} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  className={`aidr-select__option${opt.value === value ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                  {opt.value === value ? <i className="fa-solid fa-check" aria-hidden /> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
