import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './guards/AuthGuards';
import { AppShell } from './AppShell';
import { AccountLayout } from '../components/account/AccountLayout';
import { AdminShell } from '../components/layout/AdminShell';
import { useAidrShellTheme } from '../hooks/useAidrShellTheme';
import { HomePage } from '../views/HomePage';
import { HealthPage } from '../views/HealthPage';
import { LoginPage } from '../views/auth/LoginPage';
import { RegisterPage } from '../views/auth/RegisterPage';
import { ForgotPasswordPage } from '../views/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../views/auth/ResetPasswordPage';
import { GoogleCallbackPage } from '../views/auth/GoogleCallbackPage';
import { ProfilePage } from '../views/account/ProfilePage';
import { AddressesPage } from '../views/account/AddressesPage';
import { ChangePasswordPage } from '../views/account/ChangePasswordPage';
import { OrdersPage } from '../views/account/OrdersPage';
import { OrderDetailPage } from '../views/account/OrderDetailPage';
import { WishlistPage } from '../views/account/WishlistPage';
import { FollowingPage } from '../views/account/FollowingPage';
import { NotificationsPage } from '../views/account/NotificationsPage';
import { ProductListPage } from '../views/catalog/ProductListPage';
import { ProductDetailPage } from '../views/catalog/ProductDetailPage';
import { CategoriesPage } from '../views/catalog/CategoriesPage';
import { ShopPublicPage } from '../views/catalog/ShopPublicPage';
import { AdminHomePage } from '../views/admin/AdminHomePage';
import { AdminCategoryListPage } from '../views/admin/AdminCategoryListPage';
import { AdminCategoryFormPage } from '../views/admin/AdminCategoryFormPage';
import { AdminSellerRegistrationListPage } from '../views/admin/AdminSellerRegistrationListPage';
import { AdminSellerRegistrationDetailPage } from '../views/admin/AdminSellerRegistrationDetailPage';
import { AdminProductListPage } from '../views/admin/AdminProductListPage';
import { AdminProductDetailPage } from '../views/admin/AdminProductDetailPage';
import { AdminSystemVoucherListPage } from '../views/admin/AdminSystemVoucherListPage';
import { AdminSystemVoucherFormPage } from '../views/admin/AdminSystemVoucherFormPage';
import { AdminReturnRequestListPage } from '../views/admin/AdminReturnRequestListPage';
import { AdminReturnRequestDetailPage } from '../views/admin/AdminReturnRequestDetailPage';
import { SellerHomePage } from '../views/seller/SellerHomePage';
import { SellerProductListPage } from '../views/seller/SellerProductListPage';
import { SellerProductFormPage } from '../views/seller/SellerProductFormPage';
import { SellerInventoryDetailPage } from '../views/seller/SellerInventoryDetailPage';
import { SellerInventoryListPage } from '../views/seller/SellerInventoryListPage';
import { SellerOrderDetailPage } from '../views/seller/SellerOrderDetailPage';
import { SellerOrderListPage } from '../views/seller/SellerOrderListPage';
import { SellerProductDetailPage } from '../views/seller/SellerProductDetailPage';
import { SellerShopVoucherListPage } from '../views/seller/SellerShopVoucherListPage';
import { SellerShopVoucherFormPage } from '../views/seller/SellerShopVoucherFormPage';
import { SellerNotificationsPage } from '../views/seller/SellerNotificationsPage';
import { SellerChatPage } from '../views/seller/SellerChatPage';
import { ChatPage } from '../views/chat/ChatPage';
import { CartPage } from '../views/cart/CartPage';
import { CheckoutPage } from '../views/checkout/CheckoutPage';
import { OrderReceivedPage } from '../views/checkout/OrderReceivedPage';
import { ToastHost } from '../components/feedback/ToastHost';

function AppThemeBridge() {
  useAidrShellTheme();
  return null;
}

function OrdersRedirect() {
  const { orderId } = useParams<{ orderId: string }>();
  return <Navigate to={orderId ? `/account/orders/${orderId}` : '/account/orders'} replace />;
}

export function App() {
  return (
    <>
      <AppThemeBridge />
      <ToastHost />
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<GoogleCallbackPage />} />

        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminShell variant="admin" />}>
            <Route index element={<AdminHomePage />} />
            <Route path="categories" element={<AdminCategoryListPage />} />
            <Route path="categories/new" element={<AdminCategoryFormPage />} />
            <Route path="categories/:id/edit" element={<AdminCategoryFormPage />} />
            <Route path="seller-registrations" element={<AdminSellerRegistrationListPage />} />
            <Route path="seller-registrations/:id" element={<AdminSellerRegistrationDetailPage />} />
            <Route path="products" element={<AdminProductListPage />} />
            <Route path="products/:id" element={<AdminProductDetailPage />} />
            <Route path="return-requests" element={<AdminReturnRequestListPage />} />
            <Route path="return-requests/:id" element={<AdminReturnRequestDetailPage />} />
            <Route path="vouchers" element={<AdminSystemVoucherListPage />} />
            <Route path="vouchers/new" element={<AdminSystemVoucherFormPage />} />
            <Route path="vouchers/:id/edit" element={<AdminSystemVoucherFormPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['SELLER']} />}>
          <Route path="/seller" element={<AdminShell variant="seller" />}>
            <Route index element={<SellerHomePage />} />
            <Route path="products" element={<SellerProductListPage />} />
            <Route path="products/new" element={<SellerProductFormPage />} />
            <Route path="products/:id/inventory" element={<SellerInventoryDetailPage />} />
            <Route path="products/:id" element={<SellerProductDetailPage />} />
            <Route path="products/:id/edit" element={<SellerProductFormPage />} />
            <Route path="inventory" element={<SellerInventoryListPage />} />
            <Route path="orders" element={<SellerOrderListPage />} />
            <Route path="orders/:orderId" element={<SellerOrderDetailPage />} />
            <Route path="notifications" element={<SellerNotificationsPage />} />
            <Route path="chat" element={<SellerChatPage />} />
            <Route path="vouchers" element={<SellerShopVoucherListPage />} />
            <Route path="vouchers/new" element={<SellerShopVoucherFormPage />} />
            <Route path="vouchers/:id/edit" element={<SellerShopVoucherFormPage />} />
          </Route>
        </Route>

        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="shops/:shopKey" element={<ShopPublicPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="health" element={<HealthPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="chat" element={<ChatPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="checkout/success" element={<OrderReceivedPage />} />
            <Route path="order-received" element={<OrderReceivedPage />} />
            <Route path="account" element={<AccountLayout />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:orderId" element={<OrderDetailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="following" element={<FollowingPage />} />
              <Route path="addresses" element={<AddressesPage />} />
              <Route path="change-password" element={<ChangePasswordPage />} />
            </Route>
            <Route path="wishlist" element={<Navigate to="/account/wishlist" replace />} />
            <Route path="following" element={<Navigate to="/account/following" replace />} />
            <Route path="notifications" element={<Navigate to="/account/notifications" replace />} />
            <Route path="orders" element={<Navigate to="/account/orders" replace />} />
            <Route path="orders/:orderId" element={<OrdersRedirect />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
