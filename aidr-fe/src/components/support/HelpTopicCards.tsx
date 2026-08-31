import { Link } from 'react-router-dom';
import type { HelpTopic } from '../../data/supportContent';

interface HelpTopicCardsProps {
  topics: HelpTopic[];
}

export function HelpTopicCards({ topics }: HelpTopicCardsProps) {
  if (topics.length === 0) {
    return (
      <p className="support-empty" role="status">
        No topics match your search. Try another keyword or browse all topics below.
      </p>
    );
  }

  return (
    <div className="support-topic-grid">
      {topics.map((topic) => (
        <Link key={topic.id} to={topic.to} className="support-topic-card">
          <span className="support-topic-card__icon" aria-hidden>
            <img src={topic.icon} alt="" />
          </span>
          <span className="support-topic-card__content">
            <span className="support-topic-card__title">{topic.title}</span>
            <span className="support-topic-card__desc">{topic.description}</span>
          </span>
          <i className="fa-solid fa-arrow-right support-topic-card__arrow" aria-hidden />
        </Link>
      ))}
    </div>
  );
}
