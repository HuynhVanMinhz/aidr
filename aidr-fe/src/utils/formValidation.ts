export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function tryValidateField(run: () => void): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : 'Giá trị không hợp lệ.';
  }
}

export function visibleFieldErrors<K extends string>(
  errors: FieldErrors<K>,
  touched: Partial<Record<K, boolean>>,
  submitted: boolean,
): FieldErrors<K> {
  const visible: FieldErrors<K> = {};
  (Object.keys(errors) as K[]).forEach((key) => {
    if (submitted || touched[key]) {
      visible[key] = errors[key];
    }
  });
  return visible;
}
