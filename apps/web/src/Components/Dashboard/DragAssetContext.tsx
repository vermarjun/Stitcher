import React, { createContext, useContext, useState } from "react";
import type { Asset } from "@/State/Types";

type DragAssetContextType = {
  draggingAsset: Asset | null;
  setDraggingAsset: (a: Asset | null) => void;
};

const DragAssetContext = createContext<DragAssetContextType | undefined>(undefined);

export const DragAssetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [draggingAsset, setDraggingAsset] = useState<Asset | null>(null);
  return (
    <DragAssetContext.Provider value={{ draggingAsset, setDraggingAsset }}>
      {children}
    </DragAssetContext.Provider>
  );
};

export const useDragAsset = (): DragAssetContextType => {
  const ctx = useContext(DragAssetContext);
  if (!ctx) throw new Error("useDragAsset must be used inside DragAssetProvider");
  return ctx;
};
