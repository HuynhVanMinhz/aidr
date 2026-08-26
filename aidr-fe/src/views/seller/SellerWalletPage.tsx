import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { useSellerWallet } from '../../hooks/useSellerFinance';
import { formatOrderDate } from '../../utils/orderUi';
import {
  formatWalletTxType,
  SELLER_WALLET_TX_FILTERS,
  walletTxTypeBadgeClass,
} from '../../utils/sellerFinanceUi';
import { formatVnd } from '../../utils/sellerProductUi';

const PAGE_SIZE = 20;

export function SellerWalletPage() {
  const [txType, setTxType] = useState('');
  const [page, setPage] = useState(1);
  const { wallet, loading, error } = useSellerWallet({
    txType: txType || null,
    page,
    pageSize: PAGE_SIZE,
  });

  const transactions = wallet?.transactions ?? [];

  useEffect(() => {
    if (wallet && wallet.page !== page && wallet.totalPages > 0) {
      setPage(wallet.page);
    }
  }, [wallet, page]);

  return (
    <>
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="row">
        <div className="col-md-6 col-xl-4">
          <AdminStatCard
            title="Available balance"
            value={loading && !wallet ? '…' : formatVnd(wallet?.availableBalance ?? 0)}
            icon="solar:wallet-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-4">
          <AdminStatCard
            title="Pending settlement"
            value={loading && !wallet ? '…' : formatVnd(wallet?.pendingBalance ?? 0)}
            icon="solar:clock-circle-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-4">
          <AdminStatCard
            title="Ledger entries"
            value={loading && !wallet ? '…' : (wallet?.totalCount ?? 0)}
            unit="Transactions"
            icon="solar:document-text-bold-duotone"
            tone="primary"
          />
        </div>
      </div>

      <div className="card">
        <div className="d-flex card-header justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h4 className="card-title mb-0">Wallet ledger</h4>
            {wallet?.updatedAt ? (
              <p className="text-muted mb-0 fs-13">
                Last updated {formatOrderDate(wallet.updatedAt)}
              </p>
            ) : null}
          </div>
          <div className="d-flex align-items-center gap-2">
            <AdminSelect
              id="wallet-tx-type"
              size="sm"
              block={false}
              value={txType}
              options={SELLER_WALLET_TX_FILTERS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
              onChange={(next) => {
                setTxType(next);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0 table-hover table-centered">
              <thead className="bg-light-subtle">
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance after</th>
                  <th>Reference</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      Loading wallet…
                    </td>
                  </tr>
                ) : null}
                {!loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No transactions
                      {txType ? ` for “${formatWalletTxType(txType)}”` : ''} yet.
                    </td>
                  </tr>
                ) : null}
                {transactions.map((tx) => (
                  <tr key={tx.walletTxId}>
                    <td>{formatOrderDate(tx.createdAt)}</td>
                    <td>
                      <span className={walletTxTypeBadgeClass(tx.txType)}>
                        {formatWalletTxType(tx.txType)}
                      </span>
                    </td>
                    <td className={tx.amount >= 0 ? 'text-success' : 'text-danger'}>
                      {formatVnd(tx.amount)}
                    </td>
                    <td>{formatVnd(tx.balanceAfter)}</td>
                    <td>
                      {tx.referenceType === 'Order' && tx.referenceId ? (
                        <Link
                          to={`/seller/orders/${tx.referenceId}`}
                          className="link-primary"
                        >
                          Order
                        </Link>
                      ) : (
                        <span className={!tx.referenceType ? 'text-muted' : undefined}>
                          {tx.referenceType || 'No reference'}
                        </span>
                      )}
                    </td>
                    <td className="text-truncate" style={{ maxWidth: 220 }}>
                      <span className={!tx.note ? 'text-muted' : undefined}>
                        {tx.note?.trim() || 'No note'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {wallet ? (
            <AdminPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={wallet.totalCount}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h5 className="card-title">About balances</h5>
          <p className="text-muted mb-0">
            <strong>Available balance</strong> reflects credits and debits already posted to your
            wallet when buyers confirm received orders or refunds are processed.{' '}
            <strong>Pending settlement</strong> is the total of paid orders still in fulfillment
            (not yet completed). Funds move to available balance when the buyer confirms receipt.
          </p>
        </div>
      </div>
    </>
  );
}
