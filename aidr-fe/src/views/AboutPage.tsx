import { Link } from 'react-router-dom';
import { SupportCta } from '../components/support/SupportCta';
import { SupportPageLayout } from '../components/support/SupportPageLayout';

export function AboutPage() {
  return (
    <div className="about-page">
      <SupportPageLayout
        title="About Us"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'About Us' },
        ]}
      >
        <p className="support-page__intro">
          AIDR is an AI-integrated digital retail platform connecting buyers with trusted sellers
          of genuine electronics - transparent pricing, secure checkout, and smart shopping tools.
        </p>
      </SupportPageLayout>

      <div className="about-us light-section">
        <div className="container">
          <div className="row">
            <div className="col-xl-6 col-lg-5">
              <div className="about-us-image">
                <figure>
                  <img src="/theme/images/faqs-image.jpg" alt="AIDR electronics marketplace" />
                </figure>
              </div>
            </div>

            <div className="col-xl-6 col-lg-7">
              <div className="about-us-content">
                <div className="section-title">
                  <span className="section-sub-title">About Us</span>
                  <h2>Your trusted destination for smart electronics</h2>
                  <p>
                    We are dedicated to providing premium electronics, innovative gadgets, and smart
                    technology solutions designed to enhance modern lifestyles - backed by verified
                    sellers and a seamless buying experience.
                  </p>
                </div>

                <div className="about-us-item-list">
                  <div className="about-us-item">
                    <div className="about-us-item-header">
                      <div className="icon-box">
                        <img src="/theme/images/icon-about-us-item-1.svg" alt="" />
                      </div>
                      <div className="about-us-item-title">
                        <h3>Our mission</h3>
                      </div>
                    </div>
                    <div className="about-us-item-content">
                      <p>
                        Make modern technology accessible, reliable, and affordable by offering
                        genuine electronics and smart devices that enhance everyday life - with
                        clear policies and responsive support.
                      </p>
                    </div>
                  </div>

                  <div className="about-us-item">
                    <div className="about-us-item-header">
                      <div className="icon-box">
                        <img src="/theme/images/icon-about-us-item-2.svg" alt="" />
                      </div>
                      <div className="about-us-item-title">
                        <h3>Our vision</h3>
                      </div>
                    </div>
                    <div className="about-us-item-content">
                      <p>
                        Become a leading destination for innovative electronics by building a trusted
                        marketplace where customers discover the latest advancements in digital
                        living - powered by AI-assisted shopping.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="about-values light-section">
        <div className="container about-values__inner">
          <div className="row">
            <div className="col-lg-12">
              <h2 className="support-page__section-title">What we stand for</h2>
              <div className="about-values__grid">
                <article className="about-values__card">
                  <h3>Genuine products</h3>
                  <p>
                    Every listing goes through moderation so buyers receive authentic devices from
                    verified sellers.
                  </p>
                </article>
                <article className="about-values__card">
                  <h3>Secure commerce</h3>
                  <p>
                    Protected checkout, order snapshots, and clear return policies keep every
                    transaction transparent.
                  </p>
                </article>
                <article className="about-values__card">
                  <h3>AI-powered discovery</h3>
                  <p>
                    Our shopping assistant helps you compare options, find deals, and get answers
                    without leaving the store.
                  </p>
                </article>
              </div>

              <div className="about-shop-cta">
                <Link to="/products" className="btn-default">
                  Start shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="about-cta-wrap light-section">
        <div className="container">
          <SupportCta />
        </div>
      </div>
    </div>
  );
}
