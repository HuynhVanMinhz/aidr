import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute } from './guards/AuthGuards';
import { AppShell } from './AppShell';
import { HomePage } from '../views/HomePage';
import { HealthPage } from '../views/HealthPage';
import { LoginPage } from '../views/auth/LoginPage';
import { RegisterPage } from '../views/auth/RegisterPage';
import { ForgotPasswordPage } from '../views/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../views/auth/ResetPasswordPage';
import { GoogleCallbackPage } from '../views/auth/GoogleCallbackPage';

export function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<GoogleCallbackPage />} />

      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="health" element={<HealthPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
