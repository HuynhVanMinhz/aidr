import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { selectIsAuthenticated } from '../../store/authSlice';
import type { RootState } from '../../store';

type GuestRouteProps = {
  redirectTo?: string;
};

/** Guest-only routes (login, register, forgot password). */
export function GuestRoute({ redirectTo = '/' }: GuestRouteProps) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnUrl = params.get('returnUrl');
  const target = returnUrl && returnUrl.startsWith('/') ? returnUrl : redirectTo;

  if (isAuthenticated) {
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}

type ProtectedRouteProps = {
  roles?: string[];
};

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const auth = useAppSelector((s: RootState) => s.auth);
  const location = useLocation();

  if (!auth.isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  if (roles?.length) {
    const hasRole = roles.some((role) =>
      auth.roles.some((r: string) => r.toUpperCase() === role.toUpperCase()),
    );
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}
