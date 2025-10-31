import { createContext, useContext, useState, type ReactNode } from "react";

type NavContextType = {
  activeItem: string;
  setActiveItem: React.Dispatch<React.SetStateAction<string>>;
};

const NavContext = createContext<NavContextType | undefined>(undefined);

export const NavProvider = ({ children }: { children: ReactNode }) => {
  const [activeItem, setActiveItem] = useState("home");

  return (
    <NavContext.Provider value={{ activeItem, setActiveItem }}>
      {children}
    </NavContext.Provider>
  );
};

export const useNav = () => {
  const context = useContext(NavContext);
  if (!context) {
    throw new Error("useNav must be used inside <NavProvider>");
  }
  return context;
};