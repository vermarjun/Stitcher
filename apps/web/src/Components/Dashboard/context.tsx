import { createContext, useContext, useRef, useState } from "react";
import type { Awareness } from "y-protocols/awareness";

const PollingContext = createContext<{
  pollingIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
} | null>(null);

export const PollingProvider = ({ children }: { children: React.ReactNode }) => {
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  return (
    <PollingContext.Provider value={{ pollingIntervalRef }}>
      {children}
    </PollingContext.Provider>
  );
};

export const usePolling = () => {
  const ctx = useContext(PollingContext);
  if (!ctx) throw new Error("usePolling must be used inside PollingProvider");
  return ctx.pollingIntervalRef;
};

const RefreshHeaderContext = createContext({
  refreshHeader: 0,
  triggerHeaderRefresh: () => {},
});

export const RefreshHeaderProvider = ({ children }: any) => {
  const [refreshHeader, setRefresh] = useState(0);
  const triggerHeaderRefresh = () => setRefresh(prev => prev + 1);

  return (
    <RefreshHeaderContext.Provider value={{ refreshHeader, triggerHeaderRefresh }}>
      {children}
    </RefreshHeaderContext.Provider>
  );
};

export const useRefreshHeader = () => useContext(RefreshHeaderContext);

// ─── Collab Awareness Context ─────────────────────────────────────────────────
// Lets VideoEditor (which owns the collab doc) share its awareness instance
// with sibling components (Header) without prop-drilling through DashboardLayout.

const CollabAwarenessContext = createContext<{
  awareness: Awareness | null;
  setAwareness: (a: Awareness | null) => void;
}>({ awareness: null, setAwareness: () => {} });

export const CollabAwarenessProvider = ({ children }: { children: React.ReactNode }) => {
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  return (
    <CollabAwarenessContext.Provider value={{ awareness, setAwareness }}>
      {children}
    </CollabAwarenessContext.Provider>
  );
};

export const useCollabAwareness = () => useContext(CollabAwarenessContext);

