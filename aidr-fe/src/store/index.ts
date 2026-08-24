import { configureStore } from '@reduxjs/toolkit';
import { adminSlice } from './adminSlice';
import { appSlice } from './appSlice';
import { authSlice } from './authSlice';
import { cartSlice } from './cartSlice';
import { catalogSlice } from './catalogSlice';
import { themeSlice } from './themeSlice';
import { userSlice } from './userSlice';

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
    auth: authSlice.reducer,
    user: userSlice.reducer,
    catalog: catalogSlice.reducer,
    cart: cartSlice.reducer,
    theme: themeSlice.reducer,
    admin: adminSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
