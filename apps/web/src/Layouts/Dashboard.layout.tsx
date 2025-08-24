import { useEffect, useState } from "react";
import Header from "../Components/Dashboard/Header/Main.header";
import LeftSideBar from "../Components/Dashboard/LeftSideBar/Main.leftsidebar";
// import Footer from "../Components/Dashboard/Footer.dashboard"
import RightSideBar from "../Components/Dashboard/RightSideBar/Main.rightsidebar";
import Timeline from "../Components/Dashboard/Timeline.dashboard";
import VideoPlayer from "../Components/Dashboard/VideoPlayer.dashboard";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/api";
import { toast } from "sonner";
import LoadingSpinner from "@/Components/LoadingSpinner";

import type { Project, User, Template, Asset } from "@/State/Types";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<Project>();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [user, setUser] = useState<User>();

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
      
      // FETCH ASSET DATA FOR THIS PROJECT ID
      const assetResponse = await api.get(`/asset?projectId=${projectResponse.data._id}`);
      
      if (assetResponse.status === 200 || assetResponse.status === 201) {
        setAssets(assetResponse.data.data.templates);
      } else {
        throw new Error(
          assetResponse.data?.message || "Failed to fetch project"
        );
      }

      // FETCH TEMPLATE DATA FOR THIS PROJECT ID
      const templateResponse = await api.get(`/template?projectId=${projectResponse.data._id}`);
      
      if (templateResponse.status === 200 || templateResponse.status === 201) {
        setTemplates(templateResponse.data.data.templates);
      } else {
        throw new Error(
          templateResponse.data?.message || "Failed to fetch project"
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
    <>
      {isLoading ? (
        <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden">
          <Header currentProject={project} user={user} />

          <div className="flex-1 flex overflow-hidden">
            <LeftSideBar
              assets={assets}
              currentProject={project}
              user={user}
              templates={templates}
            />

            <main className="flex-1 flex flex-col overflow-hidden">
              <VideoPlayer currentProject={project} user={user} />
              <Timeline currentProject={project} user={user} />
            </main>

            <RightSideBar currentProject={project} user={user} />
          </div>

          {/* <Footer /> */}
        </div>
      )}
    </>
  );
};

export default DashboardLayout;
