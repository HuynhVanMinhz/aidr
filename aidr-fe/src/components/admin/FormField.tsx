import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, htmlFor, error, children }: FormFieldProps) {
  // Only merge className when adding is-invalid. Passing className="" would override
  // child defaults (e.g. AdminDatePicker's form-control) and break Bootstrap styling.
  const control =
    isValidElement(children) && error
      ? cloneElement(children as ReactElement<{ className?: string }>, {
          className: [
            (children as ReactElement<{ className?: string }>).props.className,
            'is-invalid',
          ]
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
