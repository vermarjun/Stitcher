import { useEffect, useState } from "react";
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
import { PollingProvider, RefreshHeaderProvider, CollabAwarenessProvider } from "./context";

import type { Project, IUser, Asset } from "@/State/Types";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<Project>();
  const [user, setUser] = useState<IUser>();

  const [droppedAssets, setDroppedAssets] = useState<Asset[]>([]);
  
  // Right Sidebar State
  const [rightSidebarMode, setRightSidebarMode] = useState<'generate' | 'edit'>('generate');
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
      if (user.profilePhoto == "") {
        user.profilePhoto =
          "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";
      }
      setUser(user);

      toast.message(`Welcome ${user.username}`);
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

  return (
    <RefreshHeaderProvider>
      <CollabAwarenessProvider>
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
                    
                    {/* Mobile Only: Generate / Edit Buttons */}
                    <div className="md:hidden flex w-full border-b border-zinc-800 bg-black">
                      <button 
                        onClick={() => {
                          setRightSidebarMode('generate');
                          setIsRightSidebarOpen(true);
                        }}
                        className="flex-1 py-3 text-sm font-medium border-r border-zinc-800 hover:bg-zinc-900 transition-colors"
                      >
                        Generate
                      </button>
                      <button 
                        onClick={() => {
                          setRightSidebarMode('edit');
                          setIsRightSidebarOpen(true);
                        }}
                        className="flex-1 py-3 text-sm font-medium hover:bg-zinc-900 transition-colors"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="flex-1 flex overflow-hidden relative">
                      <LeftSideBar currentProject={project} user={user} />

                      <main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
                        <VideoEditor currentProject={project} />
                      </main>

                      <RightSideBar
                        onAssetDrop={handleAssetDrop}
                        droppedItems={droppedAssets}
                        onRemoveItem={handleRemoveAsset}
                        currentProject={project}
                        user={user}
                        mode={rightSidebarMode}
                        setMode={setRightSidebarMode}
                        isOpen={isRightSidebarOpen}
                        onClose={() => setIsRightSidebarOpen(false)}
                      />
                    </div>

                    {/* <Footer /> */}
                  </div>
                </RefreshProviderAssetStash>
              </RefreshProviderTimeline>
            </RefreshProviderTracks>
          )}
        </div>
      </PollingProvider>
      </CollabAwarenessProvider>
    </RefreshHeaderProvider>
  );
};

export default DashboardLayout;
