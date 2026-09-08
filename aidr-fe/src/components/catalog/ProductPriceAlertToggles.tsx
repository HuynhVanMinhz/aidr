import { useCallback, useEffect, useState } from 'react';
import { createPriceAlert, getProductPriceAlertStatus, removePriceAlertByProduct } from '../../services/priceAlertApi';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../utils/apiError';

type Props = {
  productId: string;
  isAuthenticated: boolean;
  availableQuantity: number;
};

export function ProductPriceAlertToggles({ productId, isAuthenticated, availableQuantity }: Props) {
  const toast = useToast();
  const [priceDrop, setPriceDrop] = useState(false);
  const [backInStock, setBackInStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'PriceDrop' | 'BackInStock' | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setPriceDrop(false);
      setBackInStock(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getProductPriceAlertStatus(productId)
      .then((result) => {
        if (cancelled || !result.success || !result.data) return;
        setPriceDrop(result.data.priceDrop);
        setBackInStock(result.data.backInStock);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, productId]);

  const toggle = useCallback(
    async (alertType: 'PriceDrop' | 'BackInStock', enabled: boolean) => {
      if (!isAuthenticated) {
        toast.error('Sign in to manage price alerts.');
        return;
      }

      if (alertType === 'BackInStock' && availableQuantity > 0) {
        toast.error('Back-in-stock alerts are only available when the product is out of stock.');
        return;
      }

      setBusy(alertType);
      try {
        if (enabled) {
          await createPriceAlert({ productId, alertType });
          toast.success('Price alert enabled.');
          if (alertType === 'PriceDrop') setPriceDrop(true);
          else setBackInStock(true);
        } else {
          await removePriceAlertByProduct(productId, alertType);
          toast.success('Price alert removed.');
          if (alertType === 'PriceDrop') setPriceDrop(false);
          else setBackInStock(false);
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Unable to update price alert.'));
      } finally {
        setBusy(null);
      }
    },
    [availableQuantity, isAuthenticated, productId, toast],
  );

  if (!isAuthenticated) return null;

  return (
    <div className="catalog-price-alerts">
      <p className="catalog-price-alerts__label">Price alerts</p>
      <label className="catalog-price-alerts__item">
        <input
          type="checkbox"
          checked={priceDrop}
          disabled={loading || busy !== null}
          onChange={(e) => void toggle('PriceDrop', e.target.checked)}
        />
        <span>Notify me when the price drops</span>
      </label>
      {availableQuantity <= 0 && (
        <label className="catalog-price-alerts__item">
          <input
            type="checkbox"
            checked={backInStock}
            disabled={loading || busy !== null}
            onChange={(e) => void toggle('BackInStock', e.target.checked)}
          />
          <span>Notify me when back in stock</span>
        </label>
      )}
    </div>
  );
}
