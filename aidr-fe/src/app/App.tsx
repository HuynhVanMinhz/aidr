import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { HomePage } from '../views/HomePage';
import { HealthPage } from '../views/HealthPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
