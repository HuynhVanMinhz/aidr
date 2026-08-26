import type { ApiResult, PagedResult, ProductListItem, ProductSort } from './catalog';

export type RecommendationStrategy = 'Collaborative' | 'Content' | 'Hybrid' | 'Popular' | string;

export type RecommendedProduct = ProductListItem & {
  score: number;
  strategy: RecommendationStrategy;
};

export type SimilarProduct = ProductListItem & {
  score: number;
};

export type RecommendationQuery = {
  page?: number;
  pageSize?: number;
};

export type SimilarProductsQuery = {
  limit?: number;
};

export type AiSource = 'groq' | 'heuristic' | string;

export type NlFilterRequest = {
  query: string;
};

export type NlFilterResult = {
  q?: string | null;
  shopId?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  brand?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
  sort?: ProductSort | string | null;
  interpretedQuery: string;
  confidence: number;
  source: AiSource;
};

export type CompareProductsRequest = {
  productIds: string[];
};

export type CompareProductCard = {
  productId: string;
  name: string;
  slug: string;
  brand?: string | null;
  modelNumber?: string | null;
  conditionType?: string;
  basePrice: number;
  salePrice?: number | null;
  effectivePrice: number;
  currency: string;
  avgRating: number;
  reviewCount: number;
  warrantyMonths?: number | null;
  originCountry?: string | null;
  availableQuantity?: number;
  soldCount?: number;
  primaryImageUrl?: string | null;
  categoryId: number;
  categoryName: string;
  shopId: string;
  shopName: string;
  tags?: string[];
  specs: Record<string, string>;
};

export type CompareDimension = {
  key: string;
  label: string;
  values: Record<string, string>;
};

export type CompareProductsResult = {
  products: CompareProductCard[];
  dimensions: CompareDimension[];
  summary: string;
  highlights: string[];
  source: AiSource;
};

export type CompareSelectionItem = {
  productId: string;
  name: string;
  primaryImageUrl?: string | null;
  effectivePrice: number;
  currency: string;
};

export type AiChatRequest = {
  conversationId?: string | null;
  message: string;
};

export type AiMessage = {
  aiMessageId: number;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  metaJson?: string | null;
  createdAt: string;
  /** Populated from the latest chat turn; may be empty for historical messages. */
  suggestedProducts?: AiSuggestedProduct[];
};

export type AiSuggestedProduct = {
  productId: string;
  name: string;
  slug: string;
  brand?: string | null;
  basePrice: number;
  salePrice?: number | null;
  effectivePrice: number;
  currency: string;
  avgRating: number;
  reviewCount: number;
  primaryImageUrl?: string | null;
  categoryId: number;
  categoryName: string;
  shopId: string;
  shopName: string;
};

export type AiChatResult = {
  conversationId: string;
  title?: string | null;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
  suggestedProducts: AiSuggestedProduct[];
  source: AiSource;
};

export type AiConversationSummary = {
  conversationId: string;
  channel: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview?: string | null;
  messageCount: number;
};

export type AiConversationDetail = {
  conversationId: string;
  channel: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: AiMessage[];
};

/** Strip recommendation metadata so cards can reuse catalog ProductCard. */
export function toProductListItem(product: RecommendedProduct | SimilarProduct): ProductListItem {
  return {
    productId: product.productId,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    brand: product.brand,
    basePrice: product.basePrice,
    salePrice: product.salePrice,
    effectivePrice: product.effectivePrice,
    currency: product.currency,
    stockQuantity: product.stockQuantity,
    availableQuantity: product.availableQuantity,
    avgRating: product.avgRating,
    reviewCount: product.reviewCount,
    soldCount: product.soldCount,
    isFeatured: product.isFeatured,
    primaryImageUrl: product.primaryImageUrl,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    shopId: product.shopId,
    shopName: product.shopName,
    publishedAt: product.publishedAt,
  };
}

export type { ApiResult, PagedResult };
