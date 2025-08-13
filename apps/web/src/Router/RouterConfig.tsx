import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import LoadingSpinner from '../Components/LoadingSpinner';
// import AppLayout from '../layouts/App.layout';
// import AuthLayout from '../layouts/Auth.layout';
import ErrorPage from '../Pages/Error.page';

// Lazy-loaded pages
// const LandingPage = lazy(() => import('../pages/Landing.page'));
// const LoginPage = lazy(() => import('../pages/LoginPage'));
// const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const DashboardLayout = lazy(() => import('../Layouts/Dashboard.layout'));
// const DashboardPage = lazy(() => import('../Pages/DashboardPage'));
// const ProfilePage = lazy(() => import('../Pages/ProfilePage'));
// const SettingsPage = lazy(() => import('../Pages/SettingsPage'));
// const UsersPage = lazy(() => import('../Pages/UsersPage'));
// const ProductsPage = lazy(() => import('../pages/ProductsPage'));
// const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'));
// const OrdersPage = lazy(() => import('../pages/OrdersPage'));
// const OrderDetailPage = lazy(() => import('../pages/OrderDetailPage'));
// const AboutPage = lazy(() => import('../pages/AboutPage'));
// const ContactPage = lazy(() => import('../pages/ContactPage'));
// const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage'));
// const TermsConditionsPage = lazy(() => import('../pages/TermsConditionsPage'));
const NotFoundPage = lazy(() => import('../Pages/NotFound.page'));

const router = createBrowserRouter([
// LANDING PAGE
//   {
//     path: '/',
//     element: <AppLayout />,
//     errorElement: <ErrorPage />,
//     children: [
//       {
//         index: true,
//         element: (
//           <Suspense fallback={<LoadingSpinner />}>
//             <LandingPage />
//           </Suspense>
//         ),
//       },
//       {
//         path: 'products',
//         children: [
//           {
//             index: true,
//             element: (
//               <Suspense fallback={<LoadingSpinner />}>
//                 <ProductsPage />
//               </Suspense>
//             ),
//           },
//           {
//             path: ':productId',
//             element: (
//               <Suspense fallback={<LoadingSpinner />}>
//                 <ProductDetailPage />
//               </Suspense>
//             ),
//           },
//         ],
//       },
//       {
//         path: 'orders',
//         children: [
//           {
//             index: true,
//             element: (
//               <Suspense fallback={<LoadingSpinner />}>
//                 <OrdersPage />
//               </Suspense>
//             ),
//           },
//           {
//             path: ':orderId',
//             element: (
//               <Suspense fallback={<LoadingSpinner />}>
//                 <OrderDetailPage />
//               </Suspense>
//             ),
//           },
//         ],
//       },
//       {
//         path: 'about',
//         element: (
//           <Suspense fallback={<LoadingSpinner />}>
//             <AboutPage />
//           </Suspense>
//         ),
//       },
//       {
//         path: 'contact',
//         element: (
//           <Suspense fallback={<LoadingSpinner />}>
//             <ContactPage />
//           </Suspense>
//         ),
//       },
//       {
//         path: 'privacy',
//         element: (
//           <Suspense fallback={<LoadingSpinner />}>
//             <PrivacyPolicyPage />
//           </Suspense>
//         ),
//       },
//       {
//         path: 'terms',
//         element: (
//           <Suspense fallback={<LoadingSpinner />}>
//             <TermsConditionsPage />
//           </Suspense>
//         ),
//       },
//     ],
//   },
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
    //   {
    //     path: 'profile',
    //     element: (
    //       <Suspense fallback={<LoadingSpinner />}>
    //         <ProfilePage />
    //       </Suspense>
    //     ),
    //   },
    //   {
    //     path: 'settings',
    //     element: (
    //       <Suspense fallback={<LoadingSpinner />}>
    //         <SettingsPage />
    //       </Suspense>
    //     ),
    //   },
    //   {
    //     path: 'users',
    //     element: (
    //       <Suspense fallback={<LoadingSpinner />}>
    //         <UsersPage />
    //       </Suspense>
    //     ),
    //   },
    ],
  },
// AUTH
//   {
//     path: '/auth',
//     element: <AuthLayout />,
//     children: [
//       {
//         path: 'login',
//         element: (
//           <Suspense fallback={<LoadingSpinner />}>
//             <LoginPage />
//           </Suspense>
//         ),
//       },
//       {
//         path: 'register',
//         element: (
//           <Suspense fallback={<LoadingSpinner />}>
//             <RegisterPage />
//           </Suspense>
//         ),
//       },
//       {
//         path: '*',
//         element: <Navigate to="/auth/login" replace />,
//       },
//     ],
//   },
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