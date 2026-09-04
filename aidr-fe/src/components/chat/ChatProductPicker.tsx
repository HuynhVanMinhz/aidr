import { useEffect, useRef, useState } from 'react';
import { CloseIcon, SearchIcon } from './ChatIcons';
import { listProducts } from '../../services/productApi';
import { resolveProductImageUrl } from '../../utils/catalogImage';
import { formatMoney } from '../../utils/formatCatalog';
import type { ProductListItem } from '../../types/catalog';

const RESULT_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 300;

type ChatProductPickerProps = {
  /** The thread's shop — a buyer↔shop conversation is only ever about this shop's catalogue. */
  shopId: string;
  shopName: string;
  onPick: (product: ProductListItem) => void;
  onClose: () => void;
};

export function ChatProductPicker({
  shopId,
  shopName,
  onPick,
  onClose,
}: ChatProductPickerProps) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      void listProducts({ shopId, q: query.trim() || undefined, pageSize: RESULT_LIMIT })
        .then((result) => {
          if (cancelled) return;
          setItems(result.data?.items ?? []);
          setError(null);
        })
        .catch(() => {
          if (!cancelled) setError('Unable to load products.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, query ? SEARCH_DEBOUNCE_MS : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, shopId]);

  return (
    <div className="chat-picker" role="dialog" aria-label={`Products from ${shopName}`}>
      <header className="chat-picker__head">
        <strong>Share a product</strong>
        <button type="button" className="chat-icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>

      <div className="chat-finder chat-finder--picker">
        <SearchIcon className="chat-finder__icon" />
        <input
          ref={inputRef}
          type="text"
          className="chat-finder__input"
          placeholder={`Search in ${shopName}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          aria-label="Search products"
        />
      </div>

      <div className="chat-picker__list">
        {loading ? <p className="chat-picker__state">Loading…</p> : null}
        {!loading && error ? <p className="chat-picker__state">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="chat-picker__state">No products found.</p>
        ) : null}

        {!loading &&
          items.map((product) => (
            <button
              key={product.productId}
              type="button"
              className="chat-picker__item"
              onClick={() => onPick(product)}
            >
              <img
                src={resolveProductImageUrl(product.primaryImageUrl, 0)}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = resolveProductImageUrl(null, 0);
                }}
              />
              <span className="chat-picker__body">
                <span className="chat-picker__name">{product.name}</span>
                <span className="chat-picker__price">
                  {formatMoney(product.effectivePrice, product.currency)}
                </span>
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}
