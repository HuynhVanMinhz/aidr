import type {
  ApiResult,
  AuthTokenPayload,
  ForgotPasswordRequest,
  GoogleAuthUrlPayload,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from '../types/auth';
import { apiClient } from './apiClient';

export async function register(payload: RegisterRequest) {
  const { data } = await apiClient.post<ApiResult<AuthTokenPayload>>('/auth/register', payload);
  return data;
}

export async function login(payload: LoginRequest) {
  const { data } = await apiClient.post<ApiResult<AuthTokenPayload>>('/auth/login', payload);
  return data;
}

export async function logout(refreshToken?: string | null) {
  const { data } = await apiClient.post<ApiResult<null>>('/auth/logout', {
    refreshToken: refreshToken ?? undefined,
  });
  return data;
}

export async function forgotPassword(payload: ForgotPasswordRequest) {
  const { data } = await apiClient.post<ApiResult<null>>('/auth/forgot-password', payload);
  return data;
}

export async function resetPassword(payload: ResetPasswordRequest) {
  const { data } = await apiClient.post<ApiResult<null>>('/auth/reset-password', payload);
  return data;
}

export async function getGoogleAuthUrl(redirectUri: string) {
  const { data } = await apiClient.get<ApiResult<GoogleAuthUrlPayload>>('/auth/google', {
    params: { redirectUri },
  });
  return data;
}

export async function completeGoogleLogin(code: string, redirectUri: string) {
  const { data } = await apiClient.post<ApiResult<AuthTokenPayload>>('/auth/google/callback', {
    code,
    redirectUri,
  });
  return data;
}
