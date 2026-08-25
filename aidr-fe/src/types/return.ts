import type { ApiResult } from './auth';

export type ReturnStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Receiving'
  | 'Refunded'
  | 'Closed'
  | string;

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

export type CreateReturnPayload = {
  reason: string;
  description?: string | null;
  items?: CreateReturnItemPayload[] | null;
  evidences: CreateReturnEvidencePayload[];
};

export type BuyerReturnItem = {
  returnItemId: string;
  orderItemId: string;
  productId: string;
  productName: string;
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
  createdAt: string;
  updatedAt: string;
  items: BuyerReturnItem[];
  evidences: BuyerReturnEvidence[];
  statusHistories: BuyerReturnStatusHistory[];
};

export type AdminReturnStatusFilter =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Receiving'
  | 'Refunded'
  | 'Closed'
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
  receivingCount: number;
  refundedCount: number;
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
};

export type BuyerReturnApiResult = ApiResult<BuyerReturnRequest>;
export type AdminReturnListApiResult = ApiResult<AdminReturnListResult>;
export type AdminReturnDetailApiResult = ApiResult<AdminReturnDetail>;
