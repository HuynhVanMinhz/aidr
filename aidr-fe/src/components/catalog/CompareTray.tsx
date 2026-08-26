import { Link, useNavigate } from 'react-router-dom';
import { COMPARE_MIN, COMPARE_MAX } from '../../store/aiSlice';
import { useCompare } from '../../hooks/useAi';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { formatMoney } from '../../utils/formatCatalog';

const PLACEHOLDER = '/theme/images/product-image-1.png';

/** Sticky tray for products selected for AI compare. */
export function CompareTray() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const { selection, remove, clear } = useCompare();

  if (selection.length === 0) return null;

  function handleCompare() {
    if (selection.length < COMPARE_MIN) {
      toast.error(`Select at least ${COMPARE_MIN} products to compare.`);
      return;
    }
    if (!isAuthenticated) {
      navigate(`/login?returnUrl=${encodeURIComponent('/compare')}`);
      return;
    }
    navigate('/compare');
  }

  return (
    <div className="compare-tray" role="region" aria-label="Compare products">
      <div className="container compare-tray__inner">
        <div className="compare-tray__items">
          {selection.map((item) => (
            <div key={item.productId} className="compare-tray__item">
              <img
                src={item.primaryImageUrl || PLACEHOLDER}
                alt=""
                width={48}
                height={48}
              />
              <div className="compare-tray__meta">
                <Link to={`/products/${item.productId}`}>{item.name}</Link>
                <span>{formatMoney(item.effectivePrice, item.currency)}</span>
              </div>
              <button
                type="button"
                className="compare-tray__remove"
                aria-label={`Remove ${item.name} from compare`}
                onClick={() => remove(item.productId)}
              >
                ×
              </button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, COMPARE_MAX - selection.length) }).map((_, i) => (
            <div key={`slot-${i}`} className="compare-tray__slot" aria-hidden>
              +
            </div>
          ))}
        </div>
        <div className="compare-tray__actions">
          <span className="compare-tray__count">
            {selection.length}/{COMPARE_MAX}
          </span>
          <button type="button" className="btn-default btn-border" onClick={() => clear()}>
            Clear
          </button>
          <button
            type="button"
            className="btn-default btn-accent"
            disabled={selection.length < COMPARE_MIN}
            onClick={handleCompare}
          >
            Compare
          </button>
        </div>
      </div>
    </div>
  );
}
