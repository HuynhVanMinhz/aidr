import { useCallback, useEffect } from 'react';
import * as authApi from '../services/authApi';
import {
  fetchProfile,
  saveProfile,
  selectProfile,
  selectProfileError,
  selectProfileLoading,
  selectProfileSaving,
} from '../store/userSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { ChangePasswordRequest, UpdateProfileRequest } from '../types/profile';
import { getApiErrorMessage } from '../utils/apiError';

export function useProfile(options?: { autoFetch?: boolean }) {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);
  const loading = useAppSelector(selectProfileLoading);
  const saving = useAppSelector(selectProfileSaving);
  const error = useAppSelector(selectProfileError);
  const autoFetch = options?.autoFetch ?? true;

  useEffect(() => {
    if (autoFetch && !profile && !loading) {
      void dispatch(fetchProfile());
    }
  }, [autoFetch, dispatch, loading, profile]);

  const reload = useCallback(() => dispatch(fetchProfile()), [dispatch]);

  const updateProfile = useCallback(
    (payload: UpdateProfileRequest) => dispatch(saveProfile(payload)).unwrap(),
    [dispatch],
  );

  const changePassword = useCallback(async (payload: ChangePasswordRequest) => {
    const result = await authApi.changePassword(payload);
    if (!result.success) {
      throw new Error(result.message || 'Đổi mật khẩu thất bại.');
    }
    return result;
  }, []);

  return {
    profile,
    loading,
    saving,
    error,
    reload,
    updateProfile,
    changePassword,
    getErrorMessage: getApiErrorMessage,
  };
}
