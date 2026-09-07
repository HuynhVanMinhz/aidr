import { formatMoney } from '../../utils/formatCatalog';
import { formatOrderDate } from '../../utils/orderUi';

export type OrderInvoiceLine = {
  key: string;
  productName: string;
  variantName?: string | null;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderInvoiceShipping = {
  receiverName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
};

export type OrderInvoiceProps = {
  orderCode: string;
  shopName: string;
  currency: string;
  createdAt: string;
  paidAt?: string | null;
  subtotalAmount: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  shipping: OrderInvoiceShipping;
  items: OrderInvoiceLine[];
  buyerNote?: string | null;
  printId?: string;
};

function formatAddress(parts: OrderInvoiceShipping) {
  return `${parts.streetAddress}, ${parts.ward}, ${parts.district}, ${parts.province}`;
}

export function OrderInvoice({
  orderCode,
  shopName,
  currency,
  createdAt,
  paidAt,
  subtotalAmount,
  discountAmount,
  shippingFee,
  totalAmount,
  shipping,
  items,
  buyerNote,
  printId = 'order-invoice',
}: OrderInvoiceProps) {
  function handlePrint() {
    window.print();
  }

  return (
    <section className="order-invoice" id={printId}>
      <div className="order-invoice__toolbar no-print">
        <h2 className="order-invoice__heading">Invoice</h2>
        <button type="button" className="order-invoice__print-btn" onClick={handlePrint}>
          Print invoice
        </button>
      </div>

      <div className="order-invoice__sheet">
        <header className="order-invoice__header">
          <div>
            <p className="order-invoice__brand">AIDR</p>
            <p className="order-invoice__doc-title">Sales invoice</p>
          </div>
          <div className="order-invoice__meta">
            <p>
              <span>Order</span>
              <strong>{orderCode}</strong>
            </p>
            <p>
              <span>Placed</span>
              <strong>{formatOrderDate(createdAt)}</strong>
            </p>
            {paidAt ? (
              <p>
                <span>Paid</span>
                <strong>{formatOrderDate(paidAt)}</strong>
              </p>
            ) : null}
          </div>
        </header>

        <div className="order-invoice__parties">
          <div>
            <h3>Shop</h3>
            <p className="order-invoice__party-name">{shopName}</p>
          </div>
          <div>
            <h3>Ship to</h3>
            <p className="order-invoice__party-name">{shipping.receiverName}</p>
            <p>{shipping.phone}</p>
            <p>{formatAddress(shipping)}</p>
          </div>
        </div>

        <table className="order-invoice__table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <td>
                  <span className="order-invoice__item-name">{item.productName}</span>
                  {item.variantName ? (
                    <span className="order-invoice__item-meta">{item.variantName}</span>
                  ) : null}
                  {item.sku ? <span className="order-invoice__item-meta">{item.sku}</span> : null}
                </td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitPrice, currency)}</td>
                <td>{formatMoney(item.lineTotal, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="order-invoice__totals">
          <p>
            <span>Subtotal</span>
            <span>{formatMoney(subtotalAmount, currency)}</span>
          </p>
          {discountAmount > 0 ? (
            <p className="order-invoice__discount">
              <span>Discount</span>
              <span>−{formatMoney(discountAmount, currency)}</span>
            </p>
          ) : null}
          <p>
            <span>Shipping</span>
            <span>{shippingFee > 0 ? formatMoney(shippingFee, currency) : 'Free'}</span>
          </p>
          <p className="order-invoice__grand">
            <span>Total</span>
            <span>{formatMoney(totalAmount, currency)}</span>
          </p>
        </div>

        {buyerNote ? (
          <p className="order-invoice__note">
            <strong>Note:</strong> {buyerNote}
          </p>
        ) : null}
      </div>
    </section>
  );
}
