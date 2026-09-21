import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FaqAccordion } from '../components/support/FaqAccordion';
import { FaqCategoryFilter } from '../components/support/FaqCategoryFilter';
import { SupportCta } from '../components/support/SupportCta';
import { SupportPageLayout } from '../components/support/SupportPageLayout';
import { SupportSearch } from '../components/support/SupportSearch';
import {
  FAQ_ITEMS,
  type FaqCategory,
  filterFaqItems,
} from '../data/supportContent';

export function FaqPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [category, setCategory] = useState<FaqCategory | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const showPopular = !query.trim() && category === 'all';

  const popularItems = useMemo(
    () => filterFaqItems(FAQ_ITEMS.filter((item) => item.popular), query, category),
    [query, category],
  );

  const filteredItems = useMemo(() => {
    const all = filterFaqItems(FAQ_ITEMS, query, category);
    if (!showPopular) return all;
    const popularIds = new Set(popularItems.map((item) => item.id));
    return all.filter((item) => !popularIds.has(item.id));
  }, [query, category, showPopular, popularItems]);

  useEffect(() => {
    const param = searchParams.get('q') ?? '';
    setQuery((prev) => (prev === param ? prev : param));
  }, [searchParams]);

  function handleToggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <SupportPageLayout
      title="Frequently Asked Questions"
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'FAQ' },
      ]}
      search={
        <SupportSearch
          id="faq-search"
          label="Search frequently asked questions"
          placeholder="Search questions - tracking, returns, vouchers…"
          value={query}
          onChange={setQuery}
        />
      }
    >
      <FaqCategoryFilter value={category} onChange={setCategory} />

      {showPopular && popularItems.length > 0 ? (
        <section className="support-faq-popular" aria-labelledby="popular-faq-heading">
          <h2 id="popular-faq-heading" className="support-page__section-title">
            Popular questions
          </h2>
          <FaqAccordion
            items={popularItems}
            openId={openId}
            onToggle={handleToggle}
            highlightPopular
          />
        </section>
      ) : null}

      <section aria-labelledby="all-faq-heading">
        <h2 id="all-faq-heading" className="support-page__section-title">
          {showPopular ? 'All questions' : 'Questions'}
        </h2>
        <FaqAccordion
          items={filteredItems}
          openId={openId}
          onToggle={handleToggle}
          highlightPopular={showPopular}
        />
      </section>

      <SupportCta />

      <p className="support-links mb-0">
        Still need help? Visit the <Link to="/help">Help Center</Link>, read our{' '}
        <Link to="/terms">Terms of service</Link>, or our{' '}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </SupportPageLayout>
  );
}
