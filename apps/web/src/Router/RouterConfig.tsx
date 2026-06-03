import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import ErrorPage from '../Pages/Error.page';
import ErrorBoundary from '../Components/ErrorBoundary';

import AuthRoute from './ProtectedRoute.tsx';
import PublicRoute from './PublicRoute.tsx';
import RouteTracker from '../Components/RouteTracker.tsx';

import TermsAndConditions from '@/Pages/TermsConditions.page.tsx';
import PrivacyPolicy from '@/Pages/PrivacyPolicy.page.tsx';
import { FEATURES } from '@/config/features';

// Lazy-loaded pages
const LandingPage = lazy(() => import('../Pages/LandingPage/Main.landing.page.tsx'));
const AuthPage = lazy(() => import('../Pages/Auth.page.tsx'));
const HomePage = lazy(() => import('../Components/Home/Main.home.tsx'));
const DashboardLayout = lazy(() => import('../Components/Dashboard/main.dashboard.tsx'));
const ProfilePage = lazy(() => import('../Pages/ProfilePage.page'));
const SettingsPage = lazy(() => import('../Pages/SettingsPage.page'));
const WatchPage = lazy(() => import('../Pages/Watch.page.tsx'));
const AdminLivePage = lazy(() => import('../Pages/AdminLive.page.tsx'));

const router = createBrowserRouter([
  // Pathless root layout: renders <RouteTracker/> which fires a page_view on
  // every route change (covering all authenticated + public routes via a single
  // insertion point) and an <Outlet/> so nested routes render normally.
  {
    element: <RouteTracker />,
    children: [
// LANDING PAGE
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <LandingPage />
      </ErrorBoundary>
    ),
  },
  {
    path: '/home',
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <ErrorBoundary>
            <AuthRoute>
              <HomePage />
            </AuthRoute>
          </ErrorBoundary>
        ),
      },
    ],
  },
// DASHBOARD
  {
    path: '/dashboard/:projectId',
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <ErrorBoundary>
            <AuthRoute>
              <DashboardLayout />
            </AuthRoute>
          </ErrorBoundary>
        ),
      },
      {
        path: 'profile',
        element: FEATURES.community ? (
          <ErrorBoundary>
            <AuthRoute>
              <ProfilePage />
            </AuthRoute>
          </ErrorBoundary>
        ) : (
          <Navigate to="/home" replace />
        ),
      },
      {
        path: 'settings',
        element: (
          <ErrorBoundary>
            <AuthRoute>
              <SettingsPage />
            </AuthRoute>
          </ErrorBoundary>
        ),
      },
    ],
  },
// AUTH
  {
    path: '/auth',
    element: (
      <ErrorBoundary>
        <PublicRoute>
          <AuthPage />
        </PublicRoute>
      </ErrorBoundary>
    ),
  },
// ADMIN LIVE "GOD VIEW" — internal ops dashboard. Must be authenticated to load;
// the REAL access gate is server-side (auth + admin role on GET /admin/live/jobs
// and the join_admin_live socket handler). Non-admins see a "denied" notice.
  {
    path: '/admin/live',
    errorElement: <ErrorPage />,
    element: (
      <ErrorBoundary>
        <AuthRoute>
          <AdminLivePage />
        </AuthRoute>
      </ErrorBoundary>
    ),
  },
// PUBLIC SHARE / WATCH PAGE — no auth, anyone with the link can view
  {
    path: '/v/:shareId',
    element: (
      <ErrorBoundary>
        <WatchPage />
      </ErrorBoundary>
    ),
  },
  {
    path: '/privacypolicy',
    element: (
      <PublicRoute>
        <PrivacyPolicy />
      </PublicRoute>
    )
  },
  {
    path: '/termsconditions',
    element: (
      <PublicRoute>
        <TermsAndConditions />
      </PublicRoute>
    )
  },
  {
    path: '*',
    element: <Navigate to="/home" replace />,
  },
    ],
  },
]);

const RouterConfig = () => {
  return <RouterProvider router={router} />;
};

export default RouterConfig;