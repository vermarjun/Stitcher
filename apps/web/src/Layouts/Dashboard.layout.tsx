import { useEffect, useState } from "react";
import Header from "../Components/Dashboard/Header/Main.header";
import LeftSideBar from "../Components/Dashboard/LeftSideBar/Main.leftsidebar";
// import Footer from "../Components/Dashboard/Footer.dashboard"
import RightSideBar from "../Components/Dashboard/RightSideBar/Main.rightsidebar";

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

import type { Project, IUser, Asset } from "@/State/Types";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<Project>();
  const [user, setUser] = useState<IUser>();

  const [droppedAssets, setDroppedAssets] = useState<Asset[]>([]);
  const handleAssetDrop = (asset: Asset) => {
    // Check if asset already exists to avoid duplicates
    if (!droppedAssets.find(item => item._id === asset._id)) {
      setDroppedAssets(prev => [...prev, asset]);
      toast.success(`Added ${asset.name} to message`);
    }
  };

  const handleRemoveAsset = (assetId: string) => {
    setDroppedAssets(prev => prev.filter(asset => asset._id !== assetId));
  };

  async function fetchData() {
    try {
      setIsLoading(true);

      // FETCH PROJECT DATA FOR THIS PROJECT ID
      const projectResponse = await api.get(`/project/${projectId}`);

      if (projectResponse.status === 200 || projectResponse.status === 201) {
        setProject(projectResponse.data);
      } else {
        throw new Error(
          projectResponse.data?.message || "Failed to fetch project"
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

                <div className="flex-1 flex overflow-hidden">
                  <LeftSideBar currentProject={project} user={user} />

                  <main className="flex-1 flex flex-col overflow-hidden">
                    <VideoEditor currentProject={project} />
                  </main>

                  <RightSideBar onAssetDrop={handleAssetDrop}
  droppedItems={droppedAssets}
  onRemoveItem={handleRemoveAsset} currentProject={project} user={user} />
                </div>

                {/* <Footer /> */}
              </div>
            </RefreshProviderAssetStash>
          </RefreshProviderTimeline>
        </RefreshProviderTracks>
      )}
    </div>
  );
};

export default DashboardLayout;
