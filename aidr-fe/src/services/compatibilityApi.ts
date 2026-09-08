import type {
  CompatibilityCheckRequest,
  CompatibilityResult,
  CompatibilityResultApiResult,
} from '../types/v2Features';
import { apiClient } from './apiClient';

export async function checkCompatibility(request: CompatibilityCheckRequest) {
  const { data } = await apiClient.post<CompatibilityResultApiResult>(
    '/ai/compatibility',
    request,
  );
  return data;
}

export function requireCompatibilityResult(
  result: CompatibilityResultApiResult,
): CompatibilityResult {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to check compatibility.');
  }
  return result.data;
}
