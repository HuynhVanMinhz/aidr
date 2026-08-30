import { Link } from 'react-router-dom';
import { CatalogBreadcrumb } from '../../components/catalog/CatalogBreadcrumb';
import { useCategories } from '../../hooks/useCatalog';
import { useToastMessage } from '../../hooks/useToastMessage';
import type { CategoryTreeNode } from '../../types/catalog';
import { resolveCategoryImageUrl } from '../../utils/catalogImage';

function CategoryCard({ node, index }: { node: CategoryTreeNode; index: number }) {
  const image = resolveCategoryImageUrl(node.imageUrl, index);

  return (
    <div className="col-lg-4 col-md-6">
      <div className="category-item catalog-category-card">
        <div className="category-item-image">
          <Link to={`/products?categoryId=${node.categoryId}`}>
            <figure>
              <img src={image} alt={node.name} />
            </figure>
          </Link>
        </div>
        <div className="category-item-content">
          <h3>
            <Link to={`/products?categoryId=${node.categoryId}`}>{node.name}</Link>
          </h3>
          {node.description && <p className="catalog-category-desc">{node.description}</p>}
        </div>
        {node.children?.length > 0 && (
          <ul className="catalog-category-children">
            {node.children.map((child) => (
              <li key={child.categoryId}>
                <Link to={`/products?categoryId=${child.categoryId}`}>{child.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const { categories, loading, error } = useCategories();
  useToastMessage(error);

  return (
    <>
      <div className="page-header light-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="page-header-box">
                <h1>Product Categories</h1>
                <CatalogBreadcrumb
                  items={[
                    { label: 'Home', to: '/' },
                    { label: 'Categories' },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="our-category catalog-categories-section">
        <div className="container">
          {loading && <p>Loading categories…</p>}
          {!loading && categories.length === 0 && (
            <p className="text-muted">No active categories yet.</p>
          )}

          <div className="row">
            {categories.map((node, index) => (
              <CategoryCard key={node.categoryId} node={node} index={index} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
