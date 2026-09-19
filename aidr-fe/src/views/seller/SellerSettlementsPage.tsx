import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { useToast } from '../../hooks/useToast';
import { useToastMessage } from '../../hooks/useToastMessage';
import {
  getSellerBankAccount,
  getSellerPayouts,
  getSellerSettlementSummary,
  getSellerSettlements,
  upsertSellerBankAccount,
} from '../../services/settlementApi';
import type {
  PayoutBatch,
  SettlementEntry,
  SettlementSummary,
  ShopBankAccount,
} from '../../types/settlement';
import { BankSelect, type BankOption } from '../../components/seller/BankSelect';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatOrderDate } from '../../utils/orderUi';
import {
  bankStatusBadgeClass,
  formatSettlementStatus,
  payoutBatchBadgeClass,
  SETTLEMENT_STATUS_FILTERS,
  settlementStatusBadgeClass,
} from '../../utils/sellerFinanceUi';
import { formatVnd } from '../../utils/sellerProductUi';

const PAGE_SIZE = 20;

/** Never show a bare dash: every settlement state has something useful to say. */
function releaseLabel(entry: SettlementEntry): string {
  switch (entry.status) {
    case 'Paid':
      // Entries settled before the escrow flow existed have no batch.
      return entry.batchCode ? `Paid · ${entry.batchCode}` : 'Paid out earlier';
    case 'Approved':
      return entry.batchCode ? `Transferring · ${entry.batchCode}` : 'Transferring';
    case 'Reversed':
      return 'Returned - not paid';
    case 'OnHold':
      return 'Paused until the dispute closes';
    case 'Eligible':
      return 'Ready - waiting for admin approval';
    case 'Holding':
    default:
      return entry.daysUntilRelease > 0
        ? `In ${entry.daysUntilRelease} day${entry.daysUntilRelease === 1 ? '' : 's'}`
        : 'Ready - waiting for admin approval';
  }
}

export function SellerSettlementsPage() {
  const toast = useToast();

  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [bank, setBank] = useState<ShopBankAccount | null>(null);
  const [entries, setEntries] = useState<SettlementEntry[]>([]);
  const [payouts, setPayouts] = useState<PayoutBatch[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ accountNumber: '', accountName: '' });
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingBank, setEditingBank] = useState(false);

  useToastMessage(error);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, bankRes, entriesRes, payoutRes] = await Promise.all([
        getSellerSettlementSummary(),
        getSellerBankAccount(),
        getSellerSettlements({ status: status || null, page, pageSize: PAGE_SIZE }),
        getSellerPayouts({ page: 1, pageSize: 5 }),
      ]);

      setSummary(summaryRes.data ?? null);
      setBank(bankRes.data ?? null);
      setEntries(entriesRes.data?.items ?? []);
      setTotalCount(entriesRes.data?.totalCount ?? 0);
      setPayouts(payoutRes.data?.items ?? []);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load settlements.'));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!bank) return;
    setForm({ accountNumber: '', accountName: bank.accountName });
    if (bank.bankBin && bank.bankName) {
      setSelectedBank({ bin: bank.bankBin, name: bank.bankName, shortName: bank.bankName, logo: '' });
    } else if (bank.bankName) {
      setSelectedBank({ bin: '', name: bank.bankName, shortName: bank.bankName, logo: '' });
    }
  }, [bank]);

  async function handleSaveBank(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!selectedBank) {
        toast.error('Please select a bank.');
        setSaving(false);
        return;
      }
      const result = await upsertSellerBankAccount({
        bankBin: selectedBank.bin || null,
        bankName: selectedBank.shortName,
        accountNumber: form.accountNumber.trim(),
        accountName: form.accountName.trim(),
      });
      setBank(result.data ?? null);
      setEditingBank(false);
      toast.success('Bank account saved. An admin needs to verify it before payouts run.');
      void load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to save the bank account.'));
    } finally {
      setSaving(false);
    }
  }

  const needsBank = !bank || bank.status !== 'Verified';

  return (
    <>
      {/*
        A persistent blocker, not a transient notification - it stays until the
        seller fixes it, so it belongs on the page rather than in a toast.
      */}
      {needsBank ? (
        <div className="alert alert-warning" role="alert">
          <strong>Payouts are on hold.</strong>{' '}
          {bank
            ? bank.status === 'Rejected'
              ? `Your bank account was rejected: ${bank.rejectReason ?? 'no reason given'}.`
              : 'Your bank account is waiting for admin verification.'
            : 'Add a bank account to receive your settlements.'}{' '}
          Your money is still held safely and will be released once this is sorted.
        </div>
      ) : null}

      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Holding"
            value={loading && !summary ? '…' : formatVnd(summary?.holdingAmount ?? 0)}
            unit={summary ? `${summary.holdingCount} orders` : undefined}
            icon="solar:clock-circle-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Ready to pay out"
            value={loading && !summary ? '…' : formatVnd(summary?.eligibleAmount ?? 0)}
            unit={summary ? `${summary.eligibleCount} orders` : undefined}
            icon="solar:hand-money-bold-duotone"
            tone="info"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Approved, transferring"
            value={loading && !summary ? '…' : formatVnd(summary?.approvedAmount ?? 0)}
            unit={summary ? `${summary.approvedCount} orders` : undefined}
            icon="solar:card-transfer-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Paid out"
            value={loading && !summary ? '…' : formatVnd(summary?.paidAmount ?? 0)}
            unit={summary ? `fee ${formatVnd(summary.commissionPaid)}` : undefined}
            icon="solar:wallet-money-bold-duotone"
            tone="success"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-4">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                <div>
                  <h4 className="card-title mb-1">Payout bank account</h4>
                  <p className="text-muted fs-13 mb-0">Where your settlements are transferred.</p>
                </div>
                {bank ? <span className={bankStatusBadgeClass(bank.status)}>{bank.status}</span> : null}
              </div>

              {bank && !editingBank ? (
                <>
                  <dl className="row mb-3 fs-14">
                    <dt className="col-5 text-muted fw-normal">Bank</dt>
                    <dd className="col-7 mb-1">{bank.bankName}</dd>
                    <dt className="col-5 text-muted fw-normal">Account</dt>
                    <dd className="col-7 mb-1">{bank.accountNumberMasked}</dd>
                    <dt className="col-5 text-muted fw-normal">Holder</dt>
                    <dd className="col-7 mb-0">{bank.accountName}</dd>
                  </dl>
                  <button
                    type="button"
                    className="btn btn-sm btn-soft-primary"
                    onClick={() => setEditingBank(true)}
                  >
                    Change account
                  </button>
                </>
              ) : (
                <form onSubmit={(e) => void handleSaveBank(e)}>
                  <div className="mb-2">
                    <label className="form-label fs-13" htmlFor="bank-select">
                      Bank *
                    </label>
                    <BankSelect
                      id="bank-select"
                      value={selectedBank}
                      onChange={setSelectedBank}
                      disabled={saving}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label fs-13" htmlFor="bank-account">
                      Account number *
                    </label>
                    <input
                      id="bank-account"
                      className="form-control"
                      value={form.accountNumber}
                      inputMode="numeric"
                      onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fs-13" htmlFor="bank-holder">
                      Account holder *
                    </label>
                    <input
                      id="bank-holder"
                      className="form-control"
                      value={form.accountName}
                      onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                      required
                    />
                    <p className="text-muted fs-12 mb-0 mt-1">
                      Must match the name on the bank account or the transfer will fail.
                    </p>
                  </div>
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save account'}
                    </button>
                    {bank ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-soft-secondary"
                        onClick={() => setEditingBank(false)}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h4 className="card-title mb-3">Recent payouts</h4>
              {payouts.length === 0 ? (
                <p className="text-muted mb-0">No payouts yet.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {payouts.map((p) => (
                    <li
                      key={p.payoutBatchId}
                      className="d-flex align-items-center justify-content-between gap-2 py-2 border-bottom"
                    >
                      <div className="min-w-0">
                        <p className="mb-0 fw-medium text-truncate">{p.batchCode}</p>
                        <p className="text-muted fs-13 mb-0">
                          {p.entryCount} orders · {formatOrderDate(p.createdAt)}
                        </p>
                      </div>
                      <div className="text-end flex-shrink-0">
                        <p className="mb-0 fw-semibold">{formatVnd(p.netAmount)}</p>
                        <span className={payoutBatchBadgeClass(p.status)}>{p.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card">
            <div className="card-body border-bottom">
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <div>
                  <h4 className="card-title mb-1">Settlements by order</h4>
                  <p className="text-muted fs-13 mb-0">
                    Money is released {summary?.nextReleaseAt ? '30 days after' : 'a month after'} the
                    buyer receives the order, once an admin approves the payout.
                  </p>
                </div>
                <AdminSelect
                  value={status}
                  onChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                  options={SETTLEMENT_STATUS_FILTERS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="bg-light-subtle">
                  <tr>
                    <th>Order</th>
                    <th className="text-end">Gross</th>
                    <th className="text-end">Platform fee</th>
                    <th className="text-end">You receive</th>
                    <th>Status</th>
                    <th>Release</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted">
                        Loading settlements…
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted">
                        No settlements yet. They appear once an order is completed.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.settlementEntryId}>
                        <td className="fw-medium">{entry.orderCode}</td>
                        <td className="text-end">{formatVnd(entry.grossAmount)}</td>
                        <td
                          className={`text-end${entry.commissionAmount > 0 ? ' text-danger' : ' text-muted'}`}
                          title={
                            entry.commissionAmount > 0
                              ? `${(entry.commissionRate * 100).toFixed(1)}% platform fee`
                              : 'No platform fee on this order'
                          }
                        >
                          {entry.commissionAmount > 0
                            ? `−${formatVnd(entry.commissionAmount)}`
                            : 'No fee'}
                        </td>
                        <td className="text-end fw-semibold">
                          {formatVnd(entry.netAmount)}
                          {entry.subsidyAmount > 0 && (
                            <p
                              className="text-success fs-12 mb-0 mt-1"
                              title="Platform voucher — the platform absorbed this discount"
                            >
                              +{formatVnd(entry.subsidyAmount)} subsidy
                            </p>
                          )}
                        </td>
                        <td>
                          <span className={settlementStatusBadgeClass(entry.status)}>
                            {formatSettlementStatus(entry.status)}
                          </span>
                          {entry.holdReason ? (
                            <p className="text-muted fs-12 mb-0 mt-1">{entry.holdReason}</p>
                          ) : null}
                        </td>
                        <td className="text-muted fs-13">{releaseLabel(entry)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <AdminPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={totalCount}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>
    </>
  );
}
