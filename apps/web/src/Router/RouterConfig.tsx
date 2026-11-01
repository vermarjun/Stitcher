import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PageLoader from '../Components/PageLoader';
import ErrorPage from '../Pages/Error.page';
import ErrorBoundary from '../Components/ErrorBoundary';

import AuthRoute from './ProtectedRoute.tsx';
import PublicRoute from './PublicRoute.tsx';

// Lazy-loaded pages
const AuthPage = lazy(() => import('../Pages/Auth.page.tsx'));
const HomePage = lazy(() => import('../Components/Home/Main.home.tsx'));
const DashboardLayout = lazy(() => import('../Components/Dashboard/main.dashboard.tsx'));

const router = createBrowserRouter([
  // "/" sends signed-in users to /home and everyone else to /auth. /auth is
  // wrapped in PublicRoute, which bounces signed-in users to /home.
  {
    path: '/',
    element: <Navigate to="/auth" replace />,
  },
  {
    path: '/home',
    errorElement: <ErrorPage />,
    element: (
      <ErrorBoundary>
        <AuthRoute>
          <HomePage />
        </AuthRoute>
      </ErrorBoundary>
    ),
  },
  {
    path: '/dashboard/:projectId',
    errorElement: <ErrorPage />,
    element: (
      <ErrorBoundary>
        <AuthRoute>
          <DashboardLayout />
        </AuthRoute>
      </ErrorBoundary>
    ),
  },
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
    path: '*',
    element: <Navigate to="/home" replace />,
  },
]);

const RouterConfig = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <RouterProvider router={router} />
    </Suspense>
  );
};

export default RouterConfig;
