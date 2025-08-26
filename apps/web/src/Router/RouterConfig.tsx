import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import LoadingSpinner from '../Components/ShimmerDotLoader.tsx';
import AppLayout from '../Layouts/App.layout';
import ErrorPage from '../Pages/Error.page';

import AuthRoute from './ProtectedRoute.tsx';
import PublicRoute from './PublicRoute.tsx';

// Lazy-loaded pages
const LandingPage = lazy(() => import('../Pages/Landing.page'));
const AuthPage = lazy(() => import('../Pages/Auth.page.tsx'));
const HomePage = lazy(() => import('../Components/Home/Main.home.tsx'));
const DashboardLayout = lazy(() => import('../Layouts/Dashboard.layout'));
const ProfilePage = lazy(() => import('../Pages/ProfilePage.page'));
const SettingsPage = lazy(() => import('../Pages/SettingsPage.page'));

const router = createBrowserRouter([
// LANDING PAGE
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <LandingPage />
          </Suspense>
        ),
      },
    ],
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
    path: '*',
    element: <Navigate to="/home" replace />,
  },
]);

const RouterConfig = () => {
  return <RouterProvider router={router} />;
};

export default RouterConfig;