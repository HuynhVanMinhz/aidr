import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as productApi from '../../services/productApi';
import type { ProductListItem } from '../../types/catalog';
import { formatMoney } from '../../utils/formatCatalog';

const BEST_SELLING_IMAGES = [
  '/theme/images/best-selling-product-item-image-1.png',
  '/theme/images/best-selling-product-item-image-2.png',
  '/theme/images/best-selling-product-item-image-3.png',
  '/theme/images/best-selling-product-item-image-4.png',
];

const TRENDING_BOXES = [
  {
    boxClass: 'box-1',
    title: 'Top Rated',
    highlighted: { title: 'Exclusive Offers', image: '/theme/images/trending-deal-highlighted-item-image-1.png', to: '/products?sort=rating' },
    items: [
      { title: 'Earbuds', image: '/theme/images/trending-deal-item-image-1.png', to: '/products?categoryId=3' },
      { title: 'Speaker', image: '/theme/images/trending-deal-item-image-2.png', to: '/products?categoryId=3' },
    ],
  },
  {
    boxClass: 'box-2',
    title: 'High-End Picks',
    highlighted: { title: 'Tracking Fitness', image: '/theme/images/trending-deal-highlighted-item-image-2.png', to: '/products?sort=popular' },
    items: [
      { title: 'HealthPulse', image: '/theme/images/trending-deal-item-image-3.png', to: '/products?categoryId=3' },
      { title: 'Fitness Watch', image: '/theme/images/trending-deal-item-image-4.png', to: '/products?categoryId=3' },
    ],
  },
  {
    boxClass: 'box-3',
    title: 'Smartphones',
    highlighted: { title: 'Mobile Essentials', image: '/theme/images/trending-deal-highlighted-item-image-3.png', to: '/products?categoryId=1' },
    items: [
      { title: 'Air Fryer', image: '/theme/images/trending-deal-item-image-5.png', to: '/products' },
      { title: 'Coffee Maker', image: '/theme/images/trending-deal-item-image-6.png', to: '/products' },
    ],
  },
];

const TESTIMONIALS = [
  {
    text: 'This store offers an amazing collection of high-quality products at very reasonable prices. Customer support was extremely helpful, delivery was quick.',
    name: 'Harper Anderson',
    role: 'Art Director',
    image: '/theme/images/author-1.jpg',
  },
  {
    text: 'Great selection of electronics and fast shipping. The product descriptions are accurate and checkout was smooth.',
    name: 'Mason Cooper',
    role: 'Product Designer',
    image: '/theme/images/author-2.jpg',
  },
  {
    text: 'I found exactly what I needed at a competitive price. Packaging was secure and the device works perfectly.',
    name: 'Olivia Bennett',
    role: 'Tech Enthusiast',
    image: '/theme/images/author-3.jpg',
  },
];

const FAQ_ITEMS = [
  {
    id: 'faq1',
    question: '01. Do your products come with a warranty?',
    answer:
      'Yes, we offer genuine electronic products with manufacturer warranty support according to each product listing.',
    open: false,
  },
  {
    id: 'faq2',
    question: '02. Do you sell genuine electronic products?',
    answer:
      'Yes, we offer only genuine electronic products sourced directly from trusted brands and authorized suppliers.',
    open: true,
  },
  {
    id: 'faq3',
    question: '03. Are new electronic products added regularly?',
    answer:
      'Our catalog is updated frequently with the latest smartphones, laptops, accessories, and smart devices.',
    open: false,
  },
  {
    id: 'faq4',
    question: '04. What payment methods do you accept?',
    answer:
      'We support secure online payment methods and will expand options as checkout modules are rolled out.',
    open: false,
  },
];

const BLOG_POSTS = [
  {
    title: 'Top 10 Smart Home Gadgets You Need in 2026',
    image: '/theme/images/post-1.jpg',
    date: 'Aug 12, 2026',
  },
  {
    title: 'How to Choose the Right Laptop for Work & Gaming',
    image: '/theme/images/post-2.jpg',
    date: 'Aug 08, 2026',
  },
  {
    title: 'Wireless Audio Guide: Headphones vs Earbuds',
    image: '/theme/images/post-3.jpg',
    date: 'Aug 03, 2026',
  },
];

const BRAND_IMAGES = Array.from({ length: 8 }, (_, i) => `/theme/images/our-brands-image-${i + 1}.svg`);

const TICKER_ITEMS = [
  'Trusted Brand Collection',
  'Fast & Secure Delivery',
  'Premium Quality Electronics',
  'Safe Payment Options',
  'Expert Customer Support',
];

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
  const [popular, setPopular] = useState<ProductListItem[]>([]);

  useEffect(() => {
    void productApi.listProducts({ sort: 'popular', page: 1, pageSize: 4 }).then((res) => {
      if (res.success && res.data) setPopular(res.data.items);
    });
  }, []);

  const offerA = popular[0];
  const offerB = popular[1];

  return (
    <>
      <div className="upcoming-offer">
        <div className="container">
          <div className="row">
            <div className="col-lg-6">
              <div className="upcoming-offer-item dark-section">
                <div className="upcoming-offer-item-body">
                  <div className="upcoming-offer-item-content-box">
                    <div className="section-title">
                      <span className="section-sub-title">5 Years Warranty</span>
                      <h2>{offerA?.name ?? 'Swift book laptop built to perform'}</h2>
                      <p>{offerA?.shortDescription ?? 'Enjoy a smooth and secure shopping experience'}</p>
                    </div>
                    <div className="upcoming-offer-item-price">
                      <h3>
                        {offerA
                          ? formatMoney(offerA.effectivePrice, offerA.currency)
                          : '$35.00'}{' '}
                        {offerA?.salePrice != null && offerA.salePrice < offerA.basePrice && (
                          <span>{formatMoney(offerA.basePrice, offerA.currency)}</span>
                        )}
                      </h3>
                    </div>
                  </div>
                  <div className="upcoming-offer-item-btn">
                    <Link
                      to={offerA ? `/products/${offerA.productId}` : '/products'}
                      className="btn-default btn-highlighted"
                    >
                      Shop Now
                    </Link>
                  </div>
                </div>
                <div className="upcoming-offer-image">
                  <figure>
                    <img
                      src={offerA?.primaryImageUrl ?? '/theme/images/upcoming-offer-image-1.png'}
                      alt=""
                    />
                  </figure>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="upcoming-offer-item">
                <div className="upcoming-offer-item-body">
                  <div className="upcoming-offer-item-content-box">
                    <div className="section-title">
                      <span className="section-sub-title">Best Seller</span>
                      <h2>{offerB?.name ?? 'Sounds LX is here, hear the hype'}</h2>
                      <p>{offerB?.shortDescription ?? 'Enjoy a smooth and secure shopping experience'}</p>
                    </div>
                    <div className="upcoming-offer-item-countdown">
                      <div className="countdown">
                        <div className="counter-box"><span>12</span> <p>Days</p></div>
                        <div className="counter-box"><span>08</span> <p>Hrs</p></div>
                        <div className="counter-box"><span>45</span> <p>Min</p></div>
                        <div className="counter-box"><span>30</span> <p>Sec</p></div>
                      </div>
                    </div>
                  </div>
                  <div className="upcoming-offer-item-btn">
                    <Link
                      to={offerB ? `/products/${offerB.productId}` : '/products?sort=popular'}
                      className="btn-default"
                    >
                      Shop Now
                    </Link>
                  </div>
                </div>
                <div className="upcoming-offer-image">
                  <figure>
                    <img
                      src={offerB?.primaryImageUrl ?? '/theme/images/upcoming-offer-image-2.png'}
                      alt=""
                    />
                  </figure>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

          <div className="row">
            <div className="col-lg-12">
              <div className="best-selling-product-item-list">
                {(popular.length > 0 ? popular : [null, null, null, null]).map((item, index) => (
                  <div
                    key={item?.productId ?? index}
                    className={`best-selling-product-item${index === 3 ? ' highlighted-box' : ''}`}
                  >
                    <div className="best-selling-product-item-header">
                      <div className="best-selling-product-item-content">
                        <h3>
                          {item ? (
                            <Link to={`/products/${item.productId}`}>{item.name}</Link>
                          ) : (
                            'Smart Phone'
                          )}
                        </h3>
                        <p>{item?.shortDescription ?? 'Powerful performance, advanced technology.'}</p>
                      </div>
                      <div className="best-selling-product-item-price">
                        <h3>
                          <span>Starting at:</span>
                          {item
                            ? formatMoney(item.effectivePrice, item.currency)
                            : '$35.99'}
                        </h3>
                      </div>
                    </div>
                    <div className="best-selling-product-item-image">
                      <figure>
                        <Link to={item ? `/products/${item.productId}` : '/products?sort=popular'}>
                          <img
                            src={
                              item?.primaryImageUrl ??
                              BEST_SELLING_IMAGES[index % BEST_SELLING_IMAGES.length]
                            }
                            alt=""
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
                  {BRAND_IMAGES.map((src) => (
                    <li key={src}>
                      <Link to="/products">
                        <img src={src} alt="" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  { icon: 1, title: 'Explore Products', text: 'Browse the latest electronic gadgets and innovative devices.', to: '/products' },
                  { icon: 2, title: 'Choose Your Favorites', text: 'Compare specifications, features and prices to select the perfect device.', to: '/categories' },
                  { icon: 3, title: 'Secure Checkout', text: 'Complete your order safely with multiple payment options.', to: '/login' },
                  { icon: 4, title: 'Fast Delivery', text: 'Receive your order quickly with reliable shipping partners.', to: '/products' },
                ].map((step) => (
                  <div key={step.icon} className="process-item">
                    <div className="icon-box">
                      <img src={`/theme/images/icon-our-process-item-${step.icon}.svg`} alt="" />
                    </div>
                    <div className="process-item-content">
                      <h3><Link to={step.to}>{step.title}</Link></h3>
                      <p>{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

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
            {TRENDING_BOXES.map((box) => (
              <div key={box.boxClass} className="col-xl-4 col-md-6">
                <div className={`trending-deal-box ${box.boxClass}`}>
                  <div className="trending-deal-box-title">
                    <h3><Link to="/products">{box.title}</Link></h3>
                  </div>
                  <div className="trending-deal-item-list">
                    <div className="trending-deal-item highlighted-item">
                      <div className="trending-deal-item-title">
                        <h3><Link to={box.highlighted.to}>{box.highlighted.title}</Link></h3>
                      </div>
                      <div className="trending-deal-item-image">
                        <figure>
                          <img src={box.highlighted.image} alt="" />
                        </figure>
                      </div>
                    </div>
                    {box.items.map((item) => (
                      <div key={item.title} className="trending-deal-item">
                        <div className="trending-deal-item-image">
                          <figure>
                            <img src={item.image} alt="" />
                          </figure>
                        </div>
                        <div className="trending-deal-item-title">
                          <h3><Link to={item.to}>{item.title}</Link></h3>
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
                <Link to="/products" className="btn-default">
                  See All Reviews
                </Link>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-12">
              <div className="testimonial-slider">
                <div className="catalog-testimonial-track">
                  {TESTIMONIALS.map((item) => (
                    <div key={item.name} className="testimonial-item catalog-testimonial-slide">
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
                <Link to="/login" className="btn-default">
                  See All Question
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
                <div className="faqs-countdown-box">
                  <div className="faqs-countdown-content">
                    <p>Up To 20% Discount</p>
                    <h3>Limited Time Electronics Sale</h3>
                  </div>
                  <div className="faqs-countdown-body">
                    <div className="countdown">
                      <div className="counter-box"><span>12</span> <p>Days</p></div>
                      <div className="counter-box"><span>08</span> <p>Hours</p></div>
                      <div className="counter-box"><span>45</span> <p>Minutes</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-7">
              <FaqAccordion />
            </div>
          </div>
        </div>
      </div>

      <div className="our-blog">
        <div className="container">
          <div className="row section-row align-items-center">
            <div className="col-xl-8">
              <div className="section-title">
                <span className="section-sub-title">Our Blog</span>
                <h2 className="text-anime-style-3">Latest News & Articles</h2>
              </div>
            </div>
            <div className="col-xl-4">
              <div className="section-btn">
                <Link to="/products" className="btn-default">
                  View All Post
                </Link>
              </div>
            </div>
          </div>

          <div className="row">
            {BLOG_POSTS.map((post) => (
              <div key={post.title} className="col-lg-4 col-md-6">
                <div className="post-item">
                  <div className="post-featured-image">
                    <Link to="/products">
                      <figure>
                        <img src={post.image} alt="" />
                      </figure>
                    </Link>
                  </div>
                  <div className="post-item-body">
                    <div className="post-item-meta">
                      <ul>
                        <li>{post.date}</li>
                      </ul>
                    </div>
                    <div className="post-item-content">
                      <h2>
                        <Link to="/products">{post.title}</Link>
                      </h2>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
