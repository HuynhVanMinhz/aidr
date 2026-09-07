export type AiAnalyticsAudience = 'admin' | 'seller';

export type AiAnalyticsAlertSeverity = 'info' | 'warning' | 'danger';

export type AiAnalyticsPeriod = {
  from: string;
  to: string;
};

export type AiAnalyticsAlert = {
  severity: AiAnalyticsAlertSeverity;
  message: string;
};

export type AiAnalyticsKpi = {
  label: string;
  value: string;
  changePercent: number | null;
  subtext: string | null;
};

export type AiAnalyticsInsightMetric = {
  label: string;
  value: string;
  changePercent: number | null;
};

export type AiAnalyticsRecommendation = {
  text: string;
  actionLabel: string | null;
  actionHref: string | null;
};

export type AiAnalyticsBrief = {
  audience: AiAnalyticsAudience;
  period: AiAnalyticsPeriod;
  headline: string;
  summary: string;
  kpis: AiAnalyticsKpi[];
  insightMetrics: AiAnalyticsInsightMetric[];
  insights: string[];
  actionRecommendations: AiAnalyticsRecommendation[];
  alerts: AiAnalyticsAlert[];
  answer: string | null;
  source: 'groq' | 'heuristic';
  generatedAt: string;
};

export type AiAnalyticsBriefQuery = {
  from?: string;
  to?: string;
  question?: string;
};
