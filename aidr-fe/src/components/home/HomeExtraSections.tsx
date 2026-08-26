import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories } from '../../hooks/useCatalog';
import * as productApi from '../../services/productApi';
import * as reviewApi from '../../services/reviewApi';
import type { CategoryTreeNode, ProductListItem } from '../../types/catalog';
import { formatMoney } from '../../utils/formatCatalog';

const BEST_SELLING_IMAGES = [
  '/theme/images/best-selling-product-item-image-1.png',
  '/theme/images/best-selling-product-item-image-2.png',
  '/theme/images/best-selling-product-item-image-3.png',
  '/theme/images/best-selling-product-item-image-4.png',
];

const TRENDING_FALLBACK_IMAGES = [
  '/theme/images/trending-deal-highlighted-item-image-1.png',
  '/theme/images/trending-deal-highlighted-item-image-2.png',
  '/theme/images/trending-deal-highlighted-item-image-3.png',
  '/theme/images/trending-deal-item-image-1.png',
  '/theme/images/trending-deal-item-image-2.png',
  '/theme/images/trending-deal-item-image-3.png',
];

const FAQ_ITEMS = [
  {
    id: 'faq1',
    question: '01. Do your products come with a warranty?',
    answer:
      'Yes, we offer genuine electronic products with manufacturer warranty support according to each product listing.',
  },
  {
    id: 'faq2',
    question: '02. Do you sell genuine electronic products?',
    answer:
      'Yes, we offer only genuine electronic products sourced directly from trusted brands and authorized suppliers.',
  },
  {
    id: 'faq3',
    question: '03. Are new electronic products added regularly?',
    answer:
      'Our catalog is updated frequently with the latest smartphones, laptops, accessories, and smart devices.',
  },
  {
    id: 'faq4',
    question: '04. What payment methods do you accept?',
    answer:
      'We support secure online payment. Available methods are shown at checkout for each order.',
  },
];

const TICKER_ITEMS = [
  'Trusted Brand Collection',
  'Fast & Secure Delivery',
  'Premium Quality Electronics',
  'Safe Payment Options',
  'Expert Customer Support',
];

const AUTHOR_FALLBACKS = [
  '/theme/images/author-1.jpg',
  '/theme/images/author-2.jpg',
  '/theme/images/author-3.jpg',
];

type HomeTestimonial = {
  reviewId: string;
  text: string;
  name: string;
  role: string;
  image: string;
};

type TrendingBox = {
  boxClass: string;
  title: string;
  categoryId: number;
  highlighted: { title: string; image: string; to: string };
  items: { title: string; image: string; to: string }[];
};

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

function uniqueBrands(products: ProductListItem[]): string[] {
  const seen = new Set<string>();
  const brands: string[] = [];
  for (const product of products) {
    const brand = product.brand?.trim();
    if (!brand) continue;
    const key = brand.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    brands.push(brand);
  }
  return brands;
}

function buildTrendingBoxes(
  categories: CategoryTreeNode[],
  productsByCategory: Map<number, ProductListItem[]>,
): TrendingBox[] {
  const boxClasses = ['box-1', 'box-2', 'box-3'];
  const boxes: TrendingBox[] = [];

  for (const category of categories) {
    if (boxes.length >= 3) break;
    const pool = productsByCategory.get(category.categoryId) ?? [];
    if (pool.length === 0) continue;

    const index = boxes.length;
    const highlightedProduct = pool[0];
    const sideProducts = pool.slice(1, 3);
    const fallbackHi = TRENDING_FALLBACK_IMAGES[index % 3];

    boxes.push({
      boxClass: boxClasses[index],
      title: category.name,
      categoryId: category.categoryId,
      highlighted: {
        title: highlightedProduct.name,
        image: highlightedProduct.primaryImageUrl || category.imageUrl || fallbackHi,
        to: `/products/${highlightedProduct.productId}`,
      },
      items: sideProducts.map((product, itemIndex) => ({
        title: product.name,
        image:
          product.primaryImageUrl ||
          TRENDING_FALLBACK_IMAGES[3 + ((index * 2 + itemIndex) % 3)],
        to: `/products/${product.productId}`,
      })),
    });
  }

  return boxes;
}

function FaqAccordion() {
  const [openId, setOpenId] = useState('faq2');

  return (
    <div className="faq-accordion" id="accordion">
      {FAQ_ITEMS.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="accordion-item">
            <h2 className="accordion-header">
              <button
                type="button"
                className={`accordion-button${isOpen ? '' : ' collapsed'}`}
                onClick={() => setOpenId(isOpen ? '' : item.id)}
                aria-expanded={isOpen}
              >
                {item.question}
              </button>
            </h2>
            {isOpen && (
              <div className="accordion-collapse collapse show">
                <div className="accordion-body">
                  <p>{item.answer}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HomeExtraSections() {
  const { categories } = useCategories();
  const [popular, setPopular] = useState<ProductListItem[]>([]);
  const [topRated, setTopRated] = useState<ProductListItem[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<Map<number, ProductListItem[]>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [testimonials, setTestimonials] = useState<HomeTestimonial[]>([]);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const trendingCategoryIds = useMemo(
    () => flatCategories.slice(0, 6).map((c) => c.categoryId).join(','),
    [flatCategories],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const categoryIds = trendingCategoryIds
          ? trendingCategoryIds.split(',').map((id) => Number(id)).filter((id) => id > 0)
          : [];

        const [popularRes, ratedRes, ...categoryResults] = await Promise.all([
          productApi.listProducts({ sort: 'popular', page: 1, pageSize: 12 }),
          productApi.listProducts({ sort: 'rating', page: 1, pageSize: 8 }),
          ...categoryIds.map((categoryId) =>
            productApi.listProducts({
              categoryId,
              sort: 'popular',
              page: 1,
              pageSize: 3,
            }),
          ),
        ]);

        if (cancelled) return;

        const popularItems =
          popularRes.success && popularRes.data ? popularRes.data.items : [];
        const ratedItems = ratedRes.success && ratedRes.data ? ratedRes.data.items : [];
        setPopular(popularItems);
        setTopRated(ratedItems);

        const byCategory = new Map<number, ProductListItem[]>();
        categoryIds.forEach((categoryId, index) => {
          const res = categoryResults[index];
          const items = res?.success && res.data ? res.data.items : [];
          if (items.length > 0) byCategory.set(categoryId, items);
        });
        setProductsByCategory(byCategory);

        const reviewCandidates = [
          ...popularItems.filter((p) => p.reviewCount > 0),
          ...ratedItems.filter((p) => p.reviewCount > 0),
        ]
          .filter(
            (product, index, list) =>
              list.findIndex((p) => p.productId === product.productId) === index,
          )
          .slice(0, 5);

        const reviewResults = await Promise.all(
          reviewCandidates.map(async (product) => {
            try {
              const res = await reviewApi.getProductReviews(product.productId, {
                page: 1,
                pageSize: 3,
              });
              const review = res.success
                ? res.data?.items?.find(
                    (item) => Boolean(item.content?.trim() || item.title?.trim()),
                  )
                : undefined;
              if (!review) return null;
              const text = (review.content?.trim() || review.title?.trim()) ?? '';
              if (!text) return null;
              return {
                reviewId: review.reviewId,
                text,
                name: review.buyerName,
                role: `${product.name} · ${review.rating}/5`,
                image: review.buyerAvatarUrl || AUTHOR_FALLBACKS[0],
              } satisfies HomeTestimonial;
            } catch {
              return null;
            }
          }),
        );

        if (!cancelled) {
          setTestimonials(
            reviewResults
              .filter((item): item is HomeTestimonial => item != null)
              .slice(0, 3)
              .map((item, index) => ({
                ...item,
                image: item.image || AUTHOR_FALLBACKS[index % AUTHOR_FALLBACKS.length],
              })),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [trendingCategoryIds]);

  const offerA = popular[0];
  const offerB = popular[1];
  const bestSelling = popular.slice(0, 4);
  const brands = useMemo(
    () => uniqueBrands([...popular, ...topRated]).slice(0, 8),
    [popular, topRated],
  );
  const trendingBoxes = useMemo(
    () => buildTrendingBoxes(flatCategories, productsByCategory),
    [flatCategories, productsByCategory],
  );

  return (
    <>
      {(offerA || offerB || loading) && (
        <div className="upcoming-offer">
          <div className="container">
            {loading && !offerA && !offerB && <p>Loading offers…</p>}
            <div className="row">
              {offerA && (
                <div className="col-lg-6">
                  <div className="upcoming-offer-item dark-section">
                    <div className="upcoming-offer-item-body">
                      <div className="upcoming-offer-item-content-box">
                        <div className="section-title">
                          <span className="section-sub-title">Popular Pick</span>
                          <h2>{offerA.name}</h2>
                          <p>
                            {offerA.shortDescription ||
                              `${offerA.brand ?? offerA.categoryName} · ${offerA.shopName}`}
                          </p>
                        </div>
                        <div className="upcoming-offer-item-price">
                          <h3>
                            {formatMoney(offerA.effectivePrice, offerA.currency)}{' '}
                            {offerA.salePrice != null && offerA.salePrice < offerA.basePrice && (
                              <span>{formatMoney(offerA.basePrice, offerA.currency)}</span>
                            )}
                          </h3>
                        </div>
                      </div>
                      <div className="upcoming-offer-item-btn">
                        <Link
                          to={`/products/${offerA.productId}`}
                          className="btn-default btn-highlighted"
                        >
                          Shop Now
                        </Link>
                      </div>
                    </div>
                    <div className="upcoming-offer-image">
                      <figure>
                        <img
                          src={
                            offerA.primaryImageUrl ?? '/theme/images/upcoming-offer-image-1.png'
                          }
                          alt={offerA.name}
                        />
                      </figure>
                    </div>
                  </div>
                </div>
              )}

              {offerB && (
                <div className="col-lg-6">
                  <div className="upcoming-offer-item">
                    <div className="upcoming-offer-item-body">
                      <div className="upcoming-offer-item-content-box">
                        <div className="section-title">
                          <span className="section-sub-title">Best Seller</span>
                          <h2>{offerB.name}</h2>
                          <p>
                            {offerB.shortDescription ||
                              `${offerB.soldCount} sold · Rated ${offerB.avgRating.toFixed(1)}`}
                          </p>
                        </div>
                        <div className="upcoming-offer-item-countdown">
                          <div className="countdown">
                            <div className="counter-box">
                              <span>{formatMoney(offerB.effectivePrice, offerB.currency)}</span>
                              <p>Price</p>
                            </div>
                            <div className="counter-box">
                              <span>{offerB.soldCount}</span>
                              <p>Sold</p>
                            </div>
                            <div className="counter-box">
                              <span>{offerB.avgRating.toFixed(1)}</span>
                              <p>Rating</p>
                            </div>
                            <div className="counter-box">
                              <span>{offerB.reviewCount}</span>
                              <p>Reviews</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="upcoming-offer-item-btn">
                        <Link to={`/products/${offerB.productId}`} className="btn-default">
                          Shop Now
                        </Link>
                      </div>
                    </div>
                    <div className="upcoming-offer-image">
                      <figure>
                        <img
                          src={
                            offerB.primaryImageUrl ?? '/theme/images/upcoming-offer-image-2.png'
                          }
                          alt={offerB.name}
                        />
                      </figure>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="intro-video dark-section">
        <div className="container-fluid">
          <div className="row">
            <div className="col-lg-12">
              <div className="intro-video-box">
                <div className="intro-bg-video">
                  <video autoPlay muted playsInline loop id="introvideo">
                    <source
                      src="https://demo.awaikenthemes.com/assets/videos/AIDR-intro-video.mp4"
                      type="video/mp4"
                    />
                  </video>
                </div>
                <div className="video-play-button">
                  <a
                    href="https://www.youtube.com/watch?v=Y-x0efG1seA"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Play video"
                  >
                    <span className="bg-effect">
                      <i className="fa-solid fa-play" />
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="our-scrolling-ticker">
          <div className="scrolling-ticker-box">
            {[0, 1].map((copy) => (
              <div key={copy} className="scrolling-content">
                {TICKER_ITEMS.map((item) => (
                  <span key={`${copy}-${item}`}>
                    <img src="/theme/images/icon-asterisk-white.svg" alt="" />
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {(bestSelling.length > 0 || loading) && (
        <div className="best-selling-products">
          <div className="container">
            <div className="row section-row align-items-center">
              <div className="col-xl-8">
                <div className="section-title">
                  <span className="section-sub-title">Best Selling</span>
                  <h2 className="text-anime-style-3">Explore Customer Favorite Products</h2>
                </div>
              </div>
              <div className="col-xl-4">
                <div className="section-btn">
                  <Link to="/products?sort=popular" className="btn-default">
                    Shop Now
                  </Link>
                </div>
              </div>
            </div>

            {loading && bestSelling.length === 0 && <p>Loading best sellers…</p>}

            <div className="row">
              <div className="col-lg-12">
                <div className="best-selling-product-item-list">
                  {bestSelling.map((item, index) => (
                    <div
                      key={item.productId}
                      className={`best-selling-product-item${index === 3 ? ' highlighted-box' : ''}`}
                    >
                      <div className="best-selling-product-item-header">
                        <div className="best-selling-product-item-content">
                          <h3>
                            <Link to={`/products/${item.productId}`}>{item.name}</Link>
                          </h3>
                          <p>
                            {item.shortDescription ||
                              `${item.brand ?? item.categoryName} · ${item.soldCount} sold`}
                          </p>
                        </div>
                        <div className="best-selling-product-item-price">
                          <h3>
                            <span>Starting at:</span>
                            {formatMoney(item.effectivePrice, item.currency)}
                          </h3>
                        </div>
                      </div>
                      <div className="best-selling-product-item-image">
                        <figure>
                          <Link to={`/products/${item.productId}`}>
                            <img
                              src={
                                item.primaryImageUrl ??
                                BEST_SELLING_IMAGES[index % BEST_SELLING_IMAGES.length]
                              }
                              alt={item.name}
                            />
                          </Link>
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

      {brands.length > 0 && (
        <div className="our-brands">
          <div className="container">
            <div className="row section-row">
              <div className="col-xl-12">
                <div className="section-title section-title-center">
                  <span className="section-sub-title">Our Brands</span>
                  <h2 className="text-anime-style-3">Explore Popular Brand Collections</h2>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-lg-12">
                <div className="our-brand-list">
                  <ul>
                    {brands.map((brand) => (
                      <li key={brand}>
                        <Link to={`/products?brand=${encodeURIComponent(brand)}`}>{brand}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="our-process light-section">
        <div className="container">
          <div className="row section-row">
            <div className="col-xl-12">
              <div className="section-title section-title-center">
                <span className="section-sub-title">Our Process</span>
                <h2 className="text-anime-style-3">Simple Process for Smart Shopping</h2>
                <p>
                  Enjoy a smooth and secure shopping experience with simple steps designed to help you
                  discover, order, and receive your favorite electronics quickly.
                </p>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-12">
              <div className="process-item-list">
                {[
                  {
                    icon: 1,
                    title: 'Explore Products',
                    text: 'Browse the latest electronic gadgets and innovative devices.',
                    to: '/products',
                  },
                  {
                    icon: 2,
                    title: 'Choose Your Favorites',
                    text: 'Compare specifications, features and prices to select the perfect device.',
                    to: '/categories',
                  },
                  {
                    icon: 3,
                    title: 'Secure Checkout',
                    text: 'Complete your order safely with multiple payment options.',
                    to: '/cart',
                  },
                  {
                    icon: 4,
                    title: 'Fast Delivery',
                    text: 'Receive your order quickly with reliable shipping partners.',
                    to: '/products',
                  },
                ].map((step) => (
                  <div key={step.icon} className="process-item">
                    <div className="icon-box">
                      <img src={`/theme/images/icon-our-process-item-${step.icon}.svg`} alt="" />
                    </div>
                    <div className="process-item-content">
                      <h3>
                        <Link to={step.to}>{step.title}</Link>
                      </h3>
                      <p>{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {trendingBoxes.length > 0 && (
        <div className="trending-deals">
          <div className="container">
            <div className="row section-row align-items-center">
              <div className="col-xl-8">
                <div className="section-title">
                  <span className="section-sub-title">Trending Deal</span>
                  <h2 className="text-anime-style-3">Latest Gadget Deals & Offers</h2>
                </div>
              </div>
              <div className="col-xl-4">
                <div className="section-btn">
                  <Link to="/products" className="btn-default">
                    Shop Now
                  </Link>
                </div>
              </div>
            </div>

            <div className="row">
              {trendingBoxes.map((box) => (
                <div key={box.categoryId} className="col-xl-4 col-md-6">
                  <div className={`trending-deal-box ${box.boxClass}`}>
                    <div className="trending-deal-box-title">
                      <h3>
                        <Link to={`/products?categoryId=${box.categoryId}`}>{box.title}</Link>
                      </h3>
                    </div>
                    <div className="trending-deal-item-list">
                      <div className="trending-deal-item highlighted-item">
                        <div className="trending-deal-item-title">
                          <h3>
                            <Link to={box.highlighted.to}>{box.highlighted.title}</Link>
                          </h3>
                        </div>
                        <div className="trending-deal-item-image">
                          <figure>
                            <Link to={box.highlighted.to}>
                              <img src={box.highlighted.image} alt={box.highlighted.title} />
                            </Link>
                          </figure>
                        </div>
                      </div>
                      {box.items.map((item) => (
                        <div key={item.to} className="trending-deal-item">
                          <div className="trending-deal-item-image">
                            <figure>
                              <Link to={item.to}>
                                <img src={item.image} alt={item.title} />
                              </Link>
                            </figure>
                          </div>
                          <div className="trending-deal-item-title">
                            <h3>
                              <Link to={item.to}>{item.title}</Link>
                            </h3>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {testimonials.length > 0 && (
        <div className="our-testimonials light-section">
          <div className="container">
            <div className="row section-row align-items-center">
              <div className="col-xl-8">
                <div className="section-title">
                  <span className="section-sub-title">Testimonial</span>
                  <h2 className="text-anime-style-3">Trusted by Happy Customers</h2>
                </div>
              </div>
              <div className="col-xl-4">
                <div className="section-btn">
                  <Link to="/products?sort=rating" className="btn-default">
                    See Top Rated
                  </Link>
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-12">
                <div className="testimonial-slider">
                  <div className="catalog-testimonial-track">
                    {testimonials.map((item) => (
                      <div key={item.reviewId} className="testimonial-item catalog-testimonial-slide">
                        <div className="testimonial-item-header">
                          <div className="testimonial-item-quote">
                            <img src="/theme/images/testimonial-item-quote.svg" alt="" />
                          </div>
                          <div className="testimonial-item-content">
                            <p>{item.text}</p>
                          </div>
                        </div>
                        <div className="testimonial-item-author">
                          <div className="testimonial-author-image">
                            <figure>
                              <img src={item.image} alt="" />
                            </figure>
                          </div>
                          <div className="testimonial-author-content">
                            <h2>{item.name}</h2>
                            <p>{item.role}</p>
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
      )}

      <div className="our-faqs">
        <div className="container">
          <div className="row section-row align-items-center">
            <div className="col-xl-8">
              <div className="section-title">
                <span className="section-sub-title">FAQ&apos;s</span>
                <h2 className="text-anime-style-3">Helpful Answers for Our Customers</h2>
              </div>
            </div>
            <div className="col-xl-4">
              <div className="section-btn">
                <Link to="/products" className="btn-default">
                  Browse Products
                </Link>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-5">
              <div className="faqs-image-box">
                <div className="faqs-image">
                  <figure>
                    <img src="/theme/images/faqs-image.jpg" alt="" />
                  </figure>
                </div>
                {offerA && (
                  <div className="faqs-countdown-box">
                    <div className="faqs-countdown-content">
                      <p>{offerA.categoryName}</p>
                      <h3>{offerA.name}</h3>
                    </div>
                    <div className="faqs-countdown-body">
                      <div className="countdown">
                        <div className="counter-box">
                          <span>{formatMoney(offerA.effectivePrice, offerA.currency)}</span>
                          <p>Price</p>
                        </div>
                        <div className="counter-box">
                          <span>{offerA.soldCount}</span>
                          <p>Sold</p>
                        </div>
                        <div className="counter-box">
                          <span>{offerA.avgRating.toFixed(1)}</span>
                          <p>Rating</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="col-lg-7">
              <FaqAccordion />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
