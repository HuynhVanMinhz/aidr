import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/catalog/ProductCard';
import { RecommendedProductsSection } from '../components/catalog/RecommendedProductsSection';
import { HomeExtraSections } from '../components/home/HomeExtraSections';
import { useCategories } from '../hooks/useCatalog';
import { useToastMessage } from '../hooks/useToastMessage';
import {
  defaultCatalogFilters,
  fetchProducts,
  selectCatalogListError,
  selectCatalogListLoading,
  selectCatalogProducts,
} from '../store/catalogSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { CategoryTreeNode } from '../types/catalog';
import { resolveCategoryImageUrl } from '../utils/catalogImage';

function flattenCategories(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const out: CategoryTreeNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) {
      out.push(...flattenCategories(node.children));
    }
  }
  return out;
}

export function HomePage() {
  const dispatch = useAppDispatch();
  const products = useAppSelector(selectCatalogProducts);
  const loading = useAppSelector(selectCatalogListLoading);
  const error = useAppSelector(selectCatalogListError);
  const { categories, loading: categoriesLoading } = useCategories();
  useToastMessage(error);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const promoCategories = flatCategories.slice(0, 3);
  const sliderCategories = (flatCategories.length > 0 ? flatCategories : categories).slice(0, 6);

  useEffect(() => {
    void dispatch(
      fetchProducts({
        ...defaultCatalogFilters,
        page: 1,
        pageSize: 6,
        sort: 'newest',
      }),
    );
  }, [dispatch]);

  return (
    <>
      <div className="hero light-section">
        <div className="container">
          <div className="row">
            <div className="col-xl-6 col-lg-7">
              <div className="hero-content">
                <div className="section-title">
                  <span className="section-sub-title">Premium Tech</span>
                  <h1 className="text-anime-style-3">Smart Devices Built For Smarter Living</h1>
                  <p>
                    Upgrade your home, work, and entertainment experience with premium gadgets, smart
                    devices, and the latest technology at unbeatable prices.
                  </p>
                </div>
                <div className="hero-btn">
                  <Link to="/products" className="btn-default">
                    Shop Now
                  </Link>
                </div>
              </div>
            </div>
            <div className="col-xl-6 col-lg-5">
              <div className="hero-image">
                <figure>
                  <img src="/theme/images/hero-image.png" alt="" />
                </figure>
              </div>
            </div>
          </div>
        </div>
      </div>

      {promoCategories.length > 0 && (
        <div className="essential-appliances">
          <div className="container-fluid">
            <div className="row no-gutters">
              <div className="col-lg-12">
                <div className="essential-appliances-item-list">
                  {promoCategories.map((cat, index) => (
                    <div key={cat.categoryId} className="essential-appliances-item">
                      <div className="essential-appliances-item-body">
                        <div className="essential-appliances-item-content-box">
                          <div className="essential-appliances-item-tags">
                            <ul>
                              <li>{cat.name}</li>
                              {cat.children?.[0] && <li>{cat.children[0].name}</li>}
                            </ul>
                          </div>
                          <div className="essential-appliances-item-content">
                            <span>Shop by category</span>
                            <h2>{cat.name}</h2>
                          </div>
                        </div>
                        <div className="essential-appliances-item-btn">
                          <Link
                            to={`/products?categoryId=${cat.categoryId}`}
                            className="btn-default btn-border"
                          >
                            Shop Now
                          </Link>
                        </div>
                      </div>
                      <div className="essential-appliances-item-image">
                        <figure>
                          <img
                            src={resolveCategoryImageUrl(cat.imageUrl, index)}
                            alt={cat.name}
                          />
                        </figure>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="our-category">
        <div className="container">
          <div className="row section-row">
            <div className="col-md-9">
              <div className="section-title">
                <span className="section-sub-title">Our category</span>
                <h2 className="text-anime-style-3">Premium Gadget Series</h2>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-12">
              <div className="category-slider">
                {categoriesLoading && <p>Loading categories…</p>}
                {!categoriesLoading && sliderCategories.length === 0 && (
                  <p className="text-muted">No categories available yet.</p>
                )}
                <div className="category-slider-track">
                  {sliderCategories.map((cat, index) => (
                    <div key={cat.categoryId} className="category-slider-slide">
                      <div className="category-item">
                        <div className="category-item-image">
                          <Link to={`/products?categoryId=${cat.categoryId}`}>
                            <figure>
                              <img
                                src={resolveCategoryImageUrl(cat.imageUrl, index)}
                                alt={cat.name}
                              />
                            </figure>
                          </Link>
                        </div>
                        <div className="category-item-content">
                          <h3>
                            <Link to={`/products?categoryId=${cat.categoryId}`}>{cat.name}</Link>
                          </h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="our-products">
        <div className="container">
          <div className="row section-row align-items-center">
            <div className="col-xl-7">
              <div className="section-title">
                <span className="section-sub-title">Our Product</span>
                <h2 className="text-anime-style-3">Browse Our wide Product Range</h2>
              </div>
            </div>
            <div className="col-xl-5">
              <div className="section-btn">
                <Link to="/products" className="btn-default">
                  Shop Now
                </Link>
              </div>
            </div>
          </div>

          {loading && <p>Loading products…</p>}
          {!loading && products.length === 0 && (
            <p className="text-muted">No products available yet.</p>
          )}

          <div className="row">
            <div className="col-lg-12">
              <div className="product-item-list">
                {products.map((product) => (
                  <ProductCard key={product.productId} product={product} variant="home" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <RecommendedProductsSection pageSize={6} />

      <HomeExtraSections />
    </>
  );
}
