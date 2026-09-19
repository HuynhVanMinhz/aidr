export type ShopBankAccountStatus = 'Unverified' | 'Verified' | 'Rejected';

export type ShopBankAccount = {
  shopBankAccountId: string;
  shopId: string;
  bankBin?: string | null;
  bankName: string;
  accountNumberMasked: string;
  accountName: string;
  status: ShopBankAccountStatus;
  rejectReason?: string | null;
  verifiedAt?: string | null;
  updatedAt: string;
};

export type UpsertShopBankAccountRequest = {
  bankBin?: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export type SettlementEntryStatus =
  | 'Holding'
  | 'OnHold'
  | 'Eligible'
  | 'Approved'
  | 'Paid'
  | 'Reversed';

export type SettlementEntry = {
  settlementEntryId: string;
  orderId: string;
  orderCode: string;
  shopId: string;
  shopName?: string | null;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  status: SettlementEntryStatus;
  holdUntil: string;
  daysUntilRelease: number;
  eligibleAt?: string | null;
  payoutBatchId?: string | null;
  batchCode?: string | null;
  holdReason?: string | null;
  createdAt: string;
};

export type SettlementEntryList = {
  items: SettlementEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type SettlementSummary = {
  currency: string;
  holdingAmount: number;
  holdingCount: number;
  onHoldAmount: number;
  onHoldCount: number;
  eligibleAmount: number;
  eligibleCount: number;
  approvedAmount: number;
  approvedCount: number;
  paidAmount: number;
  paidCount: number;
  commissionPaid: number;
  nextReleaseAt?: string | null;
  hasVerifiedBankAccount: boolean;
};

export type PayoutBatchStatus =
  | 'Draft'
  | 'Approved'
  | 'Processing'
  | 'Paid'
  | 'Failed'
  | 'Cancelled';

export type PayoutBatch = {
  payoutBatchId: string;
  batchCode: string;
  shopId: string;
  shopName?: string | null;
  accountNumberMasked?: string | null;
  accountName?: string | null;
  bankName?: string | null;
  periodTo: string;
  entryCount: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  status: PayoutBatchStatus;
  approvedAt?: string | null;
  providerPayoutId?: string | null;
  providerState?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
  attemptCount: number;
  createdAt: string;
};

export type PayoutBatchList = {
  items: PayoutBatch[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type SettlementEligibleShop = {
  shopId: string;
  shopName: string;
  entryCount: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  accountNumberMasked?: string | null;
  accountName?: string | null;
  bankName?: string | null;
  bankStatus: string;
  hasOpenBatch: boolean;
  blockers: string[];
  canPayout: boolean;
};

export type PlatformCommissionPoint = {
  date: string;
  orderCount: number;
  gmv: number;
  commission: number;
  paidToSeller: number;
};

export type PlatformCommissionShop = {
  shopId: string;
  shopName: string;
  orderCount: number;
  gmv: number;
  commission: number;
};

export type PlatformCommissionReport = {
  fromUtc: string;
  toUtc: string;
  currency: string;
  commissionRate: number;
  orderCount: number;
  gmv: number;
  commission: number;
  paidToSeller: number;
  escrowHeld: number;
  awaitingPayout: number;
  series: PlatformCommissionPoint[];
  topShops: PlatformCommissionShop[];
};

export type SettlementQuery = {
  status?: string | null;
  page?: number;
  pageSize?: number;
};
