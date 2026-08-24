import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as categoryApi from '../services/categoryApi';
import type { AdminCategory, CreateCategoryPayload, UpdateCategoryPayload } from '../types/admin';
import { getApiErrorMessage } from '../utils/apiError';

export type AdminState = {
  categories: AdminCategory[];
  loading: boolean;
  mutating: boolean;
  error: string | null;
  loaded: boolean;
};

type AdminRoot = { admin: AdminState };

const initialState: AdminState = {
  categories: [],
  loading: false,
  mutating: false,
  error: null,
  loaded: false,
};

function unwrap<T>(result: { success: boolean; data?: T; message?: string }, fallback: string): T {
  if (!result.success || result.data === undefined) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

export const fetchAdminCategories = createAsyncThunk(
  'admin/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const result = await categoryApi.listAdminCategories();
      return unwrap(result, 'Không tải được danh mục.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Không tải được danh mục.'));
    }
  },
);

export const fetchAdminCategory = createAsyncThunk(
  'admin/fetchCategory',
  async (id: number, { rejectWithValue }) => {
    try {
      const result = await categoryApi.getAdminCategory(id);
      return unwrap(result, 'Không tìm thấy danh mục.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Không tìm thấy danh mục.'));
    }
  },
);

export const createAdminCategory = createAsyncThunk(
  'admin/createCategory',
  async (payload: CreateCategoryPayload, { rejectWithValue }) => {
    try {
      const result = await categoryApi.createAdminCategory(payload);
      return unwrap(result, 'Không tạo được danh mục.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Không tạo được danh mục.'));
    }
  },
);

export const updateAdminCategory = createAsyncThunk(
  'admin/updateCategory',
  async ({ id, payload }: { id: number; payload: UpdateCategoryPayload }, { rejectWithValue }) => {
    try {
      const result = await categoryApi.updateAdminCategory(id, payload);
      return unwrap(result, 'Không cập nhật được danh mục.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Không cập nhật được danh mục.'));
    }
  },
);

export const updateAdminCategoryStatus = createAsyncThunk(
  'admin/updateCategoryStatus',
  async ({ id, isActive }: { id: number; isActive: boolean }, { rejectWithValue }) => {
    try {
      const result = await categoryApi.updateAdminCategoryStatus(id, isActive);
      return unwrap(result, 'Không đổi trạng thái danh mục.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Không đổi trạng thái danh mục.'));
    }
  },
);

export const deleteAdminCategory = createAsyncThunk(
  'admin/deleteCategory',
  async (id: number, { rejectWithValue }) => {
    try {
      const result = await categoryApi.deleteAdminCategory(id);
      if (!result.success) throw new Error(result.message || 'Không xóa được danh mục.');
      return id;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Không xóa được danh mục.'));
    }
  },
);

function upsert(list: AdminCategory[], item: AdminCategory): AdminCategory[] {
  const index = list.findIndex((c) => c.categoryId === item.categoryId);
  if (index < 0) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

export const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
        state.loaded = true;
      })
      .addCase(fetchAdminCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Không tải được danh mục.';
      })
      .addCase(fetchAdminCategory.fulfilled, (state, action) => {
        state.categories = upsert(state.categories, action.payload);
      })
      .addCase(createAdminCategory.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createAdminCategory.fulfilled, (state, action) => {
        state.mutating = false;
        state.categories = upsert(state.categories, action.payload);
      })
      .addCase(createAdminCategory.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Không tạo được danh mục.';
      })
      .addCase(updateAdminCategory.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateAdminCategory.fulfilled, (state, action) => {
        state.mutating = false;
        state.categories = upsert(state.categories, action.payload);
      })
      .addCase(updateAdminCategory.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Không cập nhật được danh mục.';
      })
      .addCase(updateAdminCategoryStatus.fulfilled, (state, action) => {
        state.categories = upsert(state.categories, action.payload);
      })
      .addCase(updateAdminCategoryStatus.rejected, (state, action) => {
        state.error = (action.payload as string) || 'Không đổi trạng thái danh mục.';
      })
      .addCase(deleteAdminCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter((c) => c.categoryId !== action.payload);
      })
      .addCase(deleteAdminCategory.rejected, (state, action) => {
        state.error = (action.payload as string) || 'Không xóa được danh mục.';
      });
  },
});

export const { clearAdminError } = adminSlice.actions;

export const selectAdminCategories = (state: AdminRoot) => state.admin.categories;
export const selectAdminCategoriesLoading = (state: AdminRoot) => state.admin.loading;
export const selectAdminMutating = (state: AdminRoot) => state.admin.mutating;
export const selectAdminError = (state: AdminRoot) => state.admin.error;
export const selectAdminCategoriesLoaded = (state: AdminRoot) => state.admin.loaded;
export const selectAdminCategoryById = (id: number) => (state: AdminRoot) =>
  state.admin.categories.find((c) => c.categoryId === id);
