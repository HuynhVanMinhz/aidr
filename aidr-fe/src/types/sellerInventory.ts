export type SellerInventoryVariant = {
  variantId: string;
  variantName: string;
  sku?: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  price: number;
  salePrice?: number | null;
  effectivePrice: number;
  avgCostPrice?: number | null;
  estimatedMarginPerUnit?: number | null;
  isActive: boolean;
};

export type SellerInventoryLot = {
  lotId: string;
  variantId?: string | null;
  variantName?: string | null;
  lotCode: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  estimatedMarginPerUnit?: number | null;
  currency: string;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  receivedAt: string;
  expiresAt?: string | null;
  status: string;
  note?: string | null;
};

export type SellerInventoryTransaction = {
  inventoryTxId: number;
  lotId?: string | null;
  lotCode?: string | null;
  changeQty: number;
  unitCost?: number | null;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdAt: string;
};

export type SellerInventorySummary = {
  productCount: number;
  lowStockCount: number;
  totalUnits: number;
  reservedUnits: number;
};

export type SellerInventoryListItem = {
  productId: string;
  name: string;
  slug: string;
  status: string;
  primaryImageUrl?: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  lastCostPrice?: number | null;
  avgCostPrice?: number | null;
  /** Effective selling price minus avg cost (null if no cost). */
  estimatedMarginPerUnit?: number | null;
  basePrice: number;
  salePrice?: number | null;
  effectivePrice: number;
  currency: string;
  updatedAt: string;
};

export type SellerInventoryListResult = {
  items: SellerInventoryListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  summary: SellerInventorySummary;
};

export type SellerInventoryDetail = {
  productId: string;
  name: string;
  status: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  lastCostPrice?: number | null;
  avgCostPrice?: number | null;
  estimatedMarginPerUnit?: number | null;
  basePrice: number;
  salePrice?: number | null;
  effectivePrice: number;
  currency: string;
  /** Empty when the product is sold as a single configuration. */
  variants: SellerInventoryVariant[];
  lots: SellerInventoryLot[];
  recentTransactions: SellerInventoryTransaction[];
};

export type SellerPriceUpdate = {
  productId: string;
  basePrice: number;
  salePrice?: number | null;
  oldBasePrice?: number | null;
  oldSalePrice?: number | null;
  priceHistoryId: number;
  currency: string;
};

export type SellerInventoryQuery = {
  q?: string;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
};

export type UpdateSellerInventoryPayload = {
  lowStockThreshold: number;
};

export type AdjustSellerInventoryPayload = {
  /** Required when the product has variants and no lot is named. */
  variantId?: string | null;
  changeQty: number;
  lotId?: string | null;
  note?: string | null;
};

export type ImportStockLotPayload = {
  /** Required when the product has variants: stock belongs to a configuration. */
  variantId?: string | null;
  lotCode?: string | null;
  quantity: number;
  unitCost: number;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  receivedAt?: string | null;
  expiresAt?: string | null;
  note?: string | null;
};

export type UpdateSellingPricePayload = {
  basePrice: number;
  salePrice?: number | null;
  reason?: string | null;
};
