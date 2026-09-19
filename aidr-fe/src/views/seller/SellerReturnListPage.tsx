import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useSellerReturns } from '../../hooks/useSellerReturns';
import { formatMoney } from '../../utils/formatCatalog';
import { parseUtcDate } from '../../utils/dateUtc';
import {
  formatResolutionType,
  formatReturnStatus,
  returnStatusBadgeClass,
  SELLER_RETURN_STATUS_FILTERS,
} from '../../utils/returnUi';

const PAGE_SIZE = 10;

function formatDate(value: string) {
  const date = parseUtcDate(value);
  if (!date) return value;
  return date.toLocaleString();
}

export function SellerReturnListPage() {
  const [status, setStatus] = useState('Approved');
  const [page, setPage] = useState(1);
  const { list, loading, error } = useSellerReturns({
    status: status || null,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = list?.items ?? [];
  const totalCount = list?.totalCount ?? 0;
  const summary = {
    approvedCount: list?.approvedCount ?? 0,
    sellerConfirmedCount: list?.sellerConfirmedCount ?? 0,
    receivingCount: list?.receivingCount ?? 0,
    acceptedCount: list?.acceptedCount ?? 0,
  };

  useEffect(() => {
    if (list && list.page !== page && list.totalPages > 0) {
      setPage(list.page);
    }
  }, [list, page]);

  const viewTotal =
    status === 'Approved'
      ? summary.approvedCount
      : status === 'SellerConfirmed'
        ? summary.sellerConfirmedCount
        : status === 'Receiving'
          ? summary.receivingCount
          : status === 'Accepted'
            ? summary.acceptedCount
            : totalCount;

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="In This View"
            value={viewTotal}
            unit="Requests"
            icon="solar:clipboard-list-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Needs confirmation"
            value={summary.approvedCount}
            unit="Queue"
            icon="solar:hourglass-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Receiving"
            value={summary.receivingCount}
            unit="In transit"
            icon="solar:box-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Accepted"
            value={summary.acceptedCount}
            unit="Ready for admin"
            icon="solar:check-circle-bold-duotone"
            tone="success"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">All Return Items</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <AdminSelect
                  id="seller-return-status"
                  size="sm"
                  block={false}
                  menuAlign="end"
                  value={status}
                  options={SELLER_RETURN_STATUS_FILTERS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  onChange={(next) => {
                    setStatus(next);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            {error ? (
              <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                {error}
              </div>
            ) : null}

            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover table-centered">
                <thead className="bg-light-subtle">
                  <tr>
                    <th>Order</th>
                    <th>Order By</th>
                    <th>Resolution</th>
                    <th>Return Date</th>
                    <th>Total</th>
                    <th>Return Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : null}

                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        No return requests found.
                      </td>
                    </tr>
                  ) : null}

                  {items.map((row) => (
                    <tr key={row.returnRequestId}>
                      <td>
                        <Link
                          to={`/seller/returns/${row.returnRequestId}`}
                          className="fw-medium link-primary"
                        >
                          {row.orderCode}
                        </Link>
                        <div className="text-muted fs-12 text-truncate" style={{ maxWidth: 220 }}>
                          {row.reason}
                        </div>
                      </td>
                      <td>
                        <div className="fw-medium">{row.buyerFullName}</div>
                        <div className="text-muted fs-12">{row.buyerEmail}</div>
                      </td>
                      <td>{formatResolutionType(row.resolutionType)}</td>
                      <td>{formatDate(row.createdAt)}</td>
                      <td>{formatMoney(row.orderTotalAmount, 'VND')}</td>
                      <td>
                        <span className={returnStatusBadgeClass(row.status)}>
                          {formatReturnStatus(row.status)}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/seller/returns/${row.returnRequestId}`}
                          className="btn btn-soft-primary btn-sm"
                          title="View"
                        >
                          <IconifyIcon
                            icon="solar:eye-bold-duotone"
                            className="align-middle fs-18"
                          />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-footer border-top">
              <AdminPagination
                page={page}
                pageSize={PAGE_SIZE}
                total={totalCount}
                onPageChange={setPage}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
