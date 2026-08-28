import { Link } from 'react-router-dom';
import { TagIcon } from './ChatIcons';
import { resolveProductImageUrl } from '../../utils/catalogImage';
import { formatMoney } from '../../utils/formatCatalog';
import type { ChatProductSummary, ProductPreview } from '../../hooks/useProductPreviews';

type ChatProductCardProps = {
  product: ChatProductSummary;
  /** Compact variant used inside a message bubble; the picker uses the roomier default. */
  inBubble?: boolean;
};

export function ChatProductCard({ product, inBubble = false }: ChatProductCardProps) {
  const discounted = product.salePrice != null && product.salePrice < product.basePrice;

  return (
    <Link
      to={`/products/${product.productId}`}
      className={`chat-product${inBubble ? ' chat-product--bubble' : ''}`}
    >
      <img
        className="chat-product__image"
        src={resolveProductImageUrl(product.imageUrl, 0)}
        alt=""
        loading="lazy"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = resolveProductImageUrl(null, 0);
        }}
      />
      <span className="chat-product__body">
        <span className="chat-product__name">{product.name}</span>
        <span className="chat-product__price">
          {formatMoney(product.effectivePrice, product.currency)}
          {discounted ? (
            <s className="chat-product__was">{formatMoney(product.basePrice, product.currency)}</s>
          ) : null}
        </span>
        <span className="chat-product__meta">
          {product.availableQuantity > 0 ? 'In stock' : 'Out of stock'}
          {product.shopName ? ` · ${product.shopName}` : ''}
        </span>
      </span>
    </Link>
  );
}

/**
 * Renders whatever is known about a shared product. A failed lookup still produces a working
 * link to the product page — the shared item must never become a dead placeholder.
 */
export function ChatProductPreviewCard({
  productId,
  preview,
}: {
  productId: string;
  preview: ProductPreview;
}) {
  if (preview.status === 'found') {
    return <ChatProductCard product={preview.product} inBubble />;
  }

  if (preview.status === 'loading') {
    return (
      <span className="chat-product chat-product--bubble chat-product--placeholder">
        <span className="chat-product__image chat-product__image--empty" />
        <span className="chat-product__body">
          <span className="chat-product__name">Loading product…</span>
        </span>
      </span>
    );
  }

  if (preview.status === 'missing') {
    return (
      <span className="chat-product chat-product--bubble chat-product--placeholder">
        <span className="chat-product__image chat-product__image--empty" />
        <span className="chat-product__body">
          <span className="chat-product__name">Product no longer available</span>
        </span>
      </span>
    );
  }

  return (
    <Link to={`/products/${productId}`} className="chat-product chat-product--bubble">
      <span className="chat-product__image chat-product__image--icon">
        <TagIcon />
      </span>
      <span className="chat-product__body">
        <span className="chat-product__name">Shared product</span>
        <span className="chat-product__meta">Open product page</span>
      </span>
    </Link>
  );
}
