import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import ErrorPage from '../Pages/Error.page';

import AuthRoute from './ProtectedRoute.tsx';
import PublicRoute from './PublicRoute.tsx';

import TermsAndConditions from '@/Pages/TermsConditions.page.tsx';
import PrivacyPolicy from '@/Pages/PrivacyPolicy.page.tsx';

// Lazy-loaded pages
const LandingPage = lazy(() => import('../Pages/LandingPage/Main.landing.page.tsx'));
const AuthPage = lazy(() => import('../Pages/Auth.page.tsx'));
const HomePage = lazy(() => import('../Components/Home/Main.home.tsx'));
const DashboardLayout = lazy(() => import('../Layouts/Dashboard.layout'));
const ProfilePage = lazy(() => import('../Pages/ProfilePage.page'));
const SettingsPage = lazy(() => import('../Pages/SettingsPage.page'));

const router = createBrowserRouter([
// LANDING PAGE
  {
    path: '/',
    element: <LandingPage />
  },
  {
    path: '/home',
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <AuthRoute>
            <HomePage />
          </AuthRoute>
        ),
      },
    ],
  },
// DASHBOARD
  {
    path: '/dashboard/:projectId',
    // element: <DashboardLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <AuthRoute>
            <DashboardLayout />
          </AuthRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <AuthRoute>
            <ProfilePage />
          </AuthRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <AuthRoute>
            <SettingsPage />
          </AuthRoute>
        ),
      },
    ],
  },
// AUTH
  {
    path: '/auth',
    element: (
      <PublicRoute>
        <AuthPage />
      </PublicRoute>
    )
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