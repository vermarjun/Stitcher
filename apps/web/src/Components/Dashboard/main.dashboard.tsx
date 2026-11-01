import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Header from "./Header/Main.header";
import LeftSideBar from "./LeftSideBar/Main.leftsidebar";
import RightSideBar from "./RightSideBar/Main.rightsidebar";

import VideoEditor from "@/Components/Dashboard/VideoEditor.dashboard";

import { useParams, useNavigate } from "react-router-dom";
import api from "@/api";
import { toast } from "sonner";
import ThreeDotLoader from "@/Components/LoadingScreens/ThreeDotLoader";
import {
  RefreshProviderAssetStash,
  RefreshProviderTimeline,
  RefreshProviderTracks,
} from "@/Components/Dashboard/RefreshContextProvider";
import { DragAssetProvider } from "@/Components/Dashboard/DragAssetContext";
import { PollingProvider } from "./context";
import { maybeRunEditorTour } from "@/lib/onboardingTour";

import type { Project, IUser, Asset } from "@/State/Types";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<Project>();
  const [user, setUser] = useState<IUser>();

  const [droppedAssets, setDroppedAssets] = useState<Asset[]>([]);
  
  // Right Sidebar State
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  const handleAssetDrop = (asset: Asset) => {
    // Check if asset already exists to avoid duplicates
    if (!droppedAssets.find((item) => item._id === asset._id)) {
      setDroppedAssets((prev) => [...prev, asset]);
      toast.success(`Added ${asset.name} to message`);
    }
  };

  const handleRemoveAsset = (assetId: string) => {
    setDroppedAssets((prev) => prev.filter((asset) => asset._id !== assetId));
  };

  async function fetchData() {
    try {
      setIsLoading(true);

      // FETCH PROJECT DATA FOR THIS PROJECT ID
      const projectResponse = await api.get<Project>(`/project/${projectId}`);

      if (projectResponse.status === 200 || projectResponse.status === 201) {
        setProject(projectResponse.data);
      } else {
        throw new Error(
          "Failed to fetch project"
        );
      }

      // FETCH USER DATA FOR THIS PROJECT ID
      const user = JSON.parse(localStorage.getItem("user") || "");
      if (!user.profilePhoto) {
        user.profilePhoto = "/default-avatar.svg";
      }
      setUser(user);

    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch project";
      toast.error(errorMessage);
      navigate("/home");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!projectId) {
      navigate("/home");
    } else {
      fetchData();
    }
  }, []);

  // First-time product tour, Act 2 (the editor walkthrough). Fires once the
  // project has loaded and the editor chrome is mounted. No-ops unless the user
  // is mid-tour (or hasn't seen it) — see maybeRunEditorTour() for the gating.
  useEffect(() => {
    if (!isLoading && project) maybeRunEditorTour();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, project]);

  return (
    <PollingProvider>
        <div>
          {isLoading ? (
            <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden">
              <ThreeDotLoader />
            </div>
          ) : (
            <RefreshProviderTracks>
              <RefreshProviderTimeline>
                <RefreshProviderAssetStash>
                    <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden">
                    <Header currentProject={project} user={user} />

                    {/* Mobile: AI chat trigger bar — sits just below the header */}
                    <div className="md:hidden flex items-center gap-3 px-4 h-11 border-b border-zinc-800 bg-neutral-950 flex-shrink-0">
                      <button
                        data-tour="ai-trigger"
                        onClick={() => setIsRightSidebarOpen(true)}
                        className="flex items-center gap-2.5 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Menu className="w-5 h-5" />
                        <span className="text-sm font-medium text-zinc-300">Generate animation</span>
                      </button>
                    </div>

                    <DragAssetProvider>
                    <div className="flex-1 flex overflow-hidden relative">
                      <LeftSideBar currentProject={project} />

                      <main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
                        <VideoEditor currentProject={project} />
                      </main>

                      <RightSideBar
                        onAssetDrop={handleAssetDrop}
                        droppedItems={droppedAssets}
                        onRemoveItem={handleRemoveAsset}
                        currentProject={project}
                        user={user}
                        isOpen={isRightSidebarOpen}
                        onClose={() => setIsRightSidebarOpen(false)}
                      />
                    </div>
                    </DragAssetProvider>

                    {/* <Footer /> */}
                  </div>
                </RefreshProviderAssetStash>
              </RefreshProviderTimeline>
            </RefreshProviderTracks>
          )}
        </div>
    </PollingProvider>
  );
};

export default DashboardLayout;
