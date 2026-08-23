import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './guards/AuthGuards';
import { AppShell } from './AppShell';
import { AccountLayout } from '../components/account/AccountLayout';
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

export function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<GoogleCallbackPage />} />

      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
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
  );
}
