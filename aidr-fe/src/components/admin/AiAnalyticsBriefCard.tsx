import { Link } from 'react-router-dom';
import { useMemo, useState, type FormEvent } from 'react';
import { IconifyIcon } from './IconifyIcon';
import { useAiAnalyticsBrief } from '../../hooks/useAiAnalyticsBrief';
import type {
  AiAnalyticsAlert,
  AiAnalyticsAlertSeverity,
  AiAnalyticsAudience,
  AiAnalyticsBrief,
  AiAnalyticsRecommendation,
} from '../../types/aiAnalytics';
import { parseUtcDate } from '../../utils/dateUtc';

type AiAnalyticsBriefCardProps = {
  audience: AiAnalyticsAudience;
  from?: string;
  to?: string;
  showQuestion?: boolean;
  className?: string;
};

const ASK_EXAMPLES: Record<AiAnalyticsAudience, string[]> = {
  admin: [
    'How did GMV change vs last period?',
    'How many buyers are new vs returning?',
    'What is in the moderation queue?',
  ],
  seller: [
    'How did revenue change vs last period?',
    'Which SKUs need restock?',
    'How many orders await fulfillment?',
  ],
};

const ASK_HELP: Record<AiAnalyticsAudience, string> = {
  admin:
    'Ask about platform GMV, buyer cohorts, or moderation/return queues for the selected date range. Answers use dashboard metrics only.',
  seller:
    'Ask about revenue, orders, stock, or queue status for the selected date range. Answers use dashboard metrics only.',
};

const ASK_PLACEHOLDER: Record<AiAnalyticsAudience, string> = {
  admin: 'e.g. How did GMV change vs last period?',
  seller: 'e.g. How did revenue change vs last period?',
};

function formatBriefDate(iso: string): string {
  const date = parseUtcDate(iso);
  if (!date) return iso.slice(0, 10);
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatBriefPeriod(from: string, to: string): string {
  return `${formatBriefDate(from)} – ${formatBriefDate(to)}`;
}

function sourceLabel(source: string): string {
  return source === 'groq' ? 'AI (Groq)' : 'Rule-based';
}

function trendClass(change: number | null | undefined): string {
  if (change == null) return 'is-flat';
  if (change > 0) return 'is-up';
  if (change < 0) return 'is-down';
  return 'is-flat';
}

function formatTrend(change: number | null | undefined): string | null {
  if (change == null) return null;
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

function alertDotClass(severity: AiAnalyticsAlertSeverity): string {
  return `ai-analytics-brief__attention-dot ai-analytics-brief__attention-dot--${severity}`;
}

function AttentionBlock({ alerts }: { alerts: AiAnalyticsAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="ai-analytics-brief__attention">
      <div className="ai-analytics-brief__attention-head">
        <IconifyIcon icon="solar:shield-warning-bold-duotone" />
        <span>Needs attention</span>
        <span className="ai-analytics-brief__attention-count">{alerts.length}</span>
      </div>
      <ul className="ai-analytics-brief__attention-list mb-0">
        {alerts.map((alert) => (
          <li key={`${alert.severity}-${alert.message}`}>
            <span className={alertDotClass(alert.severity)} aria-hidden="true" />
            <span>{alert.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NextStepsBlock({ items }: { items: AiAnalyticsRecommendation[] }) {
  if (items.length === 0) return null;

  return (
    <div className="ai-analytics-brief__actions-block">
      <h6 className="ai-analytics-brief__section-title">
        <IconifyIcon icon="solar:lightbulb-bolt-bold-duotone" /> Next steps
      </h6>
      <ul className="ai-analytics-brief__actions-list mb-0">
        {items.map((item) => (
          <li key={`${item.text}-${item.actionHref ?? 'none'}`}>
            <span className="ai-analytics-brief__action-text">{item.text}</span>
            {item.actionLabel && item.actionHref ? (
              <Link
                to={item.actionHref}
                className="btn btn-sm btn-soft-primary ai-analytics-brief__action-btn"
              >
                {item.actionLabel}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BriefBody({ brief }: { brief: AiAnalyticsBrief }) {
  return (
    <>
      {brief.kpis.length > 0 ? (
        <div className="ai-analytics-brief__kpi-row">
          {brief.kpis.map((kpi) => (
            <div key={kpi.label} className="ai-analytics-brief__kpi">
              <span className="ai-analytics-brief__kpi-label">{kpi.label}</span>
              <span className="ai-analytics-brief__kpi-value">{kpi.value}</span>
              {kpi.changePercent != null ? (
                <span className={`ai-analytics-brief__trend ${trendClass(kpi.changePercent)}`}>
                  {formatTrend(kpi.changePercent)}
                </span>
              ) : null}
              {kpi.subtext ? (
                <span className="ai-analytics-brief__kpi-sub">{kpi.subtext}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="ai-analytics-brief__headline-row">
        <h5 className="ai-analytics-brief__headline mb-0">{brief.headline}</h5>
        <p className="ai-analytics-brief__summary-text mb-0">{brief.summary}</p>
      </div>

      <AttentionBlock alerts={brief.alerts} />

      {brief.insightMetrics.length > 0 ? (
        <div className="ai-analytics-brief__metrics">
          <h6 className="ai-analytics-brief__section-title">
            <IconifyIcon icon="solar:chart-2-bold-duotone" /> At a glance
          </h6>
          <div className="ai-analytics-brief__metrics-grid">
            {brief.insightMetrics.map((metric) => (
              <div key={metric.label} className="ai-analytics-brief__metric">
                <span className="ai-analytics-brief__metric-label">{metric.label}</span>
                <span
                  className={`ai-analytics-brief__metric-value ${trendClass(metric.changePercent)}`}
                >
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
          {brief.insights.length > 0 ? (
            <p className="ai-analytics-brief__insight-note mb-0">{brief.insights[0]}</p>
          ) : null}
        </div>
      ) : null}

      <NextStepsBlock items={brief.actionRecommendations} />
    </>
  );
}

export function AiAnalyticsBriefCard({
  audience,
  from,
  to,
  showQuestion = true,
  className = '',
}: AiAnalyticsBriefCardProps) {
  const [questionInput, setQuestionInput] = useState('');
  const [askedQuestion, setAskedQuestion] = useState<string | undefined>();

  const query = useMemo(
    () => ({
      from,
      to,
      question: askedQuestion,
    }),
    [from, to, askedQuestion],
  );

  const { brief, loading, error, reload } = useAiAnalyticsBrief({ audience, query });

  function handleAsk(e: FormEvent) {
    e.preventDefault();
    const trimmed = questionInput.trim();
    if (trimmed.length < 3) return;
    setAskedQuestion(trimmed);
  }

  function handleClearQuestion() {
    setQuestionInput('');
    setAskedQuestion(undefined);
  }

  function handleExampleClick(example: string) {
    setQuestionInput(example);
    setAskedQuestion(example);
  }

  const title =
    audience === 'admin' ? 'AI platform analytics brief' : 'AI shop analytics brief';

  return (
    <div className={`card ai-analytics-brief ${className}`.trim()}>
      <div className="card-header ai-analytics-brief__header">
        <div className="ai-analytics-brief__header-main">
          <span className="ai-analytics-brief__icon" aria-hidden="true">
            <IconifyIcon icon="solar:magic-stick-3-bold-duotone" />
          </span>
          <div className="min-w-0">
            <h4 className="card-title mb-0">{title}</h4>
            {brief ? (
              <p className="ai-analytics-brief__period mb-0">
                {formatBriefPeriod(brief.period.from, brief.period.to)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="ai-analytics-brief__header-actions">
          {brief ? (
            <span className="badge ai-analytics-brief__source">{sourceLabel(brief.source)}</span>
          ) : null}
          <button
            type="button"
            className="btn btn-sm btn-soft-primary ai-analytics-brief__refresh"
            onClick={() => void reload()}
            disabled={loading}
            aria-label="Refresh analytics brief"
          >
            <IconifyIcon icon="solar:refresh-bold" />
          </button>
        </div>
      </div>

      <div className="card-body">
        {error ? (
          <div className="alert alert-danger mb-3" role="alert">
            {error}
          </div>
        ) : null}

        {loading && !brief ? (
          <div className="ai-analytics-brief__loading">
            <div className="placeholder-glow">
              <span className="placeholder col-7 mb-2" />
              <span className="placeholder col-12 mb-2" />
              <span className="placeholder col-10" />
            </div>
          </div>
        ) : null}

        {brief ? (
          <div className={loading ? 'ai-analytics-brief__content is-loading' : 'ai-analytics-brief__content'}>
            <BriefBody brief={brief} />

            {brief.answer ? (
              <div className="ai-analytics-brief__answer">
                {askedQuestion ? (
                  <p className="ai-analytics-brief__question-chip mb-2">
                    <IconifyIcon icon="solar:question-circle-bold-duotone" />
                    {askedQuestion}
                  </p>
                ) : null}
                <p className="mb-0">{brief.answer}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {showQuestion ? (
          <div className="ai-analytics-brief__ask">
            <div className="ai-analytics-brief__ask-head">
              <span className="ai-analytics-brief__ask-icon" aria-hidden="true">
                <IconifyIcon icon="solar:chat-round-dots-bold-duotone" />
              </span>
              <div>
                <p className="ai-analytics-brief__ask-title mb-1">Ask AI about this period</p>
                <p className="ai-analytics-brief__ask-help mb-0">{ASK_HELP[audience]}</p>
              </div>
            </div>
            <form onSubmit={handleAsk}>
              <div className="ai-analytics-brief__ask-row">
                <input
                  id={`ai-analytics-question-${audience}`}
                  type="text"
                  className="form-control form-control-sm"
                  placeholder={ASK_PLACEHOLDER[audience]}
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  maxLength={500}
                  disabled={loading}
                  aria-label="Question about analytics metrics"
                />
                <button
                  type="submit"
                  className="btn btn-sm btn-primary ai-analytics-brief__ask-btn"
                  disabled={loading || questionInput.trim().length < 3}
                  aria-label="Ask question"
                >
                  <IconifyIcon icon="solar:plain-bold-duotone" />
                  <span>Ask</span>
                </button>
                {askedQuestion ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-soft-secondary"
                    onClick={handleClearQuestion}
                    disabled={loading}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </form>
            <div className="ai-analytics-brief__ask-examples">
              {ASK_EXAMPLES[audience].map((example) => (
                <button
                  key={example}
                  type="button"
                  className="ai-analytics-brief__example-chip"
                  disabled={loading}
                  onClick={() => handleExampleClick(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
