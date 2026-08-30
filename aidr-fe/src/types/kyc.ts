import type { ApiResult } from './auth';

export type KycStatus = 'Pending' | 'Passed' | 'ManualReview' | 'Failed' | string;

export type KycVerification = {
  kycVerificationId: string;
  provider: string;
  status: KycStatus;
  documentType?: string | null;
  /** Masked — only the last four digits are readable. */
  documentNumberMask?: string | null;
  fullName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  homeTown?: string | null;
  permanentAddress?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  selfieImageUrl?: string | null;
  faceMatchSimilarity?: number | null;
  faceMatched: boolean;
  failureReason?: string | null;
  /** True when the result came from the local mock rather than a real check. */
  isMock: boolean;
  createdAt: string;
  verifiedAt?: string | null;
  canStartSellerApplication: boolean;
};

export type KycVerifyPayload = {
  frontImageUrl: string;
  backImageUrl?: string | null;
  selfieImageUrl: string;
};

export type KycVerificationApiResult = ApiResult<KycVerification | null>;
