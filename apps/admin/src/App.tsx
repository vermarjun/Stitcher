import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import LoginPage from '@/pages/Login';
import OverviewPage from '@/pages/Overview';
import UsersPage from '@/pages/Users';
import GenerationPage from '@/pages/Generation';
import CostPage from '@/pages/Cost';
import ContentPage from '@/pages/Content';
import FeedbackPage from '@/pages/Feedback';
import LivePage from '@/pages/Live';

export default function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes wrapped in AuthGuard + AppShell layout */}
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/generation" element={<GenerationPage />} />
          <Route path="/cost" element={<CostPage />} />
          <Route path="/content" element={<ContentPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/live" element={<LivePage />} />
        </Route>
      </Route>

      {/* Catch-all: redirect to root (AuthGuard will handle if not logged in) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
