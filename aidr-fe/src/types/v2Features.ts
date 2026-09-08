import type { ApiResult } from './auth';

import type { ProductListItem } from './catalog';



export type ProductPriceHistoryPoint = {

  at: string;

  price: number;

};



export type ProductPriceHistory = {

  productId: string;

  days: number;

  currentPrice: number;

  lowestInPeriod: number | null;

  highestInPeriod: number | null;

  points: ProductPriceHistoryPoint[];

};



export type ProductPriceHistoryApiResult = ApiResult<ProductPriceHistory>;



export type PriceAlertStatus = {

  priceDrop: boolean;

  backInStock: boolean;

};



export type PriceAlertStatusApiResult = ApiResult<PriceAlertStatus>;



export type PriceAlertItem = {

  priceAlertId: string;

  productId: string;

  productName: string;

  productSlug: string;

  primaryImageUrl: string | null;

  alertType: 'PriceDrop' | 'BackInStock';

  baselinePrice: number | null;

  thresholdPct: number;

  thresholdAmount: number;

  currentPrice: number;

  isActive: boolean;

  lastTriggeredAt: string | null;

  expiresAt: string | null;

  createdAt: string;

};



export type CreatePriceAlertRequest = {

  productId: string;

  alertType: 'PriceDrop' | 'BackInStock';

  thresholdPct?: number;

  thresholdAmount?: number;

};



export type BuyerProtectionTimelineStep = {

  key: string;

  label: string;

  state: 'done' | 'current' | 'upcoming' | 'info' | 'warning' | 'cancelled';

  at: string | null;

  dueAt: string | null;

  detail: string | null;

};



export type BuyerProtectionTimeline = {

  orderId: string;

  orderStatus: string;

  currency: string;

  steps: BuyerProtectionTimelineStep[];

  returnRequest: {

    status: string | null;

    canOpen: boolean;

    returnDeadline: string | null;

  };

  shipmentTrackingUrl: string | null;

};



export type BuyerProtectionTimelineApiResult = ApiResult<BuyerProtectionTimeline>;



export type ReviewDigestSentiment = {

  positive: number;

  neutral: number;

  negative: number;

};



export type ReviewDigest = {

  available: boolean;

  reviewCount: number;

  generatedAt: string | null;

  source: string | null;

  summaryLine: string | null;

  pros: string[];

  cons: string[];

  sentiment: ReviewDigestSentiment | null;

};



export type ReviewDigestApiResult = ApiResult<ReviewDigest>;



export type BundleItem = {

  productId: string;

  name: string;

  slug: string;

  shortDescription: string | null;

  brand: string | null;

  basePrice: number;

  salePrice: number | null;

  effectivePrice: number;

  currency: string;

  availableQuantity: number;

  avgRating: number;

  reviewCount: number;

  primaryImageUrl: string | null;

  categoryId: number;

  categoryName: string;

  shopId: string;

  shopName: string;

  reason: string | null;

};



export type ProductBundle = {

  productId: string;

  productName: string;

  items: BundleItem[];

  totalCount: number;

  source: string;

};



export type ProductBundleApiResult = ApiResult<ProductBundle>;



export type CompatibilityCheckRequest = {

  primaryProductId: string;

  secondaryProductId?: string;

  freeTextDevice?: string;

};



export type MatchedSpec = {

  label: string;

  primary: string | null;

  secondary: string | null;

};



export type CompatibilityResult = {

  verdict: string;

  headline: string;

  reasons: string[];

  matchedSpecs: MatchedSpec[];

  source: string;

};



export type CompatibilityResultApiResult = ApiResult<CompatibilityResult>;



export type ReorderSkippedItem = {

  productId: string;

  variantId: string | null;

  productName: string;

  reason: string;

};



export type ReorderOrderResponse = {

  addedCount: number;

  skippedItems: ReorderSkippedItem[];

};



export type ReorderOrderApiResult = ApiResult<ReorderOrderResponse>;



export type FollowFeedVoucher = {

  voucherId: string;

  code: string;

  name: string;

  description: string | null;

  discountType: string;

  discountValue: number;

  maxDiscountAmount: number | null;

  minOrderAmount: number;

  startsAt: string;

  endsAt: string;

};



export type FollowFeedItem = {

  itemType: string;

  createdAt: string;

  shopId: string;

  shopName: string;

  shopSlug: string;

  product: ProductListItem | null;

  voucher: FollowFeedVoucher | null;

};



export type FollowFeedResult = {

  items: FollowFeedItem[];

  page: number;

  pageSize: number;

  totalCount: number;

  totalPages: number;

};



export type FollowFeedApiResult = ApiResult<FollowFeedResult>;



export type ProductAnswer = {

  answerId: string;

  questionId: string;

  userId: string;

  userName: string;

  userAvatarUrl: string | null;

  content: string;

  isOfficial: boolean;

  isOwn: boolean;

  createdAt: string;

};



export type ProductQuestion = {

  questionId: string;

  productId: string;

  userId: string;

  userName: string;

  userAvatarUrl: string | null;

  content: string;

  status: string;

  isOwn: boolean;

  canHide: boolean;

  createdAt: string;

  answers: ProductAnswer[];

};



export type ProductQuestionListResult = {

  productId: string;

  items: ProductQuestion[];

  page: number;

  pageSize: number;

  totalCount: number;

  totalPages: number;

};



export type CreateProductQuestionRequest = {

  content: string;

};



export type CreateProductAnswerRequest = {

  content: string;

};



export type ProductQuestionListApiResult = ApiResult<ProductQuestionListResult>;

export type ProductQuestionApiResult = ApiResult<ProductQuestion>;

export type ProductAnswerApiResult = ApiResult<ProductAnswer>;



export type RestockAdviceItem = {

  productId: string;

  name: string;

  slug: string;

  availableQuantity: number;

  lowStockThreshold: number;

  avgDailySales: number;

  daysUntilStockout: number | null;

  suggestedQty: number;

  note: string;

};



export type RestockAdviceResult = {

  salesWindowDays: number;

  items: RestockAdviceItem[];

};



export type RestockAdviceApiResult = ApiResult<RestockAdviceResult>;


