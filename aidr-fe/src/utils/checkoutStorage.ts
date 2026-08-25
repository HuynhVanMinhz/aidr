import type { CheckoutSuccessState } from '../types/order';

const STORAGE_KEY = 'aidr.checkout.success';

export function saveCheckoutSuccess(state: CheckoutSuccessState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function loadCheckoutSuccess(): CheckoutSuccessState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutSuccessState;
    if (!parsed?.orders?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutSuccessStorage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
