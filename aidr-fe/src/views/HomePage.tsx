import { useAppSelector } from '../store/hooks';

export function HomePage() {
  const apiBase = useAppSelector((s) => s.app.apiBaseUrl);

  return (
    <section className="page">
      <h1>AIDR Frontend Foundation</h1>
      <p>
        React + Redux + React Router đã sẵn sàng. Module Auth và các màn hình nghiệp vụ
        sẽ được dựng tiếp theo plan, tham khảo UI từ <code>theme-for-aidr-fe</code>.
      </p>
      <ul>
        <li>API base: <code>{apiBase}</code></li>
        <li>Store slices stub: auth, catalog, cart…</li>
        <li>Axios client + SignalR helper đã scaffold</li>
      </ul>
    </section>
  );
}
