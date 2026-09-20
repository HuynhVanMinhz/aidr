import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './guards/AuthGuards';
import { AppShell } from './AppShell';
import { AccountLayout } from '../components/account/AccountLayout';
import { AdminShell } from '../components/layout/AdminShell';
import { useAidrShellTheme } from '../hooks/useAidrShellTheme';
import { HomePage } from '../views/HomePage';
import { HealthPage } from '../views/HealthPage';
import { HelpPage } from '../views/HelpPage';
import { FaqPage } from '../views/FaqPage';
import { AboutPage } from '../views/AboutPage';
import { TermsPage } from '../views/TermsPage';
import { NotFoundPage } from '../views/NotFoundPage';
import { ForbiddenPage } from '../views/ForbiddenPage';
import { ConsoleNotFoundPage } from '../views/ConsoleNotFoundPage';
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
import { FollowingFeedPage } from '../views/account/FollowingFeedPage';
import { NotificationsPage } from '../views/account/NotificationsPage';
import { BecomeSellerPage } from '../views/account/BecomeSellerPage';
import { BuyerReturnsPage } from '../views/account/BuyerReturnsPage';
import { BuyerReturnDetailPage } from '../views/account/BuyerReturnDetailPage';
import { BuyerVouchersPage } from '../views/account/BuyerVouchersPage';
import { AccountSecurityPage } from '../views/account/AccountSecurityPage';
import { ProductListPage } from '../views/catalog/ProductListPage';
import { ProductDetailPage } from '../views/catalog/ProductDetailPage';
import { ComparePage } from '../views/catalog/ComparePage';
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
import { AdminSystemVoucherDetailPage } from '../views/admin/AdminSystemVoucherDetailPage';
import { AdminReturnRequestListPage } from '../views/admin/AdminReturnRequestListPage';
import { AdminReturnRequestDetailPage } from '../views/admin/AdminReturnRequestDetailPage';
import { AdminAccountListPage } from '../views/admin/AdminAccountListPage';
import { AdminAccountDetailPage } from '../views/admin/AdminAccountDetailPage';
import { AdminCustomerInsightsPage } from '../views/admin/AdminCustomerInsightsPage';
import { AdminOrderListPage } from '../views/admin/AdminOrderListPage';
import { AdminOrderDetailPage } from '../views/admin/AdminOrderDetailPage';
import { AdminSettlementsPage } from '../views/admin/AdminSettlementsPage';
import { AdminNotificationsPage } from '../views/admin/AdminNotificationsPage';
import { SellerHomePage } from '../views/seller/SellerHomePage';
import { SellerProductListPage } from '../views/seller/SellerProductListPage';
import { SellerProductFormPage } from '../views/seller/SellerProductFormPage';
import { SellerInventoryDetailPage } from '../views/seller/SellerInventoryDetailPage';
import { SellerInventoryListPage } from '../views/seller/SellerInventoryListPage';
import { SellerStockImportHistoryPage } from '../views/seller/SellerStockImportHistoryPage';
import { SellerOrderDetailPage } from '../views/seller/SellerOrderDetailPage';
import { SellerOrderListPage } from '../views/seller/SellerOrderListPage';
import { SellerProductDetailPage } from '../views/seller/SellerProductDetailPage';
import { SellerReturnDetailPage } from '../views/seller/SellerReturnDetailPage';
import { SellerReturnListPage } from '../views/seller/SellerReturnListPage';
import { SellerShopVoucherListPage } from '../views/seller/SellerShopVoucherListPage';
import { SellerShopVoucherFormPage } from '../views/seller/SellerShopVoucherFormPage';
import { SellerNotificationsPage } from '../views/seller/SellerNotificationsPage';
import { SellerReportsPage } from '../views/seller/SellerReportsPage';
import { SellerWalletPage } from '../views/seller/SellerWalletPage';
import { SellerSettlementsPage } from '../views/seller/SellerSettlementsPage';
import { SellerChatPage } from '../views/seller/SellerChatPage';
import { SellerShopSettingsPage } from '../views/seller/SellerShopSettingsPage';
import { SellerAlertsPage } from '../views/seller/SellerAlertsPage';
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

        {/* Admin: guest → login; wrong role → 403; unknown path → console 404 */}
        <Route element={<ProtectedRoute roles={['ADMIN']} unauthorizedTo="/403" />}>
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
            <Route path="orders" element={<AdminOrderListPage />} />
            <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
            <Route path="settlements" element={<AdminSettlementsPage />} />
            <Route path="vouchers" element={<AdminSystemVoucherListPage />} />
            <Route path="vouchers/new" element={<AdminSystemVoucherFormPage />} />
            <Route path="vouchers/:id/edit" element={<AdminSystemVoucherFormPage />} />
            <Route path="vouchers/:id" element={<AdminSystemVoucherDetailPage />} />
            <Route path="accounts" element={<AdminAccountListPage />} />
            <Route path="accounts/:id" element={<AdminAccountDetailPage />} />
            <Route path="insights" element={<AdminCustomerInsightsPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route
              path="*"
              element={<ConsoleNotFoundPage homeTo="/admin" homeLabel="Back to dashboard" />}
            />
          </Route>
        </Route>

        {/* Seller: guest → login; wrong role → 403; unknown path → console 404 */}
        <Route element={<ProtectedRoute roles={['SELLER']} unauthorizedTo="/403" />}>
          <Route path="/seller" element={<AdminShell variant="seller" />}>
            <Route index element={<SellerHomePage />} />
            <Route path="shop-settings" element={<SellerShopSettingsPage />} />
            <Route path="alerts" element={<SellerAlertsPage />} />
            <Route path="products" element={<SellerProductListPage />} />
            <Route path="products/new" element={<SellerProductFormPage />} />
            <Route path="products/:id/inventory" element={<SellerInventoryDetailPage />} />
            <Route path="products/:id" element={<SellerProductDetailPage />} />
            <Route path="products/:id/edit" element={<SellerProductFormPage />} />
            <Route path="inventory" element={<SellerInventoryListPage />} />
            <Route path="inventory/imports" element={<SellerStockImportHistoryPage />} />
            <Route path="orders" element={<SellerOrderListPage />} />
            <Route path="orders/:orderId" element={<SellerOrderDetailPage />} />
            <Route path="returns" element={<SellerReturnListPage />} />
            <Route path="returns/:id" element={<SellerReturnDetailPage />} />
            <Route path="reports" element={<SellerReportsPage />} />
            <Route path="wallet" element={<SellerWalletPage />} />
            <Route path="settlements" element={<SellerSettlementsPage />} />
            <Route path="notifications" element={<SellerNotificationsPage />} />
            <Route path="chat" element={<SellerChatPage />} />
            <Route path="vouchers" element={<SellerShopVoucherListPage />} />
            <Route path="vouchers/new" element={<SellerShopVoucherFormPage />} />
            <Route path="vouchers/:id/edit" element={<SellerShopVoucherFormPage />} />
            <Route
              path="*"
              element={<ConsoleNotFoundPage homeTo="/seller" homeLabel="Back to dashboard" />}
            />
          </Route>
        </Route>

        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="shops/:shopKey" element={<ShopPublicPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="403" element={<ForbiddenPage />} />
          <Route path="404" element={<NotFoundPage />} />

          {/* Any signed-in role may open shared account settings. */}
          <Route element={<ProtectedRoute />}>
            <Route path="account" element={<AccountLayout />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="security" element={<AccountSecurityPage />} />
              <Route path="change-password" element={<ChangePasswordPage />} />
              <Route path="notifications" element={<NotificationsPage />} />

              {/* Buyer shopping under /account - admin-only → 403 */}
              <Route element={<ProtectedRoute roles={['BUYER']} unauthorizedTo="/403" />}>
                <Route path="orders" element={<OrdersPage />} />
                <Route path="orders/:orderId" element={<OrderDetailPage />} />
                <Route path="returns" element={<BuyerReturnsPage />} />
                <Route path="returns/:returnId" element={<BuyerReturnDetailPage />} />
                <Route path="vouchers" element={<BuyerVouchersPage />} />
                <Route path="wishlist" element={<WishlistPage />} />
                <Route path="following" element={<FollowingPage />} />
                <Route path="following/feed" element={<FollowingFeedPage />} />
                <Route path="addresses" element={<AddressesPage />} />
                <Route path="become-seller" element={<BecomeSellerPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
            <Route path="notifications" element={<Navigate to="/account/notifications" replace />} />
          </Route>

          {/* Buyer storefront flows (cart/checkout/chat/…). */}
          <Route element={<ProtectedRoute roles={['BUYER']} unauthorizedTo="/403" />}>
            <Route path="compare" element={<ComparePage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="ai/assistant" element={<Navigate to="/" replace />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="checkout/success" element={<OrderReceivedPage />} />
            <Route path="order-received" element={<OrderReceivedPage />} />
            <Route path="wishlist" element={<Navigate to="/account/wishlist" replace />} />
            <Route path="following" element={<Navigate to="/account/following" replace />} />
            <Route path="orders" element={<Navigate to="/account/orders" replace />} />
            <Route path="orders/:orderId" element={<OrdersRedirect />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </>
  );
}
