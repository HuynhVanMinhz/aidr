import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpTopicCards } from '../components/support/HelpTopicCards';
import { SupportCta } from '../components/support/SupportCta';
import { SupportPageLayout } from '../components/support/SupportPageLayout';
import { SupportSearch } from '../components/support/SupportSearch';
import { HELP_TOPICS, filterHelpTopics } from '../data/supportContent';

export function HelpPage() {
  const [query, setQuery] = useState('');
  const topics = useMemo(() => filterHelpTopics(HELP_TOPICS, query), [query]);

  return (
    <SupportPageLayout
      title="Help Center"
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Help' },
      ]}
      search={
        <SupportSearch
          id="help-search"
          label="Search Help Center"
          placeholder="Search Help Center - orders, returns, payments…"
          value={query}
          onChange={setQuery}
        />
      }
    >
      <p className="support-page__intro">
        Welcome to the AIDR Help Center. Find quick answers about shopping, orders, returns, and
        seller services on our platform.
      </p>

      <h2 className="support-page__section-title">Browse by topic</h2>
      <HelpTopicCards topics={topics} />

      <h2 className="support-page__section-title">More resources</h2>
      <div className="support-links">
        <ul>
          <li>
            <Link to="/faq">Frequently asked questions</Link>
          </li>
          <li>
            <Link to="/terms">Terms of service</Link>
          </li>
          <li>
            <Link to="/about">About AIDR</Link>
          </li>
        </ul>
      </div>

      <SupportCta />

      <p className="support-links mb-0">
        Need account help? Visit <Link to="/account/security">Account security</Link> or sign in to
        contact support through order messaging.
      </p>
    </SupportPageLayout>
  );
}
