import type { InputHTMLAttributes, ReactNode } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
  count?: number;
  variant?: 'parent' | 'child' | 'default';
};

export function FilterCheckbox({
  label,
  count,
  variant = 'default',
  className,
  id,
  ...rest
}: Props) {
  return (
    <label
      htmlFor={id}
      className={`catalog-filter-check catalog-filter-check--${variant}${className ? ` ${className}` : ''}`}
    >
      <input type="checkbox" id={id} className="catalog-filter-check__input" {...rest} />
      <span className="catalog-filter-check__box" aria-hidden />
      <span className="catalog-filter-check__label">{label}</span>
      {count != null ? <span className="catalog-filter-check__count">{count}</span> : null}
    </label>
  );
}
