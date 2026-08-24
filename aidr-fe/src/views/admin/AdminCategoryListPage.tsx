import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPagination, AdminStatCard } from '../../components/admin/AdminStatCard';
import { IconifyIcon } from '../../components/admin/IconifyIcon';
import { useAdminCategories } from '../../hooks/useAdminCategories';
import { useToast } from '../../hooks/useToast';
import type { AdminCategory } from '../../types/admin';
import { adminBadgeClass, categoryVisibilityBadgeClass } from '../../utils/adminBadge';
import { formatCategorySortOrder } from '../../utils/categorySortUi';

const PAGE_SIZE = 10;

function ParentCell({ category }: { category: AdminCategory }) {
  if (!category.parentId) {
    return <span className={adminBadgeClass.solidLight}>Root</span>;
  }
  return (
    <span className={adminBadgeClass.outlinePrimary}>
      {category.parentName ?? `#${category.parentId}`}
    </span>
  );
}

export function AdminCategoryListPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const { categories, loading, error, summary, totalCount, page: serverPage, setStatus, remove, reload } =
    useAdminCategories({ q: debouncedQ, page, pageSize: PAGE_SIZE });

  useEffect(() => {
    if (serverPage !== page) setPage(serverPage);
  }, [serverPage, page]);

  async function handleToggle(category: AdminCategory) {
    setActionError(null);
    setBusyId(category.categoryId);
    try {
      const nextActive = !category.isActive;
      await setStatus(category.categoryId, nextActive);
      await reload({ q: debouncedQ, page, pageSize: PAGE_SIZE });
      toast.success(nextActive ? 'Category is now visible.' : 'Category is now hidden.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update status.';
      setActionError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(category: AdminCategory) {
    const ok = window.confirm(
      `Delete category "${category.name}"? You can delete it only when it has no products and no child categories.`,
    );
    if (!ok) return;
    setActionError(null);
    setBusyId(category.categoryId);
    try {
      await remove(category.categoryId);
      await reload({ q: debouncedQ, page, pageSize: PAGE_SIZE });
      toast.success('Category deleted.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete category.';
      setActionError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="row">
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Total Categories"
            value={summary.totalCount}
            unit="Categories"
            icon="solar:widget-2-bold-duotone"
            tone="primary"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Visible"
            value={summary.activeCount}
            unit="Active"
            icon="solar:eye-bold-duotone"
            tone="success"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="Hidden"
            value={summary.inactiveCount}
            unit="Hidden"
            icon="solar:eye-closed-bold-duotone"
            tone="warning"
          />
        </div>
        <div className="col-md-6 col-xl-3">
          <AdminStatCard
            title="With Products"
            value={summary.withProductsCount}
            unit="Mapped"
            icon="solar:box-bold-duotone"
            tone="info"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h4 className="card-title mb-0">All Categories</h4>
              <div className="d-flex flex-nowrap align-items-center gap-2">
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search name / slug..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ width: 220, flex: '0 0 auto' }}
                />
                <Link
                  to="/admin/categories/new"
                  className="btn btn-sm btn-primary text-nowrap"
                  style={{ flex: '0 0 auto' }}
                >
                  Add Category
                </Link>
              </div>
            </div>

            {(error || actionError) && (
              <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                {actionError || error}
              </div>
            )}

            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover table-centered">
                <thead className="bg-light-subtle">
                  <tr>
                    <th>Category</th>
                    <th>Slug</th>
                    <th>Parent</th>
                    <th>Display order</th>
                    <th>Products</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && categories.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && categories.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        No categories yet.
                      </td>
                    </tr>
                  ) : null}
                  {categories.map((category) => (
                    <tr key={category.categoryId}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="rounded bg-light avatar-md d-flex align-items-center justify-content-center overflow-hidden">
                            {category.imageUrl ? (
                              <img src={category.imageUrl} alt="" className="avatar-md" />
                            ) : (
                              <i className="bx bx-category fs-24 text-muted" />
                            )}
                          </div>
                          <div>
                            <p className="text-dark fw-medium fs-15 mb-0">{category.name}</p>
                            {category.parentId ? (
                              <p className="text-muted mb-0 fs-12">Child category</p>
                            ) : (
                              <p className="text-muted mb-0 fs-12">Root category</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={adminBadgeClass.solidLight}>{category.slug}</span>
                      </td>
                      <td>
                        <ParentCell category={category} />
                      </td>
                      <td>
                        <span
                          className={
                            category.sortOrder === 0
                              ? adminBadgeClass.solidLight
                              : adminBadgeClass.outlineSecondary
                          }
                        >
                          {formatCategorySortOrder(category.sortOrder)}
                        </span>
                      </td>
                      <td>{category.productCount}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className={categoryVisibilityBadgeClass(category.isActive)}>
                            {category.isActive ? 'Visible' : 'Hidden'}
                          </span>
                          <div className="form-check form-switch mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              checked={category.isActive}
                              disabled={busyId === category.categoryId}
                              onChange={() => void handleToggle(category)}
                              aria-label={category.isActive ? 'Hide category' : 'Show category'}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            to={`/admin/categories/${category.categoryId}/edit`}
                            className="btn btn-soft-primary btn-sm"
                            title="Edit"
                          >
                            <IconifyIcon icon="solar:pen-2-broken" className="align-middle fs-18" />
                          </Link>
                          <button
                            type="button"
                            className="btn btn-soft-danger btn-sm"
                            title="Delete"
                            disabled={busyId === category.categoryId}
                            onClick={() => void handleDelete(category)}
                          >
                            <IconifyIcon
                              icon="solar:trash-bin-minimalistic-2-broken"
                              className="align-middle fs-18"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
