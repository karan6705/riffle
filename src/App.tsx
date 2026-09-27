import { lazy, Suspense } from 'react';
import { createHashRouter, Link, RouterProvider, useRouteError } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';

// Map-heavy and rarely-first pages are split out of the initial bundle.
const Check = lazy(() => import('./pages/Check'));
const MapPage = lazy(() => import('./pages/MapPage'));
const SitePage = lazy(() => import('./pages/SitePage'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Review = lazy(() => import('./pages/Review'));
const Learn = lazy(() => import('./pages/Learn'));
const Me = lazy(() => import('./pages/Me'));
const RecordPage = lazy(() => import('./pages/RecordPage'));
const DataPage = lazy(() => import('./pages/DataPage'));

const wrap = (el: React.ReactNode) => (
  <Suspense fallback={<div className="py-20 text-center text-ink-3" role="status">Loading…</div>}>{el}</Suspense>
);

function ErrorPage() {
  const error = useRouteError() as Error | undefined;
  // After a new deploy, an open tab may request code chunks that no longer exist: reload once.
  if (error?.message?.includes('dynamically imported module') && !sessionStorage.getItem('riffle-reloaded')) {
    sessionStorage.setItem('riffle-reloaded', '1');
    location.reload();
    return null;
  }
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="font-display text-3xl font-semibold">Something went wrong</p>
      <p className="mt-2 text-ink-2">Your saved checks are safe on this device. Try going back to the start.</p>
      {error?.message && <p className="mt-3 font-mono text-xs text-ink-3">{error.message}</p>}
      <Link to="/" className="btn btn-primary mt-6" reloadDocument>Back to Riffle</Link>
    </div>
  );
}

// Hash routing so the static build works on GitHub Pages without rewrites.
const router = createHashRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/check', element: wrap(<Check />) },
      { path: '/map', element: wrap(<MapPage />) },
      { path: '/site/:id', element: wrap(<SitePage />) },
      { path: '/alerts', element: wrap(<Alerts />) },
      { path: '/review', element: wrap(<Review />) },
      { path: '/learn', element: wrap(<Learn />) },
      { path: '/me', element: wrap(<Me />) },
      { path: '/record/:id', element: wrap(<RecordPage />) },
      { path: '/data', element: wrap(<DataPage />) },
      { path: '*', element: <Home /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
