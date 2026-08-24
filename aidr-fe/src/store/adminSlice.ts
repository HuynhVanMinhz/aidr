import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as adminApi from '../services/adminApi';
import * as categoryApi from '../services/categoryApi';
import type {
  AdminCategory,
  AdminCategoryListQuery,
  AdminCategoryOption,
  AdminProductDetail,
  AdminProductListItem,
  AdminProductListQuery,
  AdminProductStatusFilter,
  AdminSellerRegistration,
  CreateCategoryPayload,
  ProductModerationHistoryResult,
  RejectProductPayload,
  RejectSellerRegistrationPayload,
  SellerRegistrationListQuery,
  SellerRegistrationStatusFilter,
  UpdateCategoryPayload,
} from '../types/admin';
import { getApiErrorMessage } from '../utils/apiError';

export type AdminCategorySummary = {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  withProductsCount: number;
};

export type AdminSellerRegistrationSummary = {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

export type AdminProductSummary = {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

export type AdminState = {
  categories: AdminCategory[];
  categoryOptions: AdminCategoryOption[];
  categoryPage: number;
  categoryPageSize: number;
  categoryTotalCount: number;
  categoryQuery: string;
  categorySummary: AdminCategorySummary;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  loaded: boolean;
  sellerRegistrations: AdminSellerRegistration[];
  sellerRegistrationsFilter: SellerRegistrationStatusFilter;
  sellerRegistrationsPage: number;
  sellerRegistrationsPageSize: number;
  sellerRegistrationsTotalCount: number;
  sellerRegistrationsQuery: string;
  sellerRegistrationsSummary: AdminSellerRegistrationSummary;
  sellerRegistrationsLoading: boolean;
  sellerRegistrationsMutating: boolean;
  sellerRegistrationsError: string | null;
  sellerRegistrationsLoaded: boolean;
  products: AdminProductListItem[];
  productsFilter: AdminProductStatusFilter;
  productsPage: number;
  productsPageSize: number;
  productsTotalCount: number;
  productsQuery: string;
  productsSummary: AdminProductSummary;
  productsLoading: boolean;
  productsMutating: boolean;
  productsError: string | null;
  productsLoaded: boolean;
  productDetails: AdminProductDetail[];
  moderationHistoryByProductId: Record<string, ProductModerationHistoryResult>;
};

type AdminRoot = { admin: AdminState };

const emptyCategorySummary: AdminCategorySummary = {
  totalCount: 0,
  activeCount: 0,
  inactiveCount: 0,
  withProductsCount: 0,
};

const emptySellerSummary: AdminSellerRegistrationSummary = {
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
};

const emptyProductSummary: AdminProductSummary = {
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
};

const initialState: AdminState = {
  categories: [],
  categoryOptions: [],
  categoryPage: 1,
  categoryPageSize: 10,
  categoryTotalCount: 0,
  categoryQuery: '',
  categorySummary: emptyCategorySummary,
  loading: false,
  mutating: false,
  error: null,
  loaded: false,
  sellerRegistrations: [],
  sellerRegistrationsFilter: 'Pending',
  sellerRegistrationsPage: 1,
  sellerRegistrationsPageSize: 10,
  sellerRegistrationsTotalCount: 0,
  sellerRegistrationsQuery: '',
  sellerRegistrationsSummary: emptySellerSummary,
  sellerRegistrationsLoading: false,
  sellerRegistrationsMutating: false,
  sellerRegistrationsError: null,
  sellerRegistrationsLoaded: false,
  products: [],
  productsFilter: 'Pending',
  productsPage: 1,
  productsPageSize: 10,
  productsTotalCount: 0,
  productsQuery: '',
  productsSummary: emptyProductSummary,
  productsLoading: false,
  productsMutating: false,
  productsError: null,
  productsLoaded: false,
  productDetails: [],
  moderationHistoryByProductId: {},
};

function unwrap<T>(result: { success: boolean; data?: T; message?: string }, fallback: string): T {
  if (!result.success || result.data === undefined) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

function toListItem(detail: AdminProductDetail): AdminProductListItem {
  return {
    productId: detail.productId,
    name: detail.name,
    slug: detail.slug,
    shortDescription: detail.shortDescription,
    brand: detail.brand,
    conditionType: detail.conditionType,
    basePrice: detail.basePrice,
    salePrice: detail.salePrice,
    effectivePrice: detail.effectivePrice,
    currency: detail.currency,
    stockQuantity: detail.stockQuantity,
    status: detail.status,
    primaryImageUrl: detail.images.find((i) => i.isPrimary)?.imageUrl ?? detail.images[0]?.imageUrl,
    categoryId: detail.categoryId,
    categoryName: detail.categoryName,
    shopId: detail.shopId,
    shopName: detail.shopName,
    publishedAt: detail.publishedAt,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

export const fetchAdminCategories = createAsyncThunk(
  'admin/fetchCategories',
  async (query: AdminCategoryListQuery | undefined, { rejectWithValue }) => {
    try {
      const result = await categoryApi.listAdminCategories(query ?? {});
      return unwrap(result, 'Unable to load categories.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load categories.'));
    }
  },
);

export const fetchAdminCategoryOptions = createAsyncThunk(
  'admin/fetchCategoryOptions',
  async (_, { rejectWithValue }) => {
    try {
      const result = await categoryApi.listAdminCategoryOptions();
      return unwrap(result, 'Unable to load category options.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load category options.'));
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
  async (query: SellerRegistrationListQuery | undefined, { rejectWithValue }) => {
    try {
      const params = query ?? {};
      const result = await adminApi.listSellerRegistrations(params);
      const data = unwrap(result, 'Unable to load seller registration requests.');
      return {
        ...data,
        status: (params.status ?? 'Pending') as SellerRegistrationStatusFilter,
        q: params.q ?? '',
      };
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

export const fetchAdminProducts = createAsyncThunk(
  'admin/fetchProducts',
  async (query: AdminProductListQuery | undefined, { rejectWithValue }) => {
    try {
      const params = query ?? {};
      const result = await adminApi.listAdminProducts(params);
      const data = unwrap(result, 'Unable to load products.');
      return {
        ...data,
        status: (params.status ?? 'Pending') as AdminProductStatusFilter,
        q: params.q ?? '',
      };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load products.'));
    }
  },
);

export const fetchAdminProduct = createAsyncThunk(
  'admin/fetchProduct',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await adminApi.getAdminProduct(id);
      return unwrap(result, 'Product not found.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Product not found.'));
    }
  },
);

export const approveAdminProduct = createAsyncThunk(
  'admin/approveProduct',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await adminApi.approveAdminProduct(id);
      return unwrap(result, 'Unable to approve product.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to approve product.'));
    }
  },
);

export const rejectAdminProduct = createAsyncThunk(
  'admin/rejectProduct',
  async ({ id, payload }: { id: string; payload: RejectProductPayload }, { rejectWithValue }) => {
    try {
      const result = await adminApi.rejectAdminProduct(id, payload);
      return unwrap(result, 'Unable to reject product.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to reject product.'));
    }
  },
);

export const fetchProductModerationHistory = createAsyncThunk(
  'admin/fetchProductModerationHistory',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await adminApi.getProductModerationHistory(id);
      return unwrap(result, 'Unable to load moderation history.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load moderation history.'));
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

function applySellerRegistrationUpdate(state: AdminState, item: AdminSellerRegistration): void {
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

function upsertProductDetail(
  list: AdminProductDetail[],
  item: AdminProductDetail,
): AdminProductDetail[] {
  const index = list.findIndex((p) => p.productId === item.productId);
  if (index < 0) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

function upsertProductListItem(
  list: AdminProductListItem[],
  item: AdminProductListItem,
): AdminProductListItem[] {
  const index = list.findIndex((p) => p.productId === item.productId);
  if (index < 0) return [item, ...list];
  const next = [...list];
  next[index] = item;
  return next;
}

function applyProductUpdate(state: AdminState, detail: AdminProductDetail): void {
  state.productDetails = upsertProductDetail(state.productDetails, detail);
  const listItem = toListItem(detail);
  const filter = state.productsFilter;
  const matchesFilter = filter === 'all' || detail.status === filter;
  if (!matchesFilter) {
    state.products = state.products.filter((p) => p.productId !== detail.productId);
    return;
  }
  state.products = upsertProductListItem(state.products, listItem);
}

export const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError(state) {
      state.error = null;
      state.sellerRegistrationsError = null;
      state.productsError = null;
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
        state.categories = action.payload.items;
        state.categoryPage = action.payload.page;
        state.categoryPageSize = action.payload.pageSize;
        state.categoryTotalCount = action.payload.totalCount;
        state.categoryQuery = action.meta.arg?.q ?? '';
        state.categorySummary = {
          totalCount: action.payload.activeCount + action.payload.inactiveCount,
          activeCount: action.payload.activeCount,
          inactiveCount: action.payload.inactiveCount,
          withProductsCount: action.payload.withProductsCount,
        };
        state.loaded = true;
      })
      .addCase(fetchAdminCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Unable to load categories.';
      })
      .addCase(fetchAdminCategoryOptions.fulfilled, (state, action) => {
        state.categoryOptions = action.payload;
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
        state.sellerRegistrationsPage = action.payload.page;
        state.sellerRegistrationsPageSize = action.payload.pageSize;
        state.sellerRegistrationsTotalCount = action.payload.totalCount;
        state.sellerRegistrationsQuery = action.payload.q;
        state.sellerRegistrationsSummary = {
          pendingCount: action.payload.pendingCount,
          approvedCount: action.payload.approvedCount,
          rejectedCount: action.payload.rejectedCount,
        };
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
      })
      .addCase(fetchAdminProducts.pending, (state) => {
        state.productsLoading = true;
        state.productsError = null;
      })
      .addCase(fetchAdminProducts.fulfilled, (state, action) => {
        state.productsLoading = false;
        state.products = action.payload.items;
        state.productsFilter = action.payload.status;
        state.productsPage = action.payload.page;
        state.productsPageSize = action.payload.pageSize;
        state.productsTotalCount = action.payload.totalCount;
        state.productsQuery = action.payload.q;
        state.productsSummary = {
          pendingCount: action.payload.pendingCount,
          approvedCount: action.payload.approvedCount,
          rejectedCount: action.payload.rejectedCount,
        };
        state.productsLoaded = true;
      })
      .addCase(fetchAdminProducts.rejected, (state, action) => {
        state.productsLoading = false;
        state.productsLoaded = true;
        state.productsError = (action.payload as string) || 'Unable to load products.';
      })
      .addCase(fetchAdminProduct.fulfilled, (state, action) => {
        applyProductUpdate(state, action.payload);
      })
      .addCase(approveAdminProduct.pending, (state) => {
        state.productsMutating = true;
        state.productsError = null;
      })
      .addCase(approveAdminProduct.fulfilled, (state, action) => {
        state.productsMutating = false;
        applyProductUpdate(state, action.payload);
        if (state.productsSummary.pendingCount > 0) state.productsSummary.pendingCount -= 1;
        state.productsSummary.approvedCount += 1;
        delete state.moderationHistoryByProductId[action.payload.productId];
      })
      .addCase(approveAdminProduct.rejected, (state, action) => {
        state.productsMutating = false;
        state.productsError = (action.payload as string) || 'Unable to approve product.';
      })
      .addCase(rejectAdminProduct.pending, (state) => {
        state.productsMutating = true;
        state.productsError = null;
      })
      .addCase(rejectAdminProduct.fulfilled, (state, action) => {
        state.productsMutating = false;
        applyProductUpdate(state, action.payload);
        if (state.productsSummary.pendingCount > 0) state.productsSummary.pendingCount -= 1;
        state.productsSummary.rejectedCount += 1;
        delete state.moderationHistoryByProductId[action.payload.productId];
      })
      .addCase(rejectAdminProduct.rejected, (state, action) => {
        state.productsMutating = false;
        state.productsError = (action.payload as string) || 'Unable to reject product.';
      })
      .addCase(fetchProductModerationHistory.fulfilled, (state, action) => {
        state.moderationHistoryByProductId[action.payload.productId] = action.payload;
      });
  },
});

export const { clearAdminError } = adminSlice.actions;

export const selectAdminCategories = (state: AdminRoot) => state.admin.categories;
export const selectAdminCategoryOptions = (state: AdminRoot) => state.admin.categoryOptions;
export const selectAdminCategoryPage = (state: AdminRoot) => state.admin.categoryPage;
export const selectAdminCategoryPageSize = (state: AdminRoot) => state.admin.categoryPageSize;
export const selectAdminCategoryTotalCount = (state: AdminRoot) => state.admin.categoryTotalCount;
export const selectAdminCategorySummary = (state: AdminRoot) => state.admin.categorySummary;
export const selectAdminCategoriesLoading = (state: AdminRoot) => state.admin.loading;
export const selectAdminMutating = (state: AdminRoot) => state.admin.mutating;
export const selectAdminError = (state: AdminRoot) => state.admin.error;
export const selectAdminCategoriesLoaded = (state: AdminRoot) => state.admin.loaded;
export const selectAdminCategoryById = (id: number) => (state: AdminRoot) =>
  state.admin.categories.find((c) => c.categoryId === id);

export const selectSellerRegistrations = (state: AdminRoot) => state.admin.sellerRegistrations;
export const selectSellerRegistrationsFilter = (state: AdminRoot) =>
  state.admin.sellerRegistrationsFilter;
export const selectSellerRegistrationsPage = (state: AdminRoot) => state.admin.sellerRegistrationsPage;
export const selectSellerRegistrationsPageSize = (state: AdminRoot) =>
  state.admin.sellerRegistrationsPageSize;
export const selectSellerRegistrationsTotalCount = (state: AdminRoot) =>
  state.admin.sellerRegistrationsTotalCount;
export const selectSellerRegistrationsSummary = (state: AdminRoot) =>
  state.admin.sellerRegistrationsSummary;
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

export const selectAdminProducts = (state: AdminRoot) => state.admin.products;
export const selectAdminProductsFilter = (state: AdminRoot) => state.admin.productsFilter;
export const selectAdminProductsPage = (state: AdminRoot) => state.admin.productsPage;
export const selectAdminProductsPageSize = (state: AdminRoot) => state.admin.productsPageSize;
export const selectAdminProductsTotalCount = (state: AdminRoot) => state.admin.productsTotalCount;
export const selectAdminProductsSummary = (state: AdminRoot) => state.admin.productsSummary;
export const selectAdminProductsLoading = (state: AdminRoot) => state.admin.productsLoading;
export const selectAdminProductsMutating = (state: AdminRoot) => state.admin.productsMutating;
export const selectAdminProductsError = (state: AdminRoot) => state.admin.productsError;
export const selectAdminProductsLoaded = (state: AdminRoot) => state.admin.productsLoaded;
export const selectAdminProductDetailById = (id: string) => (state: AdminRoot) =>
  state.admin.productDetails.find((p) => p.productId === id);
export const selectProductModerationHistory = (id: string) => (state: AdminRoot) =>
  state.admin.moderationHistoryByProductId[id];
