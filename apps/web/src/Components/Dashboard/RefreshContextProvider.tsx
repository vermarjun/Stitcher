// RefreshProvider.tsx
import React, { createContext, useContext, useState } from "react";

type RefreshContextType = {
  refreshKey: number;
  triggerRefresh: () => void;
};

// Create contexts for each component
const RefreshContextAssetStash = createContext<RefreshContextType | undefined>(undefined);
const RefreshContextTracks = createContext<RefreshContextType | undefined>(undefined);
const RefreshContextTimeline = createContext<RefreshContextType | undefined>(undefined);

// Hook for AssetStash (refreshed by GenerateChat)
export const useRefreshAssetStash = (): RefreshContextType => {
  const ctx = useContext(RefreshContextAssetStash);
  if (!ctx) throw new Error("useRefreshAssetStash must be used inside RefreshProviderAssetStash");
  return ctx;
};

// Hook for Tracks (refreshed by AssetStash AND Timeline)
export const useRefreshTracks = (): RefreshContextType => {
  const ctx = useContext(RefreshContextTracks);
  if (!ctx) throw new Error("useRefreshTracks must be used inside RefreshProviderTracks");
  return ctx;
};

// Hook for Timeline (refreshed by AssetStash)
export const useRefreshTimeline = (): RefreshContextType => {
  const ctx = useContext(RefreshContextTimeline);
  if (!ctx) throw new Error("useRefreshTimeline must be used inside RefreshProviderTimeline");
  return ctx;
};

// Provider for AssetStash (triggered by GenerateChat)
export const RefreshProviderAssetStash: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);
  return (
    <RefreshContextAssetStash.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContextAssetStash.Provider>
  );
};

// Provider for Tracks (triggered by AssetStash AND Timeline)
export const RefreshProviderTracks: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);
  return (
    <RefreshContextTracks.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContextTracks.Provider>
  );
};

// Provider for Timeline (triggered by AssetStash)
export const RefreshProviderTimeline: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);
  return (
    <RefreshContextTimeline.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContextTimeline.Provider>
  );
};