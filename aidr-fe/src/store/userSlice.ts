import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as profileApi from '../services/profileApi';
import type { Profile, UpdateProfileRequest } from '../types/profile';
import { patchAuthUser } from './authSlice';
import type { RootState } from './index';

export type UserState = {
  profile: Profile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
};

const initialState: UserState = {
  profile: null,
  loading: false,
  saving: false,
  error: null,
};

export const fetchProfile = createAsyncThunk('user/fetchProfile', async (_, { rejectWithValue }) => {
  try {
    const result = await profileApi.getProfile();
    if (!result.success || !result.data) {
      return rejectWithValue(result.message || 'Không tải được hồ sơ.');
    }
    return result.data;
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Không tải được hồ sơ.');
  }
});

export const saveProfile = createAsyncThunk(
  'user/saveProfile',
  async (payload: UpdateProfileRequest, { rejectWithValue, dispatch }) => {
    try {
      const result = await profileApi.updateProfile(payload);
      if (!result.success || !result.data) {
        return rejectWithValue(result.message || 'Cập nhật hồ sơ thất bại.');
      }
      dispatch(patchAuthUser({ fullName: result.data.fullName }));
      return result.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Cập nhật hồ sơ thất bại.');
    }
  },
);

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearProfile(state) {
      state.profile = null;
      state.error = null;
      state.loading = false;
      state.saving = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Không tải được hồ sơ.';
      })
      .addCase(saveProfile.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveProfile.fulfilled, (state, action) => {
        state.saving = false;
        state.profile = action.payload;
      })
      .addCase(saveProfile.rejected, (state, action) => {
        state.saving = false;
        state.error = (action.payload as string) || 'Cập nhật hồ sơ thất bại.';
      });
  },
});

export const { clearProfile } = userSlice.actions;

export const selectProfile = (state: RootState) => state.user.profile;
export const selectProfileLoading = (state: RootState) => state.user.loading;
export const selectProfileSaving = (state: RootState) => state.user.saving;
export const selectProfileError = (state: RootState) => state.user.error;
