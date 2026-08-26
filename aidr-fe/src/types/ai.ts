import type { ApiResult, PagedResult, ProductListItem } from './catalog';

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
