import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminCategories } from '../../hooks/useAdminCategories';
import { useToast } from '../../hooks/useToast';
import type { AdminCategory } from '../../types/admin';

function parentName(categories: AdminCategory[], parentId?: number | null) {
  if (!parentId) return '—';
  return categories.find((c) => c.categoryId === parentId)?.name ?? `#${parentId}`;
}

export function AdminCategoryListPage() {
  const { categories, loading, error, setStatus, remove } = useAdminCategories();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.slug.toLowerCase().includes(term) ||
        (c.description ?? '').toLowerCase().includes(term),
    );
  }, [categories, q]);

  const stats = useMemo(() => {
    const active = categories.filter((c) => c.isActive).length;
    return {
      total: categories.length,
      active,
      inactive: categories.length - active,
      withProducts: categories.filter((c) => c.productCount > 0).length,
    };
  }, [categories]);

  async function handleToggle(category: AdminCategory) {
    setActionError(null);
    setBusyId(category.categoryId);
    try {
      const nextActive = !category.isActive;
      await setStatus(category.categoryId, nextActive);
      toast.success(nextActive ? 'Đã hiện danh mục.' : 'Đã ẩn danh mục.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không đổi được trạng thái.';
      setActionError(message);
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(category: AdminCategory) {
    const ok = window.confirm(
      `Xóa danh mục "${category.name}"? Chỉ xóa được khi không còn sản phẩm và danh mục con.`,
    );
    if (!ok) return;
    setActionError(null);
    setBusyId(category.categoryId);
    try {
      await remove(category.categoryId);
      toast.success('Đã xóa danh mục.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không xóa được danh mục.';
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
          <div className="card">
            <div className="card-body text-center">
              <h3 className="mb-1">{stats.total}</h3>
              <p className="text-muted mb-0">Tổng danh mục</p>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-3">
          <div className="card">
            <div className="card-body text-center">
              <h3 className="mb-1">{stats.active}</h3>
              <p className="text-muted mb-0">Đang hiện</p>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-3">
          <div className="card">
            <div className="card-body text-center">
              <h3 className="mb-1">{stats.inactive}</h3>
              <p className="text-muted mb-0">Đã ẩn</p>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-xl-3">
          <div className="card">
            <div className="card-body text-center">
              <h3 className="mb-1">{stats.withProducts}</h3>
              <p className="text-muted mb-0">Có sản phẩm</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center gap-1 flex-wrap">
              <h4 className="card-title flex-grow-1 mb-0">Tất cả danh mục</h4>
              <div className="d-flex align-items-center gap-2">
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Tìm tên / slug..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ minWidth: 200 }}
                />
                <Link to="/admin/categories/new" className="btn btn-sm btn-primary">
                  Thêm danh mục
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
                    <th>Danh mục</th>
                    <th>Slug</th>
                    <th>Danh mục cha</th>
                    <th>Thứ tự</th>
                    <th>Sản phẩm</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && categories.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        Đang tải...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        Chưa có danh mục.
                      </td>
                    </tr>
                  ) : null}
                  {filtered.map((category) => (
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
                          <p className="text-dark fw-medium fs-15 mb-0">{category.name}</p>
                        </div>
                      </td>
                      <td>
                        <code>{category.slug}</code>
                      </td>
                      <td>{parentName(categories, category.parentId)}</td>
                      <td>{category.sortOrder}</td>
                      <td>{category.productCount}</td>
                      <td>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={category.isActive}
                            disabled={busyId === category.categoryId}
                            onChange={() => void handleToggle(category)}
                            aria-label={category.isActive ? 'Ẩn danh mục' : 'Hiện danh mục'}
                          />
                          <label className="form-check-label">
                            {category.isActive ? 'Hiện' : 'Ẩn'}
                          </label>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            to={`/admin/categories/${category.categoryId}/edit`}
                            className="btn btn-soft-primary btn-sm"
                            title="Sửa"
                          >
                            <i className="bx bx-edit-alt align-middle fs-18" />
                          </Link>
                          <button
                            type="button"
                            className="btn btn-soft-danger btn-sm"
                            title="Xóa"
                            disabled={busyId === category.categoryId}
                            onClick={() => void handleDelete(category)}
                          >
                            <i className="bx bx-trash align-middle fs-18" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
