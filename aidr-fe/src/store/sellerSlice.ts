import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as sellerProductApi from '../services/sellerProductApi';
import type { PagedResult } from '../types/catalog';
import type {
  CreateSellerProductPayload,
  SellerProductDetail,
  SellerProductListItem,
  SellerProductQuery,
  UpdateSellerProductPayload,
  UploadSellerProductImagesPayload,
} from '../types/seller';
import { getApiErrorMessage } from '../utils/apiError';

export type SellerState = {
  products: SellerProductListItem[];
  listQuery: SellerProductQuery;
  listPaging: { page: number; pageSize: number; totalCount: number; totalPages: number };
  listLoading: boolean;
  listError: string | null;
  listLoaded: boolean;
  selectedProduct: SellerProductDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  mutating: boolean;
};

type SellerRoot = { seller: SellerState };

const initialState: SellerState = {
  products: [],
  listQuery: { page: 1, pageSize: 20, status: '' },
  listPaging: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
  listLoading: false,
  listError: null,
  listLoaded: false,
  selectedProduct: null,
  detailLoading: false,
  detailError: null,
  mutating: false,
};

function unwrap<T>(result: { success: boolean; data?: T; message?: string }, fallback: string): T {
  if (!result.success || result.data === undefined) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

export const fetchSellerProducts = createAsyncThunk(
  'seller/fetchProducts',
  async (query: SellerProductQuery, { rejectWithValue }) => {
    try {
      const result = await sellerProductApi.listSellerProducts(query);
      return { page: unwrap(result, 'Unable to load products.'), query };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load products.'));
    }
  },
);

export const fetchSellerProduct = createAsyncThunk(
  'seller/fetchProduct',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await sellerProductApi.getSellerProduct(id);
      return unwrap(result, 'Product not found.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Product not found.'));
    }
  },
);

export const createSellerProduct = createAsyncThunk(
  'seller/createProduct',
  async (payload: CreateSellerProductPayload, { rejectWithValue }) => {
    try {
      const result = await sellerProductApi.createSellerProduct(payload);
      return unwrap(result, 'Unable to create product.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to create product.'));
    }
  },
);

export const updateSellerProduct = createAsyncThunk(
  'seller/updateProduct',
  async (
    { id, payload }: { id: string; payload: UpdateSellerProductPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await sellerProductApi.updateSellerProduct(id, payload);
      return unwrap(result, 'Unable to update product.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update product.'));
    }
  },
);

export const deleteSellerProduct = createAsyncThunk(
  'seller/deleteProduct',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await sellerProductApi.deleteSellerProduct(id);
      unwrap(result, 'Unable to delete product.');
      return id;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to delete product.'));
    }
  },
);

export const uploadSellerProductImages = createAsyncThunk(
  'seller/uploadProductImages',
  async (
    { id, payload }: { id: string; payload: UploadSellerProductImagesPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await sellerProductApi.uploadSellerProductImages(id, payload);
      return unwrap(result, 'Unable to save product images.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to save product images.'));
    }
  },
);

function applyPage(state: SellerState, page: PagedResult<SellerProductListItem>, query: SellerProductQuery) {
  state.products = page.items;
  state.listQuery = query;
  state.listPaging = {
    page: page.page,
    pageSize: page.pageSize,
    totalCount: page.totalCount,
    totalPages: page.totalPages,
  };
  state.listLoaded = true;
  state.listError = null;
}

export const sellerSlice = createSlice({
  name: 'seller',
  initialState,
  reducers: {
    clearSelectedSellerProduct(state) {
      state.selectedProduct = null;
      state.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSellerProducts.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchSellerProducts.fulfilled, (state, action) => {
        state.listLoading = false;
        applyPage(state, action.payload.page, action.payload.query);
      })
      .addCase(fetchSellerProducts.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = (action.payload as string) || 'Unable to load products.';
      })
      .addCase(fetchSellerProduct.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchSellerProduct.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.selectedProduct = action.payload;
      })
      .addCase(fetchSellerProduct.rejected, (state, action) => {
        state.detailLoading = false;
        state.selectedProduct = null;
        state.detailError = (action.payload as string) || 'Product not found.';
      })
      .addCase(createSellerProduct.pending, (state) => {
        state.mutating = true;
      })
      .addCase(createSellerProduct.fulfilled, (state, action) => {
        state.mutating = false;
        state.selectedProduct = action.payload;
        state.listLoaded = false;
      })
      .addCase(createSellerProduct.rejected, (state) => {
        state.mutating = false;
      })
      .addCase(updateSellerProduct.pending, (state) => {
        state.mutating = true;
      })
      .addCase(updateSellerProduct.fulfilled, (state, action) => {
        state.mutating = false;
        state.selectedProduct = action.payload;
        state.listLoaded = false;
      })
      .addCase(updateSellerProduct.rejected, (state) => {
        state.mutating = false;
      })
      .addCase(deleteSellerProduct.pending, (state) => {
        state.mutating = true;
      })
      .addCase(deleteSellerProduct.fulfilled, (state, action) => {
        state.mutating = false;
        state.products = state.products.filter((p) => p.productId !== action.payload);
        if (state.selectedProduct?.productId === action.payload) {
          state.selectedProduct = null;
        }
        state.listLoaded = false;
      })
      .addCase(deleteSellerProduct.rejected, (state) => {
        state.mutating = false;
      })
      .addCase(uploadSellerProductImages.pending, (state) => {
        state.mutating = true;
      })
      .addCase(uploadSellerProductImages.fulfilled, (state, action) => {
        state.mutating = false;
        state.selectedProduct = action.payload;
        state.listLoaded = false;
      })
      .addCase(uploadSellerProductImages.rejected, (state) => {
        state.mutating = false;
      });
  },
});

export const { clearSelectedSellerProduct } = sellerSlice.actions;

export const selectSellerProducts = (s: SellerRoot) => s.seller.products;
export const selectSellerListQuery = (s: SellerRoot) => s.seller.listQuery;
export const selectSellerListPaging = (s: SellerRoot) => s.seller.listPaging;
export const selectSellerListLoading = (s: SellerRoot) => s.seller.listLoading;
export const selectSellerListError = (s: SellerRoot) => s.seller.listError;
export const selectSellerListLoaded = (s: SellerRoot) => s.seller.listLoaded;
export const selectSellerSelectedProduct = (s: SellerRoot) => s.seller.selectedProduct;
export const selectSellerDetailLoading = (s: SellerRoot) => s.seller.detailLoading;
export const selectSellerDetailError = (s: SellerRoot) => s.seller.detailError;
export const selectSellerMutating = (s: SellerRoot) => s.seller.mutating;
