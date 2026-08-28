import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as categoryApi from '../services/categoryApi';
import * as productApi from '../services/productApi';
import type {
  CategoryTreeNode,
  PagedResult,
  ProductDetail,
  ProductListItem,
  ProductQuery,
  ProductSort,
} from '../types/catalog';

export type CatalogFilters = {
  q: string;
  categoryIds: number[];
  brands: string[];
  minPrice: string;
  maxPrice: string;
  minRating: number | null;
  onSale: boolean | null;
  inStock: boolean | null;
  conditions: string[];
  specFilters: Record<string, string>;
  sort: ProductSort;
  page: number;
  pageSize: number;
};

export type CatalogState = {
  filters: CatalogFilters;
  products: ProductListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  queryKey: string | null;
  listLoading: boolean;
  listError: string | null;
  categories: CategoryTreeNode[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  categoriesLoaded: boolean;
  selectedProduct: ProductDetail | null;
  detailLoading: boolean;
  detailError: string | null;
};

/** Avoid importing RootState from store/index (circular init with apiClient). */
type CatalogRoot = { catalog: CatalogState };

export const defaultCatalogFilters: CatalogFilters = {
  q: '',
  categoryIds: [],
  brands: [],
  minPrice: '',
  maxPrice: '',
  minRating: null,
  onSale: null,
  inStock: null,
  conditions: [],
  specFilters: {},
  sort: 'newest',
  page: 1,
  pageSize: 12,
};

const initialState: CatalogState = {
  filters: { ...defaultCatalogFilters },
  products: [],
  page: 1,
  pageSize: 12,
  totalCount: 0,
  totalPages: 0,
  queryKey: null,
  listLoading: false,
  listError: null,
  categories: [],
  categoriesLoading: false,
  categoriesError: null,
  categoriesLoaded: false,
  selectedProduct: null,
  detailLoading: false,
  detailError: null,
};

function buildQueryKey(filters: CatalogFilters): string {
  return JSON.stringify({
    q: filters.q.trim(),
    categoryIds: filters.categoryIds,
    brands: filters.brands,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    onSale: filters.onSale,
    inStock: filters.inStock,
    conditions: filters.conditions,
    specFilters: filters.specFilters,
    sort: filters.sort,
    page: filters.page,
    pageSize: filters.pageSize,
  });
}

export function filtersToQuery(filters: CatalogFilters): ProductQuery {
  const query: ProductQuery = {
    sort: filters.sort,
    page: filters.page,
    pageSize: filters.pageSize,
  };

  if (filters.q.trim()) query.q = filters.q.trim();
  if (filters.categoryIds.length > 0) {
    query.categoryIds = filters.categoryIds;
    if (filters.categoryIds.length === 1) query.categoryId = filters.categoryIds[0];
  }
  if (filters.brands.length > 0) {
    query.brands = filters.brands;
    if (filters.brands.length === 1) query.brand = filters.brands[0];
  }

  const minPrice = Number(filters.minPrice);
  if (filters.minPrice.trim() && Number.isFinite(minPrice) && minPrice >= 0) {
    query.minPrice = minPrice;
  }

  const maxPrice = Number(filters.maxPrice);
  if (filters.maxPrice.trim() && Number.isFinite(maxPrice) && maxPrice >= 0) {
    query.maxPrice = maxPrice;
  }

  if (filters.minRating != null) query.minRating = filters.minRating;
  if (filters.onSale === true) query.onSale = true;
  if (filters.inStock === true) query.inStock = true;
  if (filters.conditions.length > 0) query.conditions = filters.conditions;
  if (Object.keys(filters.specFilters).length > 0) query.specFilters = filters.specFilters;

  return query;
}

export const fetchProducts = createAsyncThunk(
  'catalog/fetchProducts',
  async (filters: CatalogFilters, { rejectWithValue }) => {
    try {
      const query = filtersToQuery(filters);
      const useSearch = Boolean(query.q?.trim());
      const result = useSearch
        ? await productApi.searchProducts(query)
        : await productApi.listProducts(query);

      if (!result.success || !result.data) {
        return rejectWithValue(result.message || 'Unable to load products.');
      }

      return {
        data: result.data,
        queryKey: buildQueryKey(filters),
        filters,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Unable to load products.',
      );
    }
  },
);

export const fetchCategories = createAsyncThunk(
  'catalog/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const result = await categoryApi.getCategoryTree();
      if (!result.success || !result.data) {
        return rejectWithValue(result.message || 'Unable to load categories.');
      }
      return result.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unable to load categories.');
    }
  },
);

export const fetchProductDetail = createAsyncThunk(
  'catalog/fetchProductDetail',
  async (productId: string, { rejectWithValue }) => {
    try {
      const result = await productApi.getProduct(productId);
      if (!result.success || !result.data) {
        return rejectWithValue(result.message || 'Product not found.');
      }
      return result.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Product not found.');
    }
  },
);

export const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<CatalogFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    replaceFilters(state, action: PayloadAction<CatalogFilters>) {
      state.filters = action.payload;
    },
    clearSelectedProduct(state) {
      state.selectedProduct = null;
      state.detailError = null;
      state.detailLoading = false;
    },
    invalidateCategories(state) {
      state.categoriesLoaded = false;
      state.categories = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        const page: PagedResult<ProductListItem> = action.payload.data;
        state.listLoading = false;
        state.products = page.items;
        state.page = page.page;
        state.pageSize = page.pageSize;
        state.totalCount = page.totalCount;
        state.totalPages = page.totalPages;
        state.queryKey = action.payload.queryKey;
        state.filters = action.payload.filters;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = (action.payload as string) || 'Unable to load products.';
      })
      .addCase(fetchCategories.pending, (state) => {
        state.categoriesLoading = true;
        state.categoriesError = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categoriesLoading = false;
        state.categories = action.payload;
        state.categoriesLoaded = true;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.categoriesLoading = false;
        state.categoriesError = (action.payload as string) || 'Unable to load categories.';
      })
      .addCase(fetchProductDetail.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchProductDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.selectedProduct = action.payload;
      })
      .addCase(fetchProductDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.selectedProduct = null;
        state.detailError = (action.payload as string) || 'Product not found.';
      });
  },
});

export const { setFilters, replaceFilters, clearSelectedProduct, invalidateCategories } = catalogSlice.actions;

export const selectCatalogFilters = (state: CatalogRoot) => state.catalog.filters;
export const selectCatalogProducts = (state: CatalogRoot) => state.catalog.products;
export const selectCatalogListLoading = (state: CatalogRoot) => state.catalog.listLoading;
export const selectCatalogListError = (state: CatalogRoot) => state.catalog.listError;
export const selectCatalogPaging = (state: CatalogRoot) => ({
  page: state.catalog.page,
  pageSize: state.catalog.pageSize,
  totalCount: state.catalog.totalCount,
  totalPages: state.catalog.totalPages,
});
export const selectCategories = (state: CatalogRoot) => state.catalog.categories;
export const selectCategoriesLoading = (state: CatalogRoot) => state.catalog.categoriesLoading;
export const selectCategoriesError = (state: CatalogRoot) => state.catalog.categoriesError;
export const selectCategoriesLoaded = (state: CatalogRoot) => state.catalog.categoriesLoaded;
export const selectSelectedProduct = (state: CatalogRoot) => state.catalog.selectedProduct;
export const selectDetailLoading = (state: CatalogRoot) => state.catalog.detailLoading;
export const selectDetailError = (state: CatalogRoot) => state.catalog.detailError;
