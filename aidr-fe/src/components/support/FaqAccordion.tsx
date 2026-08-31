import type { FaqItem } from '../../data/supportContent';

interface FaqAccordionProps {
  items: FaqItem[];
  openId: string | null;
  onToggle: (id: string) => void;
  highlightPopular?: boolean;
}

export function FaqAccordion({
  items,
  openId,
  onToggle,
  highlightPopular = false,
}: FaqAccordionProps) {
  if (items.length === 0) {
    return (
      <p className="support-empty" role="status">
        No questions match your search. Try a different keyword or category.
      </p>
    );
  }

  return (
    <div className="faq-accordion support-faq-accordion" id="support-faq-accordion">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            className={`accordion-item${highlightPopular && item.popular ? ' is-popular' : ''}`}
          >
            <h2 className="accordion-header">
              <button
                type="button"
                className={`accordion-button${isOpen ? '' : ' collapsed'}`}
                onClick={() => onToggle(item.id)}
                aria-expanded={isOpen}
              >
                {highlightPopular && item.popular ? (
                  <span className="support-faq-accordion__badge">Popular</span>
                ) : null}
                <span className="support-faq-accordion__question">{item.question}</span>
              </button>
            </h2>
            {isOpen ? (
              <div className="accordion-collapse collapse show">
                <div className="accordion-body">
                  <p>{item.answer}</p>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
