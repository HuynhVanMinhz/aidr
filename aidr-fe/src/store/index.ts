import { configureStore } from '@reduxjs/toolkit';
import { adminSlice } from './adminSlice';
import { appSlice } from './appSlice';
import { authSlice } from './authSlice';
import { cartSlice } from './cartSlice';
import { checkoutSlice } from './checkoutSlice';
import { catalogSlice } from './catalogSlice';
import { ordersSlice } from './ordersSlice';
import { sellerOrdersSlice } from './sellerOrdersSlice';
import { sellerSlice } from './sellerSlice';
import { shopSlice } from './shopSlice';
import { themeSlice } from './themeSlice';
import { userSlice } from './userSlice';

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
    auth: authSlice.reducer,
    user: userSlice.reducer,
    catalog: catalogSlice.reducer,
    shop: shopSlice.reducer,
    cart: cartSlice.reducer,
    checkout: checkoutSlice.reducer,
    orders: ordersSlice.reducer,
    sellerOrders: sellerOrdersSlice.reducer,
    theme: themeSlice.reducer,
    admin: adminSlice.reducer,
    seller: sellerSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
