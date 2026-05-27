import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import ErrorPage from '../Pages/Error.page';
import ErrorBoundary from '../Components/ErrorBoundary';

import AuthRoute from './ProtectedRoute.tsx';
import PublicRoute from './PublicRoute.tsx';

import TermsAndConditions from '@/Pages/TermsConditions.page.tsx';
import PrivacyPolicy from '@/Pages/PrivacyPolicy.page.tsx';

// Lazy-loaded pages
const LandingPage = lazy(() => import('../Pages/LandingPage/Main.landing.page.tsx'));
const AuthPage = lazy(() => import('../Pages/Auth.page.tsx'));
const HomePage = lazy(() => import('../Components/Home/Main.home.tsx'));
const DashboardLayout = lazy(() => import('../Components/Dashboard/main.dashboard.tsx'));
const ProfilePage = lazy(() => import('../Pages/ProfilePage.page'));
const SettingsPage = lazy(() => import('../Pages/SettingsPage.page'));

const router = createBrowserRouter([
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
        element: (
          <ErrorBoundary>
            <AuthRoute>
              <ProfilePage />
            </AuthRoute>
          </ErrorBoundary>
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
]);

const RouterConfig = () => {
  return <RouterProvider router={router} />;
};

export default RouterConfig;