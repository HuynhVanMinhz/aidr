import { createSlice } from '@reduxjs/toolkit';

export const catalogSlice = createSlice({
  name: 'catalog',
  initialState: {
    products: [] as unknown[],
    categories: [] as unknown[],
  },
  reducers: {},
});
