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
 * Prefer an explicit deep-link returnUrl (cart, product, …).
 * Ignore bare `/`, auth pages, and external/protocol-relative URLs.
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

  if (isSafeDeepLink) return raw;
  return homePathForRoles(roles);
}
