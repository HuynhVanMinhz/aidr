import { useCallback, useEffect, useState } from 'react';
import { AdminStatCard } from '../../components/admin/AdminStatCard';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
import {
  approvePayoutBatch,
  cancelPayoutBatch,
  createPayoutBatch,
  executePayoutBatch,
  getAdminBankAccounts,
  getAdminPayoutBatches,
  getEligibleShops,
  getPlatformCommissionReport,
  markPayoutBatchPaid,
  runSettlementSweep,
  verifyShopBankAccount,
} from '../../services/settlementApi';
import type {
  AdminShopBankAccount,
  PayoutBatch,
  PlatformCommissionReport,
  SettlementEligibleShop,
} from '../../types/settlement';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatOrderDate } from '../../utils/orderUi';
import { bankStatusBadgeClass, payoutBatchBadgeClass } from '../../utils/sellerFinanceUi';
import { formatVnd } from '../../utils/sellerProductUi';

export function AdminSettlementsPage() {
  const toast = useToast();
  const [eligible, setEligible] = useState<SettlementEligibleShop[]>([]);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [bankAccounts, setBankAccounts] = useState<AdminShopBankAccount[]>([]);
  const [report, setReport] = useState<PlatformCommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useToastMessage(error);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eligibleRes, batchRes, reportRes, bankRes] = await Promise.all([
        getEligibleShops(),
        getAdminPayoutBatches({ page: 1, pageSize: 20 }),
        getPlatformCommissionReport(),
        getAdminBankAccounts(),
      ]);
      setEligible(eligibleRes.data ?? []);
      setBatches(batchRes.data?.items ?? []);
      setReport(reportRes.data ?? null);
      setBankAccounts(bankRes.data ?? []);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load settlements.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run<T>(key: string, action: () => Promise<T>, successMessage: string) {
    setBusyId(key);
    try {
      await action();
      toast.success(successMessage);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The settlement action failed.'));
    } finally {
      setBusyId(null);
    }
  }

  function handlePayout(shop: SettlementEligibleShop) {
    // Money leaving the platform is not undoable - make the amount and the
    // destination impossible to miss.
    const confirmed = window.confirm(
      `Pay ${formatVnd(shop.netAmount)} to ${shop.shopName}?\n\n` +
        `Account: ${shop.accountName} · ${shop.accountNumberMasked}\n` +
        `${shop.entryCount} orders · platform fee ${formatVnd(shop.commissionAmount)}`,
    );
    if (!confirmed) return;

    void run(
      shop.shopId,
      async () => {
        const draft = await createPayoutBatch(shop.shopId);
        const batchId = draft.data?.payoutBatchId;
        if (batchId) await approvePayoutBatch(batchId);
      },
      `Payout approved for ${shop.shopName}.`,
    );
  }

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="GMV settled"
            value={loading && !report ? '…' : formatVnd(report?.gmv ?? 0)}
            unit="last 30 days"
            icon="solar:chart-square-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Platform commission"
            value={loading && !report ? '…' : formatVnd(report?.commission ?? 0)}
            unit={report ? `${(report.commissionRate * 100).toFixed(1)}%` : undefined}
            icon="solar:wallet-money-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Held in escrow"
            value={loading && !report ? '…' : formatVnd(report?.escrowHeld ?? 0)}
            icon="solar:safe-square-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Awaiting transfer"
            value={loading && !report ? '…' : formatVnd(report?.awaitingPayout ?? 0)}
            icon="solar:card-transfer-bold-duotone"
            tone="info"
          />
        </div>
      </div>

      <div className="card">
        <div className="card-body border-bottom d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <div>
            <h4 className="card-title mb-1">Ready to pay out</h4>
            <p className="text-muted fs-13 mb-0">
              Shops whose hold window has ended. Approving releases the money and starts the transfer.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-soft-secondary"
            disabled={busyId === 'sweep'}
            onClick={() =>
              void run('sweep', runSettlementSweep, 'Settlement sweep finished.')
            }
          >
            Run sweep now
          </button>
        </div>

        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="bg-light-subtle">
              <tr>
                <th>Shop</th>
                <th>Bank account</th>
                <th className="text-end">Orders</th>
                <th className="text-end">Gross</th>
                <th className="text-end">Fee</th>
                <th className="text-end">Net payout</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && eligible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted">
                    Loading…
                  </td>
                </tr>
              ) : eligible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted">
                    Nothing is due for payout right now - settlements appear here once their hold
                    window ends. {formatVnd(report?.escrowHeld ?? 0)} is still in escrow.
                  </td>
                </tr>
              ) : (
                eligible.map((shop) => (
                  <tr key={shop.shopId}>
                    <td className="fw-medium">{shop.shopName}</td>
                    <td>
                      {shop.accountNumberMasked ? (
                        <>
                          <p className="mb-0 fs-14">{shop.accountName}</p>
                          <p className="text-muted fs-13 mb-1">
                            {shop.bankName ? `${shop.bankName} · ` : ''}
                            {shop.accountNumberMasked}
                          </p>
                        </>
                      ) : null}
                      <span className={bankStatusBadgeClass(shop.bankStatus)}>{shop.bankStatus}</span>
                      {shop.bankStatus === 'Unverified' ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-0 ms-2"
                          disabled={busyId === shop.shopId}
                          onClick={() =>
                            void run(
                              shop.shopId,
                              () => verifyShopBankAccount(shop.shopId, true),
                              'Bank account verified.',
                            )
                          }
                        >
                          Verify
                        </button>
                      ) : null}
                    </td>
                    <td className="text-end">{shop.entryCount}</td>
                    <td className="text-end">{formatVnd(shop.grossAmount)}</td>
                    <td className="text-end text-success">{formatVnd(shop.commissionAmount)}</td>
                    <td className="text-end fw-semibold">{formatVnd(shop.netAmount)}</td>
                    <td className="text-end">
                      {shop.canPayout ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={busyId === shop.shopId}
                          onClick={() => handlePayout(shop)}
                        >
                          {busyId === shop.shopId ? 'Working…' : 'Approve & pay'}
                        </button>
                      ) : (
                        <span className="text-muted fs-13">
                          {shop.blockers[0] ?? 'Not payable yet'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-body border-bottom">
          <h4 className="card-title mb-1">Payout batches</h4>
          <p className="text-muted fs-13 mb-0">Every transfer, with its payOS state.</p>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="bg-light-subtle">
              <tr>
                <th>Batch</th>
                <th>Shop</th>
                <th className="text-end">Net</th>
                <th>Status</th>
                <th>Approved</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    No payout batches yet. One is created when you approve a shop above.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.payoutBatchId}>
                    <td className="fw-medium">{batch.batchCode}</td>
                    <td>{batch.shopName}</td>
                    <td className="text-end fw-semibold">{formatVnd(batch.netAmount)}</td>
                    <td>
                      <span className={payoutBatchBadgeClass(batch.status)}>{batch.status}</span>
                      {batch.failureReason ? (
                        <p className="text-danger fs-12 mb-0 mt-1">{batch.failureReason}</p>
                      ) : null}
                    </td>
                    <td className="text-muted fs-13">
                      {batch.approvedAt ? formatOrderDate(batch.approvedAt) : 'Awaiting approval'}
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        {batch.status === 'Draft' ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={busyId === batch.payoutBatchId}
                            onClick={() =>
                              void run(
                                batch.payoutBatchId,
                                () => approvePayoutBatch(batch.payoutBatchId),
                                'Batch approved.',
                              )
                            }
                          >
                            Approve
                          </button>
                        ) : null}
                        {batch.status === 'Approved' || batch.status === 'Failed' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-soft-primary"
                              disabled={busyId === batch.payoutBatchId}
                              onClick={() =>
                                void run(
                                  batch.payoutBatchId,
                                  () => executePayoutBatch(batch.payoutBatchId),
                                  'Payout submitted.',
                                )
                              }
                            >
                              {batch.status === 'Failed' ? 'Retry' : 'Send'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-soft-secondary"
                              disabled={busyId === batch.payoutBatchId}
                              onClick={() =>
                                void run(
                                  batch.payoutBatchId,
                                  () =>
                                    markPayoutBatchPaid(
                                      batch.payoutBatchId,
                                      window.prompt('Bank reference (optional)') ?? undefined,
                                    ),
                                  'Batch marked as paid.',
                                )
                              }
                            >
                              Mark paid
                            </button>
                          </>
                        ) : null}
                        {batch.status === 'Draft' || batch.status === 'Failed' ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-soft-danger"
                            disabled={busyId === batch.payoutBatchId}
                            onClick={() =>
                              void run(
                                batch.payoutBatchId,
                                () => cancelPayoutBatch(batch.payoutBatchId),
                                'Batch cancelled.',
                              )
                            }
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-body border-bottom">
          <h4 className="card-title mb-1">Seller bank accounts</h4>
          <p className="text-muted fs-13 mb-0">
            Verify before the shop's money is due so payouts can run automatically.
          </p>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="bg-light-subtle">
              <tr>
                <th>Shop</th>
                <th>Bank</th>
                <th>Account</th>
                <th>Holder</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && bankAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">Loading…</td>
                </tr>
              ) : bankAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">No bank accounts registered yet.</td>
                </tr>
              ) : (
                bankAccounts.map((ba) => (
                  <tr key={ba.shopBankAccountId}>
                    <td className="fw-medium">{ba.shopName}</td>
                    <td>{ba.bankName}</td>
                    <td className="font-monospace fs-13">{ba.accountNumberMasked}</td>
                    <td>{ba.accountName}</td>
                    <td>
                      <span className={bankStatusBadgeClass(ba.status)}>{ba.status}</span>
                      {ba.rejectReason ? (
                        <p className="text-danger fs-12 mb-0 mt-1">{ba.rejectReason}</p>
                      ) : null}
                    </td>
                    <td className="text-end">
                      {ba.status !== 'Verified' ? (
                        <div className="d-inline-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-success"
                            disabled={busyId === ba.shopId}
                            onClick={() =>
                              void run(
                                ba.shopId,
                                () => verifyShopBankAccount(ba.shopId, true),
                                'Bank account verified.',
                              )
                            }
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-soft-danger"
                            disabled={busyId === ba.shopId}
                            onClick={() => {
                              const reason = window.prompt('Rejection reason:');
                              if (!reason) return;
                              void run(
                                ba.shopId,
                                () => verifyShopBankAccount(ba.shopId, false, reason),
                                'Bank account rejected.',
                              );
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted fs-13">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
