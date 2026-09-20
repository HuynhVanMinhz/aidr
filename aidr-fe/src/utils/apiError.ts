import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  // RTK `unwrap()` rethrows `rejectWithValue` payloads as plain strings.
  if (typeof error === 'string' && error.trim()) return error.trim();

  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; message?: string; title?: string } | undefined;
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
    if (data?.title && error.response?.status) {
      return `${data.title} (${error.response.status})`;
    }
  }

  if (error && typeof error === 'object') {
    const record = error as { detail?: unknown; message?: unknown; payload?: unknown };
    if (typeof record.detail === 'string' && record.detail.trim()) return record.detail.trim();
    if (typeof record.payload === 'string' && record.payload.trim()) return record.payload.trim();
    if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
