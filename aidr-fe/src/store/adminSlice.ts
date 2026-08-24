import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as adminApi from '../services/adminApi';
import * as categoryApi from '../services/categoryApi';
import type {
  AdminCategory,
  AdminSellerRegistration,
  CreateCategoryPayload,
  RejectSellerRegistrationPayload,
  SellerRegistrationStatusFilter,
  UpdateCategoryPayload,
} from '../types/admin';
import { getApiErrorMessage } from '../utils/apiError';

export type AdminState = {
  categories: AdminCategory[];
  loading: boolean;
  mutating: boolean;
  error: string | null;
  loaded: boolean;
  sellerRegistrations: AdminSellerRegistration[];
  sellerRegistrationsFilter: SellerRegistrationStatusFilter;
  sellerRegistrationsLoading: boolean;
  sellerRegistrationsMutating: boolean;
  sellerRegistrationsError: string | null;
  sellerRegistrationsLoaded: boolean;
};

type AdminRoot = { admin: AdminState };

const initialState: AdminState = {
  categories: [],
  loading: false,
  mutating: false,
  error: null,
  loaded: false,
  sellerRegistrations: [],
  sellerRegistrationsFilter: 'Pending',
  sellerRegistrationsLoading: false,
  sellerRegistrationsMutating: false,
  sellerRegistrationsError: null,
  sellerRegistrationsLoaded: false,
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
      return unwrap(result, 'Unable to load categories.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load categories.'));
    }
  },
);

export const fetchAdminCategory = createAsyncThunk(
  'admin/fetchCategory',
  async (id: number, { rejectWithValue }) => {
    try {
      const result = await categoryApi.getAdminCategory(id);
      return unwrap(result, 'Category not found.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Category not found.'));
    }
  },
);

export const createAdminCategory = createAsyncThunk(
  'admin/createCategory',
  async (payload: CreateCategoryPayload, { rejectWithValue }) => {
    try {
      const result = await categoryApi.createAdminCategory(payload);
      return unwrap(result, 'Unable to create category.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to create category.'));
    }
  },
);

export const updateAdminCategory = createAsyncThunk(
  'admin/updateCategory',
  async ({ id, payload }: { id: number; payload: UpdateCategoryPayload }, { rejectWithValue }) => {
    try {
      const result = await categoryApi.updateAdminCategory(id, payload);
      return unwrap(result, 'Unable to update category.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update category.'));
    }
  },
);

export const updateAdminCategoryStatus = createAsyncThunk(
  'admin/updateCategoryStatus',
  async ({ id, isActive }: { id: number; isActive: boolean }, { rejectWithValue }) => {
    try {
      const result = await categoryApi.updateAdminCategoryStatus(id, isActive);
      return unwrap(result, 'Unable to update category status.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update category status.'));
    }
  },
);

export const deleteAdminCategory = createAsyncThunk(
  'admin/deleteCategory',
  async (id: number, { rejectWithValue }) => {
    try {
      const result = await categoryApi.deleteAdminCategory(id);
      if (!result.success) throw new Error(result.message || 'Unable to delete category.');
      return id;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to delete category.'));
    }
  },
);

export const fetchSellerRegistrations = createAsyncThunk(
  'admin/fetchSellerRegistrations',
  async (status: SellerRegistrationStatusFilter, { rejectWithValue }) => {
    try {
      const result = await adminApi.listSellerRegistrations(status);
      return { items: unwrap(result, 'Unable to load seller registration requests.'), status };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load seller registration requests.'));
    }
  },
);

export const fetchSellerRegistration = createAsyncThunk(
  'admin/fetchSellerRegistration',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await adminApi.getSellerRegistration(id);
      return unwrap(result, 'Seller registration request not found.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Seller registration request not found.'));
    }
  },
);

export const approveSellerRegistration = createAsyncThunk(
  'admin/approveSellerRegistration',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await adminApi.approveSellerRegistration(id);
      return unwrap(result, 'Unable to approve seller registration.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to approve seller registration.'));
    }
  },
);

export const rejectSellerRegistration = createAsyncThunk(
  'admin/rejectSellerRegistration',
  async (
    { id, payload }: { id: string; payload: RejectSellerRegistrationPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await adminApi.rejectSellerRegistration(id, payload);
      return unwrap(result, 'Unable to reject seller registration.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to reject seller registration.'));
    }
  },
);

function upsertCategory(list: AdminCategory[], item: AdminCategory): AdminCategory[] {
  const index = list.findIndex((c) => c.categoryId === item.categoryId);
  if (index < 0) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

function upsertSellerRegistration(
  list: AdminSellerRegistration[],
  item: AdminSellerRegistration,
): AdminSellerRegistration[] {
  const index = list.findIndex((r) => r.requestId === item.requestId);
  if (index < 0) return [item, ...list];
  const next = [...list];
  next[index] = item;
  return next;
}

function applySellerRegistrationUpdate(
  state: AdminState,
  item: AdminSellerRegistration,
): void {
  const filter = state.sellerRegistrationsFilter;
  const matchesFilter = filter === 'all' || item.status === filter;
  if (!matchesFilter) {
    state.sellerRegistrations = state.sellerRegistrations.filter(
      (r) => r.requestId !== item.requestId,
    );
    return;
  }
  state.sellerRegistrations = upsertSellerRegistration(state.sellerRegistrations, item);
}

export const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError(state) {
      state.error = null;
      state.sellerRegistrationsError = null;
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
        state.error = (action.payload as string) || 'Unable to load categories.';
      })
      .addCase(fetchAdminCategory.fulfilled, (state, action) => {
        state.categories = upsertCategory(state.categories, action.payload);
      })
      .addCase(createAdminCategory.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createAdminCategory.fulfilled, (state, action) => {
        state.mutating = false;
        state.categories = upsertCategory(state.categories, action.payload);
      })
      .addCase(createAdminCategory.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to create category.';
      })
      .addCase(updateAdminCategory.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateAdminCategory.fulfilled, (state, action) => {
        state.mutating = false;
        state.categories = upsertCategory(state.categories, action.payload);
      })
      .addCase(updateAdminCategory.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || 'Unable to update category.';
      })
      .addCase(updateAdminCategoryStatus.fulfilled, (state, action) => {
        state.categories = upsertCategory(state.categories, action.payload);
      })
      .addCase(updateAdminCategoryStatus.rejected, (state, action) => {
        state.error = (action.payload as string) || 'Unable to update category status.';
      })
      .addCase(deleteAdminCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter((c) => c.categoryId !== action.payload);
      })
      .addCase(deleteAdminCategory.rejected, (state, action) => {
        state.error = (action.payload as string) || 'Unable to delete category.';
      })
      .addCase(fetchSellerRegistrations.pending, (state) => {
        state.sellerRegistrationsLoading = true;
        state.sellerRegistrationsError = null;
      })
      .addCase(fetchSellerRegistrations.fulfilled, (state, action) => {
        state.sellerRegistrationsLoading = false;
        state.sellerRegistrations = action.payload.items;
        state.sellerRegistrationsFilter = action.payload.status;
        state.sellerRegistrationsLoaded = true;
      })
      .addCase(fetchSellerRegistrations.rejected, (state, action) => {
        state.sellerRegistrationsLoading = false;
        state.sellerRegistrationsLoaded = true;
        state.sellerRegistrationsError =
          (action.payload as string) || 'Unable to load seller registration requests.';
      })
      .addCase(fetchSellerRegistration.fulfilled, (state, action) => {
        applySellerRegistrationUpdate(state, action.payload);
      })
      .addCase(approveSellerRegistration.pending, (state) => {
        state.sellerRegistrationsMutating = true;
        state.sellerRegistrationsError = null;
      })
      .addCase(approveSellerRegistration.fulfilled, (state, action) => {
        state.sellerRegistrationsMutating = false;
        applySellerRegistrationUpdate(state, action.payload.request);
      })
      .addCase(approveSellerRegistration.rejected, (state, action) => {
        state.sellerRegistrationsMutating = false;
        state.sellerRegistrationsError =
          (action.payload as string) || 'Unable to approve seller registration.';
      })
      .addCase(rejectSellerRegistration.pending, (state) => {
        state.sellerRegistrationsMutating = true;
        state.sellerRegistrationsError = null;
      })
      .addCase(rejectSellerRegistration.fulfilled, (state, action) => {
        state.sellerRegistrationsMutating = false;
        applySellerRegistrationUpdate(state, action.payload);
      })
      .addCase(rejectSellerRegistration.rejected, (state, action) => {
        state.sellerRegistrationsMutating = false;
        state.sellerRegistrationsError =
          (action.payload as string) || 'Unable to reject seller registration.';
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

export const selectSellerRegistrations = (state: AdminRoot) => state.admin.sellerRegistrations;
export const selectSellerRegistrationsFilter = (state: AdminRoot) =>
  state.admin.sellerRegistrationsFilter;
export const selectSellerRegistrationsLoading = (state: AdminRoot) =>
  state.admin.sellerRegistrationsLoading;
export const selectSellerRegistrationsMutating = (state: AdminRoot) =>
  state.admin.sellerRegistrationsMutating;
export const selectSellerRegistrationsError = (state: AdminRoot) =>
  state.admin.sellerRegistrationsError;
export const selectSellerRegistrationsLoaded = (state: AdminRoot) =>
  state.admin.sellerRegistrationsLoaded;
export const selectSellerRegistrationById = (id: string) => (state: AdminRoot) =>
  state.admin.sellerRegistrations.find((r) => r.requestId === id);
