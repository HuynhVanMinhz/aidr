import type { ApiResult } from '../types/auth';
import type { Profile, UpdateProfileRequest } from '../types/profile';
import { apiClient } from './apiClient';

export async function getProfile() {
  const { data } = await apiClient.get<ApiResult<Profile>>('/profile');
  return data;
}

export async function updateProfile(payload: UpdateProfileRequest) {
  const { data } = await apiClient.put<ApiResult<Profile>>('/profile', payload);
  return data;
}
