import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, htmlFor, error, children }: FormFieldProps) {
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ className?: string }>, {
        className: [((children as ReactElement<{ className?: string }>).props.className ?? ''), error ? 'is-invalid' : '']
          .filter(Boolean)
          .join(' '),
      })
    : children;

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={htmlFor}>
        {label}
      </label>
      {control}
      {error ? <p className="form-field-error invalid-feedback d-block">{error}</p> : null}
    </div>
  );
}
