import { configureStore } from '@reduxjs/toolkit';
import { appSlice } from './appSlice';
import { authSlice } from './authSlice';
import { cartSlice } from './cartSlice';
import { catalogSlice } from './catalogSlice';
import { themeSlice } from './themeSlice';

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
    auth: authSlice.reducer,
    catalog: catalogSlice.reducer,
    cart: cartSlice.reducer,
    theme: themeSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
