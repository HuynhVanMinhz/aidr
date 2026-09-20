/** Safe post-login destination from optional returnUrl + user roles. */

function hasRole(roles: string[], role: string): boolean {
  return roles.some((r) => r.toUpperCase() === role.toUpperCase());
}

/** Default home by role: Admin → /admin, Seller → /seller, else storefront. */
export function homePathForRoles(roles: string[]): string {
  if (hasRole(roles, 'ADMIN')) return '/admin';
  if (hasRole(roles, 'SELLER')) return '/seller';
  return '/';
}

/**
 * True when the signed-in roles may open this in-app path.
 * - `/admin*` → ADMIN
 * - `/seller*` → SELLER
 * - buyer shopping paths (cart, checkout, account orders, …) → BUYER
 * - other deep links (profile, security) → any authenticated user
 */
export function canAccessReturnUrl(roles: string[], path: string): boolean {
  const pathname = path.split('?')[0]?.split('#')[0] ?? path;
  if (pathname === '/403' || pathname === '/404') return false;
  if (pathname.startsWith('/admin')) return hasRole(roles, 'ADMIN');
  if (pathname.startsWith('/seller')) return hasRole(roles, 'SELLER');
  if (isBuyerOnlyPath(pathname)) return hasRole(roles, 'BUYER');
  return true;
}

/** Storefront paths that call Buyer-policy APIs (cart, orders, wishlist, …). */
export function isBuyerOnlyPath(pathname: string): boolean {
  if (
    pathname === '/cart' ||
    pathname === '/checkout' ||
    pathname.startsWith('/checkout/') ||
    pathname === '/order-received' ||
    pathname === '/compare' ||
    pathname === '/chat' ||
    pathname === '/wishlist' ||
    pathname === '/following' ||
    pathname === '/orders' ||
    pathname.startsWith('/orders/')
  ) {
    return true;
  }

  if (!pathname.startsWith('/account')) return false;

  // Shared account settings stay open to any signed-in role (admin/seller profile).
  if (
    pathname === '/account' ||
    pathname === '/account/profile' ||
    pathname === '/account/security' ||
    pathname === '/account/change-password' ||
    pathname === '/account/notifications'
  ) {
    return false;
  }

  return true;
}

/**
 * Prefer an explicit deep-link returnUrl (cart, product, …) when the user is
 * allowed to open it. Ignore bare `/`, auth pages, external URLs, and paths
 * the session cannot access (those would only bounce to 403).
 * Otherwise send Admin/Seller to their console.
 */
export function resolvePostLoginPath(roles: string[], returnUrl?: string | null): string {
  const raw = returnUrl?.trim() ?? '';
  const isSafeDeepLink =
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    raw !== '/' &&
    !raw.startsWith('/login') &&
    !raw.startsWith('/register') &&
    !raw.startsWith('/forgot-password') &&
    !raw.startsWith('/reset-password') &&
    !raw.startsWith('/auth/');

  if (isSafeDeepLink && canAccessReturnUrl(roles, raw)) return raw;
  return homePathForRoles(roles);
}
