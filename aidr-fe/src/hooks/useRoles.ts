import { useMemo } from 'react';
import { useAuth } from './useAuth';

export type AppRole = 'BUYER' | 'SELLER' | 'ADMIN';

/**
 * A place the account can work from that is not the storefront. Sellers and
 * admins get one each; an account holding both roles gets both.
 */
export type Workspace = {
  to: string;
  label: string;
  /** Font Awesome class, matching the rest of the storefront chrome. */
  icon: string;
};

const ROLE_LABELS: Record<AppRole, string> = {
  BUYER: 'Buyer',
  SELLER: 'Seller',
  ADMIN: 'Admin',
};

/**
 * One reading of the session's roles for the whole storefront chrome. Before
 * this, each component did its own `roles.some(...)` and they drifted - the nav
 * offered admins a "Become a seller" pitch the admin panel exists to moderate.
 */
export function useRoles() {
  const { isAuthenticated, roles } = useAuth();

  return useMemo(() => {
    const upper = new Set(roles.map((role) => role.trim().toUpperCase()));

    const isAdmin = upper.has('ADMIN');
    const isSeller = upper.has('SELLER');

    const workspaces: Workspace[] = [];
    if (isSeller) workspaces.push({ to: '/seller', label: 'Seller center', icon: 'fa-solid fa-store' });
    if (isAdmin) workspaces.push({ to: '/admin', label: 'Admin panel', icon: 'fa-solid fa-shield-halved' });

    // Only a plain shopper is offered the seller application. An admin applying
    // to sell, or a seller applying twice, is noise at best.
    const canBecomeSeller = isAuthenticated && !isSeller && !isAdmin;

    const badges = (['ADMIN', 'SELLER'] as AppRole[])
      .filter((role) => upper.has(role))
      .map((role) => ROLE_LABELS[role]);

    return {
      isAuthenticated,
      isAdmin,
      isSeller,
      /** Signed in with no elevated role - the default storefront experience. */
      isBuyerOnly: isAuthenticated && !isSeller && !isAdmin,
      canBecomeSeller,
      workspaces,
      /** Empty for a plain buyer: "Buyer" on a badge tells nobody anything. */
      badges,
    };
  }, [isAuthenticated, roles]);
}
