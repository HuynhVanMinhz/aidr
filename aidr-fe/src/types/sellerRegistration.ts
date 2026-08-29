import type { ApiResult } from './auth';
import type { KycVerification } from './kyc';

export type SellerBusinessType = 'Individual' | 'Household' | 'Company';

export type SellerRegistrationStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'NeedsMoreInfo'
  | string;

export type BuyerSellerRegistration = {
  requestId: string;
  shopName: string;
  businessInfo?: string | null;
  businessType?: SellerBusinessType | null;
  taxCode?: string | null;
  businessAddress?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  licenseImageUrl?: string | null;
  documentUrls: string[];
  status: SellerRegistrationStatus;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  kyc?: KycVerification | null;
  canEdit: boolean;
};

export type CreateSellerRegistrationPayload = {
  shopName: string;
  businessInfo?: string | null;
  businessType: SellerBusinessType;
  taxCode?: string | null;
  businessAddress?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  licenseImageUrl?: string | null;
  documentUrls?: string[] | null;
};

export type BuyerSellerRegistrationApiResult = ApiResult<BuyerSellerRegistration>;
