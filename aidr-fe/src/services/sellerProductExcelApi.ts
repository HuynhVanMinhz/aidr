import type { ApiResult } from '../types/catalog';
import type { SellerProductQuery } from '../types/seller';
import type {
  SellerProductImportPreview,
  SellerProductImportResult,
} from '../types/sellerProductExcel';
import { apiClient } from './apiClient';

/**
 * Downloads come back as blobs, which means an error body is a blob too — the
 * usual error reader would show "[object Blob]". Unwrap it back into the JSON
 * the API actually sent before anything else looks at it.
 */
async function readBlobError(error: unknown): Promise<never> {
  const response = (error as { response?: { data?: unknown } })?.response;
  const data = response?.data;

  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string };
      if (parsed.message) throw new Error(parsed.message);
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message) throw parseError;
    }
  }

  throw error;
}

/** Hands the file to the browser. Revoking on the next frame keeps Firefox happy. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function filenameFrom(headers: unknown, fallback: string): string {
  const disposition = (headers as Record<string, string> | undefined)?.['content-disposition'];
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1]) : fallback;
}

function toParams(query: SellerProductQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.status) params.status = query.status;
  if (query.q?.trim()) params.q = query.q.trim();
  if (query.categoryId != null) params.categoryId = query.categoryId;
  return params;
}

/** Downloads the shop's catalogue under the list's current filters — every page of it. */
export async function exportSellerProducts(query: SellerProductQuery = {}) {
  try {
    const response = await apiClient.get('/seller/products/export', {
      params: toParams(query),
      responseType: 'blob',
    });
    saveBlob(response.data as Blob, filenameFrom(response.headers, 'products.xlsx'));
  } catch (error) {
    await readBlobError(error);
  }
}

export async function downloadSellerProductTemplate() {
  try {
    const response = await apiClient.get('/seller/products/import-template', {
      responseType: 'blob',
    });
    saveBlob(response.data as Blob, filenameFrom(response.headers, 'product-import-template.xlsx'));
  } catch (error) {
    await readBlobError(error);
  }
}

export async function previewSellerProductImport(file: File) {
  const form = new FormData();
  form.append('file', file);

  const { data } = await apiClient.post<ApiResult<SellerProductImportPreview>>(
    '/seller/products/import/preview',
    form,
    // Let the browser set the multipart boundary; the client default is JSON.
    { headers: { 'Content-Type': undefined } },
  );
  return data;
}

export async function importSellerProducts(file: File) {
  const form = new FormData();
  form.append('file', file);

  const { data } = await apiClient.post<ApiResult<SellerProductImportResult>>(
    '/seller/products/import',
    form,
    { headers: { 'Content-Type': undefined } },
  );
  return data;
}
