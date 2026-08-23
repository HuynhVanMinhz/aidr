const SESSION_KEY = 'aidr_catalog_session_id';

export function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.length <= 64) return existing;

    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;

    sessionStorage.setItem(SESSION_KEY, id.slice(0, 64));
    return id.slice(0, 64);
  } catch {
    return `anon-${Date.now().toString(36)}`;
  }
}
