import type { ApiResult } from '../types/auth';
import type {
  CreateSellerRegistrationPayload,
  BuyerSellerRegistration,
  BuyerSellerRegistrationApiResult,
} from '../types/sellerRegistration';
import { apiClient } from './apiClient';
import axios from 'axios';

export async function getMySellerRegistration(): Promise<BuyerSellerRegistration | null> {
  try {
    const { data } = await apiClient.get<BuyerSellerRegistrationApiResult>('/seller-registrations/me');
    if (!data.success || !data.data) return null;
    return data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function createSellerRegistration(payload: CreateSellerRegistrationPayload) {
  const { data } = await apiClient.post<BuyerSellerRegistrationApiResult>(
    '/seller-registrations',
    payload,
  );
  return data;
}

export async function updateSellerRegistration(payload: CreateSellerRegistrationPayload) {
  const { data } = await apiClient.put<BuyerSellerRegistrationApiResult>(
    '/seller-registrations/me',
    payload,
  );
  return data;
}

export type { ApiResult, BuyerSellerRegistration };
