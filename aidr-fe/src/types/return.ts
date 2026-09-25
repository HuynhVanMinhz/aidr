import type { ApiResult } from './auth';

export type ReturnStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'SellerConfirmed'
  | 'AwaitingPickup'
  | 'PickedUp'
  | 'InTransit'
  | 'PickupFailed'
  | 'Receiving'
  | 'Accepted'
  | 'Refunded'
  | 'Exchanged'
  | 'Closed'
  | string;

export type ReturnShipment = {
  returnShipmentId: string;
  returnRequestId: string;
  provider: string;
  trackingCode?: string | null;
  status: string;
  shippingFeeQuoted?: number | null;
  expectedDeliveryAt?: string | null;
  attemptCount: number;
  lastError?: string | null;
  createdAt: string;
};

export type ReturnResolutionType = 'ReturnRefund' | 'Exchange' | string;

export type ReturnEvidenceType = 'Unboxing' | 'Testing' | 'Other' | string;

export type CreateReturnEvidencePayload = {
  evidenceType: ReturnEvidenceType;
  mediaUrl: string;
  publicId?: string | null;
};

export type CreateReturnItemPayload = {
  orderItemId: string;
  quantity: number;
};

export type RefundBankInfoPayload = {
  bankBin?: string | null;
  bankName?: string | null;
  accountNumber: string;
  accountName: string;
};

export type CreateReturnPayload = {
  reason: string;
  description?: string | null;
  resolutionType?: ReturnResolutionType | null;
  refundBankInfo?: RefundBankInfoPayload | null;
  items?: CreateReturnItemPayload[] | null;
  evidences: CreateReturnEvidencePayload[];
};

export type BuyerReturnItem = {
  returnItemId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  sku?: string | null;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type BuyerReturnEvidence = {
  evidenceId: string;
  evidenceType: ReturnEvidenceType;
  mediaUrl: string;
  publicId?: string | null;
  sortOrder: number;
};

export type BuyerReturnStatusHistory = {
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  createdAt: string;
};

export type BuyerReturnRequest = {
  returnRequestId: string;
  orderId: string;
  orderCode: string;
  reason: string;
  description?: string | null;
  resolutionType: string;
  status: ReturnStatus;
  refundAmount?: number | null;
  adminNote?: string | null;
  refundTransferProofUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  items: BuyerReturnItem[];
  evidences: BuyerReturnEvidence[];
  statusHistories: BuyerReturnStatusHistory[];
};

export type AdminReturnStatusFilter =
  | 'Pending'
  | 'Approved'
  | 'SellerConfirmed'
  | 'Receiving'
  | 'Accepted'
  | 'Refunded'
  | 'Exchanged'
  | 'Closed'
  | 'Rejected'
  | 'all';

export type AdminReturnListQuery = {
  status?: AdminReturnStatusFilter | string | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
};

export type AdminReturnListItem = {
  returnRequestId: string;
  orderId: string;
  orderCode: string;
  shopId: string;
  shopName: string;
  buyerUserId: string;
  buyerEmail: string;
  buyerFullName: string;
  reason: string;
  status: ReturnStatus;
  resolutionType: string;
  refundAmount?: number | null;
  orderTotalAmount: number;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminReturnListResult = {
  items: AdminReturnListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  sellerConfirmedCount: number;
  receivingCount: number;
  acceptedCount: number;
  refundedCount: number;
  exchangedCount: number;
  closedCount: number;
};

export type AdminReturnItem = {
  returnItemId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type AdminReturnEvidence = {
  evidenceId: string;
  evidenceType: ReturnEvidenceType;
  mediaUrl: string;
  publicId?: string | null;
  sortOrder: number;
  createdAt: string;
};

export type AdminReturnStatusHistory = {
  fromStatus?: string | null;
  toStatus: string;
  changedBy?: string | null;
  changedByFullName?: string | null;
  note?: string | null;
  createdAt: string;
};

export type AdminReturnDetail = {
  returnRequestId: string;
  orderId: string;
  orderCode: string;
  orderStatus: string;
  shopId: string;
  shopName: string;
  shopOwnerUserId?: string;
  buyerUserId: string;
  buyerEmail: string;
  buyerFullName: string;
  reason: string;
  description?: string | null;
  resolutionType: string;
  status: ReturnStatus;
  refundAmount?: number | null;
  orderTotalAmount: number;
  adminNote?: string | null;
  reviewedBy?: string | null;
  reviewerFullName?: string | null;
  reviewedAt?: string | null;
  refundBankBin?: string | null;
  refundBankName?: string | null;
  /** Full account number — returned only for admin endpoints. */
  refundAccountNumber?: string | null;
  refundAccountNumberMasked?: string | null;
  refundAccountName?: string | null;
  refundTransferProofUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminReturnItem[];
  evidences: AdminReturnEvidence[];
  statusHistories: AdminReturnStatusHistory[];
};

export type RejectReturnPayload = {
  adminNote: string;
};

export type UpdateReturnStatusPayload = {
  status: string;
  note?: string | null;
  refundToBin?: string | null;
  refundToAccountNumber?: string | null;
  refundTransferProofUrl?: string | null;
};

export type SellerReturnListItem = {
  returnRequestId: string;
  orderId: string;
  orderCode: string;
  buyerUserId: string;
  buyerEmail: string;
  buyerFullName: string;
  reason: string;
  status: ReturnStatus;
  resolutionType: string;
  refundAmount?: number | null;
  orderTotalAmount: number;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SellerReturnListResult = {
  items: SellerReturnListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  approvedCount: number;
  sellerConfirmedCount: number;
  receivingCount: number;
  acceptedCount: number;
};

export type SellerReturnDetail = {
  returnRequestId: string;
  orderId: string;
  orderCode: string;
  orderStatus: string;
  shopId: string;
  shopName: string;
  buyerUserId: string;
  buyerEmail: string;
  buyerFullName: string;
  reason: string;
  description?: string | null;
  resolutionType: string;
  status: ReturnStatus;
  refundAmount?: number | null;
  orderTotalAmount: number;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminReturnItem[];
  evidences: AdminReturnEvidence[];
  statusHistories: AdminReturnStatusHistory[];
};

export type ConfirmSellerReturnPayload = {
  resolutionType?: ReturnResolutionType | null;
  note?: string | null;
};

export type RejectSellerReturnPayload = {
  note: string;
};

export type SellerReturnActionPayload = {
  note?: string | null;
};

export type AdminMarkReceivingPayload = {
  note?: string | null;
};

export type BuyerReturnApiResult = ApiResult<BuyerReturnRequest>;
export type AdminReturnListApiResult = ApiResult<AdminReturnListResult>;
export type AdminReturnDetailApiResult = ApiResult<AdminReturnDetail>;
export type ReturnShipmentApiResult = ApiResult<ReturnShipment | null>;
export type SellerReturnListApiResult = ApiResult<SellerReturnListResult>;
export type SellerReturnDetailApiResult = ApiResult<SellerReturnDetail>;
