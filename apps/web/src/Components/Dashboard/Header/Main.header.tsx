import type { Project, IUser } from "@/State/Types";

import LogoSection from "./LogoAppName.header";
import { FileMenuSection } from "./FileMenu.header";
import UserSection from "./UserComponents.header";

interface Props {
  currentProject?: Project;
  user?: IUser;
}

function Header({ user }: Props) {
  // const [searchQuery, setSearchQuery] = useRecoilState(searchQueryState);

  return (
    <>
      <header className="relative flex h-12 items-center border-b border-zinc-700 bg-neutral-950 backdrop-blur-sm px-4 text-sm">
        {/* Left */}
        <div className="flex items-center gap-6">
          <LogoSection />
          <FileMenuSection />
        </div>

        {/* Middle (ABSOLUTELY CENTERED) */}
        {/* <div className="absolute left-1/2 -translate-x-1/2 w-96">
          <SearchSection
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            projectId={currentProject?._id}
          />
        </div> */}

        {/* Right */}
        <div className="ml-auto">
          <UserSection user={user} />
        </div>
      </header>
    </>
  );
}

export default Header;
