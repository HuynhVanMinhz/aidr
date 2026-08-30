import { useEffect, useRef } from 'react';
import { useToast } from './useToast';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

/**
 * Surface a message held in state (load error, action result, …) as a toast
 * instead of an inline banner.
 *
 * Fires once per distinct message and re-fires if the same text reappears
 * after being cleared, so repeated failures of the same action still notify.
 * Call it unconditionally, before any early return.
 */
export function useToastMessage(
  message: string | null | undefined,
  kind: ToastKind = 'error',
) {
  const toast = useToast();
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    const text = message && message.trim() ? message : null;
    if (text === lastRef.current) return;
    lastRef.current = text;
    if (text) toast[kind](text);
  }, [message, kind, toast]);
}
