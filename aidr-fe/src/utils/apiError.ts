import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; message?: string; title?: string } | undefined;
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
    if (data?.title && error.response?.status) {
      return `${data.title} (${error.response.status})`;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
