import type { ApiResult } from './auth';

export type SellerDashboardOrderKpi = {
  totalCount: number;
  pendingPaymentCount: number;
  awaitingFulfillmentCount: number;
  shippingCount: number;
  deliveredCount: number;
  completedCount: number;
  cancelledCount: number;
  returnRequestedCount: number;
  returnedCount: number;
};

export type SellerDashboardRevenueKpi = {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
};

export type SellerDashboardCatalogKpi = {
  pendingProductCount: number;
  lowStockCount: number;
  activeProductCount: number;
};

export type SellerDashboardWalletKpi = {
  availableBalance: number;
  pendingBalance: number;
};

export type SellerDashboardRecentOrder = {
  orderId: string;
  orderCode: string;
  status: string;
  totalAmount: number;
  createdAt: string;
};

export type SellerDashboardLowStockItem = {
  productId: string;
  name: string;
  availableQuantity: number;
  lowStockThreshold: number;
};

export type SellerDashboard = {
  shopId: string;
  currency: string;
  orders: SellerDashboardOrderKpi;
  revenue: SellerDashboardRevenueKpi;
  catalog: SellerDashboardCatalogKpi;
  wallet: SellerDashboardWalletKpi;
  recentOrders: SellerDashboardRecentOrder[];
  lowStockItems: SellerDashboardLowStockItem[];
  generatedAt: string;
};

export type SellerSalesReportGranularity = 'day' | 'week' | 'month';

export type SellerSalesReportQuery = {
  from?: string;
  to?: string;
  granularity?: SellerSalesReportGranularity;
};

export type SellerSalesReportTotals = {
  orderCount: number;
  unitsSold: number;
  orderRevenue: number;
  productRevenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPercent: number;
};

export type SellerSalesReportPeriod = {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  unitsSold: number;
  orderRevenue: number;
  productRevenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPercent: number;
};

export type SellerSalesReportProduct = {
  productId: string;
  productName: string;
  unitsSold: number;
  productRevenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPercent: number;
};

export type SellerSalesReport = {
  shopId: string;
  currency: string;
  granularity: string;
  from: string;
  to: string;
  totals: SellerSalesReportTotals;
  series: SellerSalesReportPeriod[];
  topProducts: SellerSalesReportProduct[];
};

export type SellerWalletQuery = {
  txType?: string | null;
  page?: number;
  pageSize?: number;
};

export type SellerWalletTransaction = {
  walletTxId: number;
  txType: string;
  amount: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdAt: string;
};

export type SellerWallet = {
  walletId: string;
  shopId: string;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  updatedAt: string;
  transactions: SellerWalletTransaction[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type SellerDashboardApiResult = ApiResult<SellerDashboard>;
export type SellerSalesReportApiResult = ApiResult<SellerSalesReport>;
export type SellerWalletApiResult = ApiResult<SellerWallet>;
