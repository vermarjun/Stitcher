// src/Components/Dashboard/Header/index.tsx
import { useRecoilState, useRecoilValue } from "recoil";
import { 
  searchQueryState, 
  userState, 
  currentProjectState,
} from "@/State/Dashboard.state";

import LogoSection from "./LogoAppName.header";
import {FileMenuSection} from "./FileMenu.header";
import SearchSection from "./SearchBar.header";
import UserSection from "./UserComponents.header";

function Header() {
  const [searchQuery, setSearchQuery] = useRecoilState(searchQueryState);
  const [currentProject] = useRecoilState(currentProjectState);
  const user = useRecoilValue(userState);

  return (
    <>
      <header className="flex h-12 items-center justify-between border-b border-zinc-800/50 bg-neutral-950 backdrop-blur-sm px-4 text-sm transition-all duration-200">
        {/* Left section - Logo and Menu */}
        <div className="flex items-center gap-6">
          <LogoSection />
          <FileMenuSection />
        </div>

        {/* Middle section - Search */}
        <SearchSection 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          projectId={currentProject?.id}
        />

        {/* Right section - User controls */}
        <UserSection 
          user={user}
        />
      </header>
    </>
  );
}

export default Header;