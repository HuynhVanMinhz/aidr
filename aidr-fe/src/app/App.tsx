import { Navigate, Route, Routes } from 'react-router-dom';
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
import { ProductListPage } from '../views/catalog/ProductListPage';
import { ProductDetailPage } from '../views/catalog/ProductDetailPage';
import { CategoriesPage } from '../views/catalog/CategoriesPage';
import { AdminHomePage } from '../views/admin/AdminHomePage';
import { AdminCategoryListPage } from '../views/admin/AdminCategoryListPage';
import { AdminCategoryFormPage } from '../views/admin/AdminCategoryFormPage';
import { AdminSellerRegistrationListPage } from '../views/admin/AdminSellerRegistrationListPage';
import { AdminSellerRegistrationDetailPage } from '../views/admin/AdminSellerRegistrationDetailPage';
import { SellerHomePage } from '../views/seller/SellerHomePage';
import { SellerProductListPage } from '../views/seller/SellerProductListPage';
import { SellerProductFormPage } from '../views/seller/SellerProductFormPage';
import { SellerInventoryDetailPage } from '../views/seller/SellerInventoryDetailPage';
import { SellerInventoryListPage } from '../views/seller/SellerInventoryListPage';
import { SellerProductDetailPage } from '../views/seller/SellerProductDetailPage';
import { ToastHost } from '../components/feedback/ToastHost';

function AppThemeBridge() {
  useAidrShellTheme();
  return null;
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
          </Route>
        </Route>

        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="health" element={<HealthPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="account" element={<AccountLayout />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="addresses" element={<AddressesPage />} />
              <Route path="change-password" element={<ChangePasswordPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
