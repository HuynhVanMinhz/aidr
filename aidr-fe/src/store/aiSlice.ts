import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as aiApi from '../services/aiApi';
import type { CompareProductsResult, CompareSelectionItem, NlFilterResult } from '../types/ai';
import { getApiErrorMessage } from '../utils/apiError';

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 5;
const COMPARE_STORAGE_KEY = 'aidr.compare.selection';

export type AiState = {
  nlLoading: boolean;
  nlError: string | null;
  lastNlResult: NlFilterResult | null;
  selection: CompareSelectionItem[];
  compareLoading: boolean;
  compareError: string | null;
  compareResult: CompareProductsResult | null;
};

type AiRoot = { ai: AiState };

function loadSelection(): CompareSelectionItem[] {
  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompareSelectionItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.productId === 'string' && typeof x.name === 'string')
      .slice(0, COMPARE_MAX);
  } catch {
    return [];
  }
}

function persistSelection(selection: CompareSelectionItem[]) {
  try {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // ignore quota / private mode
  }
}

function requireData<T>(
  result: { success: boolean; data?: T | null; message?: string | null },
  fallback: string,
): T {
  if (!result.success || result.data == null) {
    throw new Error(result.message || fallback);
  }
  return result.data;
}

const initialState: AiState = {
  nlLoading: false,
  nlError: null,
  lastNlResult: null,
  selection: typeof window !== 'undefined' ? loadSelection() : [],
  compareLoading: false,
  compareError: null,
  compareResult: null,
};

export const parseNlFilter = createAsyncThunk(
  'ai/parseNlFilter',
  async (query: string, { rejectWithValue }) => {
    try {
      const result = await aiApi.parseNlFilter({ query });
      return requireData(result, 'Unable to convert your search into filters.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to convert your search into filters.'));
    }
  },
);

export const runCompare = createAsyncThunk(
  'ai/runCompare',
  async (productIds: string[], { rejectWithValue }) => {
    try {
      const result = await aiApi.compareProducts({ productIds });
      return requireData(result, 'Unable to compare products.');
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to compare products.'));
    }
  },
);

export const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    clearNlFilterState(state) {
      state.nlError = null;
      state.lastNlResult = null;
    },
    toggleCompareSelection(state, action: PayloadAction<CompareSelectionItem>) {
      const item = action.payload;
      const idx = state.selection.findIndex((x) => x.productId === item.productId);
      if (idx >= 0) {
        state.selection.splice(idx, 1);
        persistSelection(state.selection);
        return;
      }
      if (state.selection.length >= COMPARE_MAX) {
        return;
      }
      state.selection.push(item);
      persistSelection(state.selection);
    },
    removeCompareSelection(state, action: PayloadAction<string>) {
      state.selection = state.selection.filter((x) => x.productId !== action.payload);
      persistSelection(state.selection);
    },
    clearCompareSelection(state) {
      state.selection = [];
      persistSelection(state.selection);
      state.compareResult = null;
      state.compareError = null;
    },
    clearCompareResult(state) {
      state.compareResult = null;
      state.compareError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(parseNlFilter.pending, (state) => {
        state.nlLoading = true;
        state.nlError = null;
      })
      .addCase(parseNlFilter.fulfilled, (state, action) => {
        state.nlLoading = false;
        state.lastNlResult = action.payload;
        state.nlError = null;
      })
      .addCase(parseNlFilter.rejected, (state, action) => {
        state.nlLoading = false;
        state.nlError =
          (action.payload as string) || action.error.message || 'Unable to convert your search into filters.';
      })
      .addCase(runCompare.pending, (state) => {
        state.compareLoading = true;
        state.compareError = null;
      })
      .addCase(runCompare.fulfilled, (state, action) => {
        state.compareLoading = false;
        state.compareResult = action.payload;
        state.compareError = null;
      })
      .addCase(runCompare.rejected, (state, action) => {
        state.compareLoading = false;
        state.compareError =
          (action.payload as string) || action.error.message || 'Unable to compare products.';
      });
  },
});

export const {
  clearNlFilterState,
  toggleCompareSelection,
  removeCompareSelection,
  clearCompareSelection,
  clearCompareResult,
} = aiSlice.actions;

export const selectNlLoading = (state: AiRoot) => state.ai.nlLoading;
export const selectNlError = (state: AiRoot) => state.ai.nlError;
export const selectLastNlResult = (state: AiRoot) => state.ai.lastNlResult;

export const selectCompareSelection = (state: AiRoot) => state.ai.selection;
export const selectIsInCompare = (productId: string) => (state: AiRoot) =>
  state.ai.selection.some((x) => x.productId === productId);
export const selectCompareLoading = (state: AiRoot) => state.ai.compareLoading;
export const selectCompareError = (state: AiRoot) => state.ai.compareError;
export const selectCompareResult = (state: AiRoot) => state.ai.compareResult;
