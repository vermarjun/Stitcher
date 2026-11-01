import type { Project, IUser } from "@/State/Types";

import LogoSection from "./LogoAppName.header";
import { FileMenuSection } from "./FileMenu.header";
import UserSection from "./UserComponents.header";

interface Props {
  currentProject?: Project;
  user?: IUser;
}

function Header({ user }: Props) {
  return (
    <header className="relative z-[70] flex h-12 items-center border-b border-zinc-700 bg-neutral-950 backdrop-blur-sm px-4 text-sm">
      {/* Left */}
      <div className="flex items-center gap-6">
        <LogoSection />
        <div className="hidden md:block">
          <FileMenuSection />
        </div>
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-2">
        <UserSection user={user} />
      </div>
    </header>
  );
}

export default Header;
