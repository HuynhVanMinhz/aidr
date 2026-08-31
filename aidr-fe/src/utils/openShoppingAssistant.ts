export const ASSISTANT_OPEN_EVENT = 'aidr:assistant-open';
const OPEN_STORAGE_KEY = 'aidr.assistant.open';

/** Opens the floating shopping assistant from CTAs on support pages. */
export function openShoppingAssistant(): void {
  try {
    sessionStorage.setItem(OPEN_STORAGE_KEY, '1');
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT));
}
