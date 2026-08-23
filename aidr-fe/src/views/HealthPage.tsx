import { useEffect, useState } from 'react';
import { healthApi, type HealthStatus } from '../services/healthApi';

export function HealthPage() {
  const [data, setData] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await healthApi.getLive();
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Health check failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page">
      <h1>Backend Health</h1>
      {loading && <p>Checking…</p>}
      {error && <p className="error">{error}</p>}
      {data && (
        <pre className="health-json">{JSON.stringify(data, null, 2)}</pre>
      )}
    </section>
  );
}
