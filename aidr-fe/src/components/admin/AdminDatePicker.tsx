import { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';
import 'flatpickr/dist/flatpickr.min.css';

type AdminDatePickerProps = {
  id?: string;
  /** Date-only: `yyyy-MM-dd`. With enableTime: `yyyy-MM-ddTHH:mm` (local). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
  /** When true, Flatpickr shows hour/minute; value uses `yyyy-MM-ddTHH:mm`. */
  enableTime?: boolean;
};

/**
 * Theme Flatpickr date (optional time) picker.
 * Owns a single DOM input (not React-managed) so StrictMode / altInput cannot duplicate fields.
 * Parent uses `yyyy-MM-dd` or `yyyy-MM-ddTHH:mm`; UI shows `dd-mm-yyyy` (+ `HH:mm`).
 */
export function AdminDatePicker({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  minDate,
  maxDate,
  className = 'form-control',
  enableTime = false,
}: AdminDatePickerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<FlatpickrInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const valueFormat = enableTime ? 'Y-m-d\\TH:i' : 'Y-m-d';
  const displayFormat = enableTime ? 'd-m-Y H:i' : 'd-m-Y';
  const resolvedPlaceholder = placeholder ?? (enableTime ? 'dd-mm-yyyy HH:mm' : 'dd-mm-yyyy');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.replaceChildren();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = resolveInputClassName(className);
    input.placeholder = resolvedPlaceholder;
    input.readOnly = true;
    if (id) input.id = id;
    if (disabled) input.disabled = true;
    host.appendChild(input);

    const picker = flatpickr(input, {
      enableTime,
      time_24hr: true,
      dateFormat: displayFormat,
      allowInput: false,
      disableMobile: true,
      clickOpens: true,
      defaultDate: value || undefined,
      minDate: minDate || undefined,
      maxDate: maxDate || undefined,
      onChange: (dates) => {
        if (dates[0]) {
          onChangeRef.current(flatpickr.formatDate(dates[0], valueFormat));
        } else {
          onChangeRef.current('');
        }
      },
    });

    pickerRef.current = picker;

    return () => {
      picker.destroy();
      pickerRef.current = null;
      host.replaceChildren();
    };
    // Remount when time mode changes; other props synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableTime]);

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    if (!value) {
      picker.clear(false);
      return;
    }
    const current = picker.selectedDates[0]
      ? flatpickr.formatDate(picker.selectedDates[0], valueFormat)
      : '';
    if (current !== value) {
      picker.setDate(value, false);
    }
  }, [value, valueFormat]);

  useEffect(() => {
    pickerRef.current?.set('minDate', minDate || undefined);
  }, [minDate]);

  useEffect(() => {
    pickerRef.current?.set('maxDate', maxDate || undefined);
  }, [maxDate]);

  useEffect(() => {
    const input = pickerRef.current?.input;
    if (!input) return;
    input.disabled = disabled;
  }, [disabled]);

  useEffect(() => {
    const input = pickerRef.current?.input;
    if (!input) return;
    input.className = resolveInputClassName(className);
  }, [className]);

  useEffect(() => {
    const input = pickerRef.current?.input;
    if (!input) return;
    input.placeholder = resolvedPlaceholder;
  }, [resolvedPlaceholder]);

  return <div ref={hostRef} className="aidr-datepicker" />;
}

function resolveInputClassName(className: string) {
  const trimmed = className.trim();
  if (!trimmed) return 'form-control';
  return trimmed.split(/\s+/).includes('form-control') ? trimmed : `form-control ${trimmed}`;
}
