import { useCallback, useEffect, useState } from 'react';
import { getAdminAnalyticsBrief, getSellerAnalyticsBrief } from '../services/aiAnalyticsApi';
import type { AiAnalyticsAudience, AiAnalyticsBrief, AiAnalyticsBriefQuery } from '../types/aiAnalytics';
import { getApiErrorMessage } from '../utils/apiError';

type UseAiAnalyticsBriefOptions = {
  audience: AiAnalyticsAudience;
  query?: AiAnalyticsBriefQuery;
  enabled?: boolean;
};

export function useAiAnalyticsBrief({
  audience,
  query = {},
  enabled = true,
}: UseAiAnalyticsBriefOptions) {
  const [brief, setBrief] = useState<AiAnalyticsBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = JSON.stringify(query);

  const load = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);
    try {
      const fetcher = audience === 'admin' ? getAdminAnalyticsBrief : getSellerAnalyticsBrief;
      const result = await fetcher(query);
      if (!result.success || !result.data) {
        setError(result.message ?? 'Unable to load analytics brief.');
        setBrief(null);
        return;
      }
      setBrief(result.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load analytics brief.'));
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [audience, enabled, queryKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { brief, loading, error, reload: load };
}
