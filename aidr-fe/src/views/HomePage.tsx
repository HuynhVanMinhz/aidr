import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/catalog/ProductCard';
import { HomeExtraSections } from '../components/home/HomeExtraSections';
import { useCategories } from '../hooks/useCatalog';
import {
  defaultCatalogFilters,
  fetchProducts,
  selectCatalogListError,
  selectCatalogListLoading,
  selectCatalogProducts,
} from '../store/catalogSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

const CATEGORY_IMAGES = [
  '/theme/images/category-item-image-1.png',
  '/theme/images/category-item-image-2.png',
  '/theme/images/category-item-image-3.png',
  '/theme/images/category-item-image-4.png',
  '/theme/images/category-item-image-5.png',
  '/theme/images/category-item-image-6.png',
];

const PROMO_BANNERS = [
  {
    title: 'Essential Smart Appliances',
    image: '/theme/images/essential-appliances-item-image-1.png',
    to: '/products?sort=popular',
  },
  {
    title: 'Smart Business Gadgets',
    image: '/theme/images/essential-appliances-item-image-2.png',
    to: '/products?categoryId=2',
  },
  {
    title: 'Premium Audio Collection',
    image: '/theme/images/essential-appliances-item-image-3.png',
    to: '/products?categoryId=3',
  },
];

export function HomePage() {
  const dispatch = useAppDispatch();
  const products = useAppSelector(selectCatalogProducts);
  const loading = useAppSelector(selectCatalogListLoading);
  const error = useAppSelector(selectCatalogListError);
  const { categories, loading: categoriesLoading } = useCategories();

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

      <div className="essential-appliances">
        <div className="container-fluid">
          <div className="row no-gutters">
            <div className="col-lg-12">
              <div className="essential-appliances-item-list">
                {PROMO_BANNERS.map((banner) => (
                  <div key={banner.title} className="essential-appliances-item">
                    <div className="essential-appliances-item-body">
                      <div className="essential-appliances-item-content-box">
                        <div className="essential-appliances-item-tags">
                          <ul>
                            <li>Home Tech</li>
                            <li>Digital Home</li>
                          </ul>
                        </div>
                        <div className="essential-appliances-item-content">
                          <span>Up To 20% Discount</span>
                          <h2>{banner.title}</h2>
                        </div>
                      </div>
                      <div className="essential-appliances-item-btn">
                        <Link to={banner.to} className="btn-default btn-border">
                          Shop Now
                        </Link>
                      </div>
                    </div>
                    <div className="essential-appliances-item-image">
                      <figure>
                        <img src={banner.image} alt="" />
                      </figure>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

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
                {categoriesLoading && <p>Đang tải danh mục…</p>}
                <div className="category-slider-track">
                  {(categories.length > 0 ? categories : []).slice(0, 6).map((cat, index) => (
                    <div key={cat.categoryId} className="category-slider-slide">
                      <div className="category-item">
                        <div className="category-item-image">
                          <Link to={`/products?categoryId=${cat.categoryId}`}>
                            <figure>
                              <img
                                src={cat.imageUrl || CATEGORY_IMAGES[index % CATEGORY_IMAGES.length]}
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

          {loading && <p>Đang tải sản phẩm…</p>}
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
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

      <HomeExtraSections />
    </>
  );
}
