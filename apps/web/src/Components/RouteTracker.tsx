import { useEffect } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { trackPageView } from '@/lib/analytics';
import { clarityTag, identifyClarity } from '@/lib/clarity';
import { userState } from '@/State/Dashboard.state';

// Pathless root-layout component. It renders <Outlet/> (so every nested route
// still renders normally) and fires a page_view on each route change. Mounting
// it as the layout for a parent route that wraps ALL routes guarantees one
// insertion point covers every authenticated + public page.
const RouteTracker = () => {
  const location = useLocation();
  const user = useRecoilValue(userState);

  // First-party page-view + a Clarity tag so recordings/heatmaps can be
  // filtered by route in the Clarity dashboard. (Clarity also auto-captures the
  // navigation; the tag just makes it queryable.)
  useEffect(() => {
    trackPageView(location.pathname);
    clarityTag('page', location.pathname);
  }, [location.pathname]);

  // Tie the Clarity session to the logged-in user once we know who they are, so
  // recordings can be attributed and segmented by plan.
  useEffect(() => {
    if (!user?.id) return;
    identifyClarity(user.id, user.name);
    if (user.plan) clarityTag('plan', user.plan);
  }, [user?.id, user?.name, user?.plan]);

  return <Outlet />;
};

export default RouteTracker;
