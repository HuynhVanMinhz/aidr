import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CartItem } from '../../types/cart';
import { formatMoney } from '../../utils/formatCatalog';
import { resolveProductImageUrl } from '../../utils/catalogImage';

const MAX_QTY = 99;

type Props = {
  item: CartItem;
  index: number;
  busy: boolean;
  onChangeQty: (cartItemId: string, nextQty: number, maxAvailable: number) => void;
  onRemove: (cartItemId: string) => void;
};

function formatQty(value: number) {
  return String(value);
}

export function CartItemRow({ item, index, busy, onChangeQty, onRemove }: Props) {
  const [imageSrc, setImageSrc] = useState(() =>
    resolveProductImageUrl(item.primaryImageUrl, index),
  );
  const maxQty = Math.min(MAX_QTY, Math.max(1, item.availableQuantity));
  const priceChanged = item.currentPrice !== item.unitPriceSnapshot;
  const lowStock = item.isAvailable && item.availableQuantity > 0 && item.availableQuantity <= 5;

  return (
    <article className={`cart-line${!item.isAvailable ? ' cart-line--unavailable' : ''}`}>
      <div className="cart-line__product-col">
        <div className="cart-line__media">
          <Link to={`/products/${item.productId}`} className="cart-line__image-link" tabIndex={-1}>
            <img
              src={imageSrc}
              alt={item.productName}
              loading="lazy"
              onError={() => setImageSrc(resolveProductImageUrl(null, index))}
            />
          </Link>
          <button
            type="button"
            className="cart-line__remove"
            aria-label={`Remove ${item.productName} from cart`}
            disabled={busy}
            onClick={() => onRemove(item.cartItemId)}
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        <div className="cart-line__info">
          <h3 className="cart-line__title">
            <Link to={`/products/${item.productId}`}>{item.productName}</Link>
          </h3>
          <p className="cart-line__shop">
            <Link to={`/shops/${encodeURIComponent(item.shopSlug || item.shopId)}`}>
              {item.shopName}
            </Link>
          </p>
          <p
            className={`cart-line__stock${
              !item.isAvailable
                ? ' is-out-of-stock'
                : lowStock
                  ? ' is-low-stock'
                  : ' is-in-stock'
            }`}
          >
            {!item.isAvailable
              ? 'Out of stock'
              : lowStock
                ? `Only ${item.availableQuantity} left`
                : 'In stock'}
          </p>
          <p className="cart-line__unit-price cart-line__unit-price--mobile">
            <span className="cart-line__price-label">Unit</span>
            <span>{formatMoney(item.unitPriceSnapshot, item.currency)}</span>
            {priceChanged ? (
              <span className="cart-line__price-now">
                Now {formatMoney(item.currentPrice, item.currency)}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="cart-line__price-col" aria-label="Unit price">
        <span className="cart-line__col-label">Price</span>
        <p className="cart-line__unit-price">
          {formatMoney(item.unitPriceSnapshot, item.currency)}
        </p>
        {priceChanged ? (
          <p className="cart-line__price-now">
            Now {formatMoney(item.currentPrice, item.currency)}
          </p>
        ) : null}
      </div>

      <div className="cart-line__qty-col">
        <span className="cart-line__col-label">Quantity</span>
        <div className="cart-qty-stepper">
          <button
            type="button"
            className="cart-qty-stepper__btn"
            aria-label="Decrease quantity"
            disabled={busy || item.quantity <= 1}
            onClick={() => onChangeQty(item.cartItemId, item.quantity - 1, maxQty)}
          >
            <i className="fa-solid fa-minus" aria-hidden />
          </button>
          <span className="cart-qty-stepper__value" aria-live="polite" aria-label="Quantity">
            {formatQty(item.quantity)}
          </span>
          <button
            type="button"
            className="cart-qty-stepper__btn"
            aria-label="Increase quantity"
            disabled={busy || item.quantity >= maxQty || !item.isAvailable}
            onClick={() => onChangeQty(item.cartItemId, item.quantity + 1, maxQty)}
          >
            <i className="fa-solid fa-plus" aria-hidden />
          </button>
        </div>
      </div>

      <div className="cart-line__total-col">
        <span className="cart-line__col-label">Subtotal</span>
        <p className="cart-line__line-total">{formatMoney(item.lineTotal, item.currency)}</p>
      </div>
    </article>
  );
}
