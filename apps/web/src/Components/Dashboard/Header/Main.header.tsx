import { useRecoilState } from "recoil";
import { 
  searchQueryState, 
} from "@/State/Dashboard.state";

import type { Project, User } from "@/State/Types";

import LogoSection from "./LogoAppName.header";
import {FileMenuSection} from "./FileMenu.header";
import SearchSection from "./SearchBar.header";
import UserSection from "./UserComponents.header";

interface Props {
  currentProject?: Project,
  user?: User
}

function Header({currentProject, user}:Props) {
  const [searchQuery, setSearchQuery] = useRecoilState(searchQueryState);

  return (
    <>
      <header className="flex h-12 items-center justify-between border-b border-zinc-800/50 bg-neutral-950 backdrop-blur-sm px-4 text-sm transition-all duration-200">
        {/* Left section - Logo and Menu */}
        <div className="flex items-center gap-6">
          <LogoSection />
          <FileMenuSection/>
        </div>

        {/* Middle section - Search */}
        <SearchSection 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          projectId={currentProject?._id}
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