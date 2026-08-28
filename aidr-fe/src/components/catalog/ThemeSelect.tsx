import type { SelectHTMLAttributes } from 'react';

type ThemeSelectOption = {
  value: string;
  label: string;
};

type ThemeSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  options: ThemeSelectOption[];
  wrapperClassName?: string;
};

/** Storefront select styled like theme `products.html` sorting dropdown. */
export function ThemeSelect({
  options,
  className,
  wrapperClassName,
  id,
  ...rest
}: ThemeSelectProps) {
  return (
    <div className={`theme-select${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
      <select
        id={id}
        className={`form-control form-select${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
