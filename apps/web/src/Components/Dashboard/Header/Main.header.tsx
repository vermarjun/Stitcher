import { useState } from "react";
import type { Project, IUser } from "@/State/Types";
import { Users, Lightbulb } from "lucide-react";

import LogoSection from "./LogoAppName.header";
import { FileMenuSection } from "./FileMenu.header";
import UserSection from "./UserComponents.header";
import CollaboratorsDialog from "@/Components/Dashboard/Collaborators.dialog";
import PresenceAvatars from "@/Components/Dashboard/Presence/PresenceAvatars";
import { useCollabAwareness } from "@/Components/Dashboard/context";
import { usePresence } from "@/collab/usePresence";

interface Props {
  currentProject?: Project;
  user?: IUser;
  onShowPossibilities?: () => void;
}

function Header({ currentProject, user, onShowPossibilities }: Props) {
  const [collabOpen, setCollabOpen] = useState(false);
  const { awareness } = useCollabAwareness();
  const others = usePresence(awareness);

  return (
    <>
      <header className="relative z-[70] flex h-12 items-center border-b border-zinc-700 bg-neutral-950 backdrop-blur-sm px-4 text-sm">
        {/* Left */}
        <div className="flex items-center gap-6">
          <LogoSection />
          <div className="hidden md:block">
            <FileMenuSection />
          </div>
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
        <div className="ml-auto flex items-center gap-2">
          {/* Live presence avatars — shown when collaborators are connected */}
          {others.length > 0 && (
            <PresenceAvatars others={others} />
          )}

          {currentProject?._id && (
            <button
              data-tour="collaborators"
              onClick={() => setCollabOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors"
              title="Manage collaborators"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Collaborators</span>
            </button>
          )}

          {currentProject?._id && onShowPossibilities && (
            <button
              onClick={onShowPossibilities}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors"
              title="See what you can create with Stitcher"
            >
              <Lightbulb className="w-4 h-4" />
              <span>What can I create?</span>
            </button>
          )}
          <UserSection user={user} />
        </div>
      </header>

      {/* Collaborators dialog */}
      {collabOpen && currentProject?._id && (
        <CollaboratorsDialog
          projectId={currentProject._id}
          currentUserRole={currentProject.myRole}
          currentUser={user}
          onClose={() => setCollabOpen(false)}
        />
      )}
    </>
  );
}

export default Header;
