import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import LoadingSpinner from '../Components/LoadingSpinner';
import AppLayout from '../Layouts/App.layout';
import ErrorPage from '../Pages/Error.page';

// Lazy-loaded pages
const LandingPage = lazy(() => import('../Pages/Landing.page'));
const AuthPage = lazy(() => import('../Pages/Auth.page.tsx'));
const HomePage = lazy(() => import('../Pages/Home.page.tsx'));
const DashboardLayout = lazy(() => import('../Layouts/Dashboard.layout'));
// const DashboardPage = lazy(() => import('../Pages/DashboardPage'));
const ProfilePage = lazy(() => import('../Pages/ProfilePage.page'));
const SettingsPage = lazy(() => import('../Pages/SettingsPage.page'));
const NotFoundPage = lazy(() => import('../Pages/NotFound.page'));

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
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <HomePage />
          </Suspense>
        ),
      },
    ],
  },
// DASHBOARD
  {
    path: '/dashboard',
    // element: <DashboardLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <DashboardLayout />
          </Suspense>
        ),
      },
      {
        path: 'profile',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <ProfilePage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <SettingsPage />
          </Suspense>
        ),
      },
    ],
  },
// AUTH
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    path: '/404',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/404" replace />,
  },
]);

const RouterConfig = () => {
  return <RouterProvider router={router} />;
};

export default RouterConfig;