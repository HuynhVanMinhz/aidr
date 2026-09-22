const BASE = 'badge px-2 py-1 fs-13';

/** Larkon orders-list badge variants. */
export const adminBadgeClass = {
  solidSuccess: `${BASE} bg-success text-light`,
  solidLight: `${BASE} bg-light text-dark`,
  outlineSecondary: `${BASE} border border-secondary text-secondary`,
  outlineWarning: `${BASE} border border-warning text-warning`,
  outlineSuccess: `${BASE} border border-success text-success`,
  outlineDanger: `${BASE} border border-danger text-danger`,
  outlinePrimary: `${BASE} border border-primary text-primary`,
} as const;

export function sellerRegistrationBadgeClass(status: string): string {
  switch (status) {
    case 'Approved':
      return adminBadgeClass.solidSuccess;
    case 'Rejected':
      return adminBadgeClass.outlineDanger;
    // Pending is on us to decide; NeedsMoreInfo is on the applicant. Same colour
    // for both would hide which queue actually needs attention.
    case 'NeedsMoreInfo':
      return adminBadgeClass.outlinePrimary;
    default:
      return adminBadgeClass.outlineWarning;
  }
}

export function productModerationBadgeClass(status: string): string {
  switch (status) {
    case 'Approved':
      return adminBadgeClass.solidSuccess;
    case 'Pending':
      return adminBadgeClass.outlineWarning;
    case 'Rejected':
    case 'Deleted':
      return adminBadgeClass.outlineDanger;
    case 'Draft':
      return adminBadgeClass.outlineSecondary;
    case 'Inactive':
      return adminBadgeClass.solidLight;
    default:
      return adminBadgeClass.solidLight;
  }
}

export function reviewModerationBadgeClass(status: string): string {
  switch (status) {
    case 'Reported':
      return adminBadgeClass.outlineDanger;
    case 'PendingTrust':
      return adminBadgeClass.outlineWarning;
    case 'Approved':
      return adminBadgeClass.solidSuccess;
    default:
      return adminBadgeClass.outlineSecondary;
  }
}

export function moderationActionBadgeClass(action: string): string {
  switch (action) {
    case 'Approve':
      return adminBadgeClass.outlineSuccess;
    case 'Reject':
      return adminBadgeClass.outlineDanger;
    default:
      return adminBadgeClass.outlinePrimary;
  }
}

export function categoryVisibilityBadgeClass(isActive: boolean): string {
  return isActive ? adminBadgeClass.solidSuccess : adminBadgeClass.outlineSecondary;
}
