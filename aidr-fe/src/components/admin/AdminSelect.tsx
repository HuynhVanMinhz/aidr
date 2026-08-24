import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type AdminSelectOption = {
  value: string;
  label: string;
};

type AdminSelectProps = {
  id?: string;
  value: string;
  options: AdminSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  block?: boolean;
  className?: string;
  menuAlign?: 'start' | 'end';
  onChange: (value: string) => void;
  onBlur?: () => void;
};

export function AdminSelect({
  id,
  value,
  options,
  placeholder = 'Select',
  disabled = false,
  size = 'md',
  block = true,
  className,
  menuAlign = 'start',
  onChange,
  onBlur,
}: AdminSelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        onBlur?.();
      }
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onBlur]);

  const sizeClass = size === 'sm' ? 'btn-sm' : '';

  return (
    <div
      ref={rootRef}
      className={[
        'dropdown aidr-admin-select',
        block ? 'w-100' : '',
        open ? 'show' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        id={triggerId}
        type="button"
        className={[
          'dropdown-toggle btn btn-outline-light rounded',
          sizeClass,
          block ? 'w-100' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          setOpen((current) => {
            if (current) onBlur?.();
            return !current;
          });
        }}
      >
        <span className="text-truncate">{selected?.label || placeholder}</span>
      </button>
      <div
        className={[
          'dropdown-menu',
          menuAlign === 'end' ? 'dropdown-menu-end' : '',
          open ? 'show' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="listbox"
        aria-labelledby={triggerId}
      >
        {options.map((option) => (
          <button
            key={option.value || '__empty'}
            type="button"
            className={`dropdown-item${option.value === value ? ' active' : ''}`}
            role="option"
            aria-selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
              onBlur?.();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
