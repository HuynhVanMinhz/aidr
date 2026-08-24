import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as sellerInventoryApi from '../services/sellerInventoryApi';
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
import type {
  AdjustSellerInventoryPayload,
  ImportStockLotPayload,
  SellerInventoryDetail,
  SellerInventoryListItem,
  SellerInventoryQuery,
  SellerInventorySummary,
  UpdateSellerInventoryPayload,
  UpdateSellingPricePayload,
} from '../types/sellerInventory';
import { getApiErrorMessage } from '../utils/apiError';

const emptyInventorySummary: SellerInventorySummary = {
  productCount: 0,
  lowStockCount: 0,
  totalUnits: 0,
  reservedUnits: 0,
};

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
  inventoryItems: SellerInventoryListItem[];
  inventoryQuery: SellerInventoryQuery;
  inventoryPaging: { page: number; pageSize: number; totalCount: number; totalPages: number };
  inventorySummary: SellerInventorySummary;
  inventoryListLoading: boolean;
  inventoryListError: string | null;
  selectedInventory: SellerInventoryDetail | null;
  inventoryDetailLoading: boolean;
  inventoryDetailError: string | null;
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
  inventoryItems: [],
  inventoryQuery: { page: 1, pageSize: 20 },
  inventoryPaging: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
  inventorySummary: emptyInventorySummary,
  inventoryListLoading: false,
  inventoryListError: null,
  selectedInventory: null,
  inventoryDetailLoading: false,
  inventoryDetailError: null,
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

export const fetchSellerInventory = createAsyncThunk(
  'seller/fetchInventory',
  async (query: SellerInventoryQuery, { rejectWithValue }) => {
    try {
      const result = await sellerInventoryApi.listSellerInventory(query);
      return { page: unwrap(result, 'Unable to load inventory.'), query };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load inventory.'));
    }
  },
);

export const fetchSellerInventoryDetail = createAsyncThunk(
  'seller/fetchInventoryDetail',
  async (productId: string, { rejectWithValue }) => {
    try {
      const result = await sellerInventoryApi.getSellerInventory(productId);
      return unwrap(result, 'Inventory not found.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Inventory not found.'));
    }
  },
);

export const updateSellerInventorySettings = createAsyncThunk(
  'seller/updateInventorySettings',
  async (
    { productId, payload }: { productId: string; payload: UpdateSellerInventoryPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await sellerInventoryApi.updateSellerInventorySettings(productId, payload);
      return unwrap(result, 'Unable to update inventory settings.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update inventory settings.'));
    }
  },
);

export const adjustSellerInventory = createAsyncThunk(
  'seller/adjustInventory',
  async (
    { productId, payload }: { productId: string; payload: AdjustSellerInventoryPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await sellerInventoryApi.adjustSellerInventory(productId, payload);
      return unwrap(result, 'Unable to adjust inventory.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to adjust inventory.'));
    }
  },
);

export const importSellerStockLot = createAsyncThunk(
  'seller/importStockLot',
  async (
    { productId, payload }: { productId: string; payload: ImportStockLotPayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await sellerInventoryApi.importSellerStockLot(productId, payload);
      return unwrap(result, 'Unable to import stock lot.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to import stock lot.'));
    }
  },
);

export const updateSellerSellingPrice = createAsyncThunk(
  'seller/updateSellingPrice',
  async (
    { productId, payload }: { productId: string; payload: UpdateSellingPricePayload },
    { rejectWithValue },
  ) => {
    try {
      const result = await sellerInventoryApi.updateSellerSellingPrice(productId, payload);
      unwrap(result, 'Unable to update selling price.');
      const inventory = await sellerInventoryApi.getSellerInventory(productId);
      return unwrap(inventory, 'Unable to reload inventory.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to update selling price.'));
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
    clearSelectedSellerInventory(state) {
      state.selectedInventory = null;
      state.inventoryDetailError = null;
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
      })
      .addCase(fetchSellerInventory.pending, (state) => {
        state.inventoryListLoading = true;
        state.inventoryListError = null;
      })
      .addCase(fetchSellerInventory.fulfilled, (state, action) => {
        state.inventoryListLoading = false;
        state.inventoryItems = action.payload.page.items;
        state.inventoryQuery = action.payload.query;
        state.inventoryPaging = {
          page: action.payload.page.page,
          pageSize: action.payload.page.pageSize,
          totalCount: action.payload.page.totalCount,
          totalPages: action.payload.page.totalPages,
        };
        state.inventorySummary = action.payload.page.summary;
      })
      .addCase(fetchSellerInventory.rejected, (state, action) => {
        state.inventoryListLoading = false;
        state.inventoryListError = (action.payload as string) || 'Unable to load inventory.';
      })
      .addCase(fetchSellerInventoryDetail.pending, (state) => {
        state.inventoryDetailLoading = true;
        state.inventoryDetailError = null;
      })
      .addCase(fetchSellerInventoryDetail.fulfilled, (state, action) => {
        state.inventoryDetailLoading = false;
        state.selectedInventory = action.payload;
      })
      .addCase(fetchSellerInventoryDetail.rejected, (state, action) => {
        state.inventoryDetailLoading = false;
        state.selectedInventory = null;
        state.inventoryDetailError = (action.payload as string) || 'Inventory not found.';
      })
      .addCase(updateSellerInventorySettings.pending, (state) => {
        state.mutating = true;
      })
      .addCase(updateSellerInventorySettings.fulfilled, (state, action) => {
        state.mutating = false;
        applyInventoryMutation(state, action.payload);
      })
      .addCase(updateSellerInventorySettings.rejected, (state) => {
        state.mutating = false;
      })
      .addCase(adjustSellerInventory.pending, (state) => {
        state.mutating = true;
      })
      .addCase(adjustSellerInventory.fulfilled, (state, action) => {
        state.mutating = false;
        applyInventoryMutation(state, action.payload);
      })
      .addCase(adjustSellerInventory.rejected, (state) => {
        state.mutating = false;
      })
      .addCase(importSellerStockLot.pending, (state) => {
        state.mutating = true;
      })
      .addCase(importSellerStockLot.fulfilled, (state, action) => {
        state.mutating = false;
        applyInventoryMutation(state, action.payload);
      })
      .addCase(importSellerStockLot.rejected, (state) => {
        state.mutating = false;
      })
      .addCase(updateSellerSellingPrice.pending, (state) => {
        state.mutating = true;
      })
      .addCase(updateSellerSellingPrice.fulfilled, (state, action) => {
        state.mutating = false;
        applyInventoryMutation(state, action.payload);
      })
      .addCase(updateSellerSellingPrice.rejected, (state) => {
        state.mutating = false;
      });
  },
});

function applyInventoryMutation(state: SellerState, detail: SellerInventoryDetail) {
  state.selectedInventory = detail;
  state.listLoaded = false;
  const idx = state.inventoryItems.findIndex((item) => item.productId === detail.productId);
  if (idx >= 0) {
    state.inventoryItems[idx] = {
      ...state.inventoryItems[idx],
      stockQuantity: detail.stockQuantity,
      reservedQuantity: detail.reservedQuantity,
      availableQuantity: detail.availableQuantity,
      lowStockThreshold: detail.lowStockThreshold,
      isLowStock: detail.isLowStock,
      lastCostPrice: detail.lastCostPrice,
      avgCostPrice: detail.avgCostPrice,
      basePrice: detail.basePrice,
      salePrice: detail.salePrice,
      status: detail.status,
    };
  }
  if (state.selectedProduct?.productId === detail.productId) {
    state.selectedProduct = {
      ...state.selectedProduct,
      stockQuantity: detail.stockQuantity,
      reservedQuantity: detail.reservedQuantity,
      basePrice: detail.basePrice,
      salePrice: detail.salePrice,
      effectivePrice: detail.salePrice ?? detail.basePrice,
    };
  }
}

export const { clearSelectedSellerProduct, clearSelectedSellerInventory } = sellerSlice.actions;

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
export const selectSellerInventoryItems = (s: SellerRoot) => s.seller.inventoryItems;
export const selectSellerInventoryPaging = (s: SellerRoot) => s.seller.inventoryPaging;
export const selectSellerInventorySummary = (s: SellerRoot) => s.seller.inventorySummary;
export const selectSellerInventoryListLoading = (s: SellerRoot) => s.seller.inventoryListLoading;
export const selectSellerInventoryListError = (s: SellerRoot) => s.seller.inventoryListError;
export const selectSellerSelectedInventory = (s: SellerRoot) => s.seller.selectedInventory;
export const selectSellerInventoryDetailLoading = (s: SellerRoot) => s.seller.inventoryDetailLoading;
export const selectSellerInventoryDetailError = (s: SellerRoot) => s.seller.inventoryDetailError;
