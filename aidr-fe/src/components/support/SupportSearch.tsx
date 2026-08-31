import type { FormEvent } from 'react';

interface SupportSearchProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

export function SupportSearch({
  id,
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
}: SupportSearchProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit?.();
  }

  return (
    <form className="support-search" onSubmit={handleSubmit} role="search">
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <div className="support-search__field">
        <i className="fa-solid fa-magnifying-glass support-search__icon" aria-hidden />
        <input
          id={id}
          type="search"
          className="support-search__input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            className="support-search__clear"
            onClick={() => onChange('')}
            aria-label="Clear search"
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        ) : null}
      </div>
    </form>
  );
}
