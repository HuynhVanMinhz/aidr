import axios from 'axios';
import type { ApiResult } from '../types/auth';
import type { KycVerification, KycVerifyPayload } from '../types/kyc';
import { apiClient } from './apiClient';

export async function getMyKyc(): Promise<KycVerification | null> {
  try {
    const { data } = await apiClient.get<ApiResult<KycVerification | null>>('/kyc/me');
    return data.data ?? null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function verifyKyc(payload: KycVerifyPayload) {
  const { data } = await apiClient.post<ApiResult<KycVerification>>('/kyc/verify', payload);
  return data;
}
