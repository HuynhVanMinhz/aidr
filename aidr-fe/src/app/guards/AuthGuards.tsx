import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { selectIsAuthenticated } from '../../store/authSlice';
import type { RootState } from '../../store';
import { resolvePostLoginPath } from '../../utils/postLoginRedirect';

type GuestRouteProps = {
  redirectTo?: string;
};

function hasAnyRole(userRoles: string[], required: string[]): boolean {
  return required.some((role) =>
    userRoles.some((r) => r.toUpperCase() === role.toUpperCase()),
  );
}

/** Guest-only routes (login, register). Authenticated users are sent to their home. */
export function GuestRoute({ redirectTo = '/' }: GuestRouteProps) {
  const auth = useAppSelector((s: RootState) => s.auth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnUrl = params.get('returnUrl');

  if (isAuthenticated) {
    return <Navigate to={resolvePostLoginPath(auth.roles, returnUrl ?? redirectTo)} replace />;
  }

  return <Outlet />;
}

type ProtectedRouteProps = {
  /** If set, the session must include at least one of these roles. */
  roles?: string[];
  /**
   * Where authenticated users go when they lack a required role.
   * - `/403` — known area, wrong role (admin/seller consoles)
   * - `/404` — hide that the route exists
   */
  unauthorizedTo?: '/403' | '/404';
};

/**
 * Auth / role gate:
 * 1. Not signed in → `/login?returnUrl=…`
 * 2. Signed in but missing required role → `/403` or `/404`
 * 3. Otherwise render child routes
 */
export function ProtectedRoute({ roles, unauthorizedTo = '/403' }: ProtectedRouteProps) {
  const auth = useAppSelector((s: RootState) => s.auth);
  const location = useLocation();

  if (!auth.isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  if (roles?.length && !hasAnyRole(auth.roles, roles)) {
    return <Navigate to={unauthorizedTo} replace />;
  }

  return <Outlet />;
}
