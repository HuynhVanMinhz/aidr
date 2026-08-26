import { configureStore } from '@reduxjs/toolkit';
import { adminSlice } from './adminSlice';
import { adminGovernanceSlice } from './adminGovernanceSlice';
import { adminReturnsSlice } from './adminReturnsSlice';
import { appSlice } from './appSlice';
import { authSlice } from './authSlice';
import { cartSlice } from './cartSlice';
import { checkoutSlice } from './checkoutSlice';
import { catalogSlice } from './catalogSlice';
import { ordersSlice } from './ordersSlice';
import { returnsSlice } from './returnsSlice';
import { sellerOrdersSlice } from './sellerOrdersSlice';
import { sellerSlice } from './sellerSlice';
import { shopSlice } from './shopSlice';
import { themeSlice } from './themeSlice';
import { userSlice } from './userSlice';
import { voucherSlice } from './voucherSlice';
import { adminVoucherSlice } from './adminVoucherSlice';
import { sellerFinanceSlice } from './sellerFinanceSlice';
import { sellerVoucherSlice } from './sellerVoucherSlice';
import { wishlistSlice } from './wishlistSlice';
import { reviewSlice } from './reviewSlice';
import { followSlice } from './followSlice';
import { notificationSlice } from './notificationSlice';
import { chatSlice } from './chatSlice';
import { recommendationSlice } from './recommendationSlice';
import { aiSlice } from './aiSlice';

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
    auth: authSlice.reducer,
    user: userSlice.reducer,
    catalog: catalogSlice.reducer,
    recommendation: recommendationSlice.reducer,
    ai: aiSlice.reducer,
    shop: shopSlice.reducer,
    cart: cartSlice.reducer,
    wishlist: wishlistSlice.reducer,
    notifications: notificationSlice.reducer,
    chat: chatSlice.reducer,
    follow: followSlice.reducer,
    review: reviewSlice.reducer,
    voucher: voucherSlice.reducer,
    adminVoucher: adminVoucherSlice.reducer,
    sellerFinance: sellerFinanceSlice.reducer,
    sellerVoucher: sellerVoucherSlice.reducer,
    checkout: checkoutSlice.reducer,
    orders: ordersSlice.reducer,
    returns: returnsSlice.reducer,
    sellerOrders: sellerOrdersSlice.reducer,
    theme: themeSlice.reducer,
    admin: adminSlice.reducer,
    adminGovernance: adminGovernanceSlice.reducer,
    adminReturns: adminReturnsSlice.reducer,
    seller: sellerSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
