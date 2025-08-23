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

import type { Project, User } from "@/State/Types";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [isLoading, setIsLoading] = useState(true); 
  const [project, setProject] = useState<Project>();
  const [user, setUser] = useState<User>();

  async function fetchProject() {
    try {
      setIsLoading(true);

      const response = await api.get(`/project/${projectId}`);

      if (response.status === 200 || response.status === 201) {
        setProject(response.data);
      } else {
        toast.error(response.data?.message || "Failed to fetch project");
        navigate("/home"); 
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch project";
      toast.error(errorMessage);
      navigate("/home");
    } finally {
      setIsLoading(false);
    }
  }
  async function fetchUser() {
    try {
      setIsLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || "");
      if (user.profilePhoto == ""){
        user.profilePhoto = "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";
      }
      setUser(user);
      toast.message(`Welcome ${user.username}`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch project";
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
      fetchProject();
      fetchUser();
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
          <Header currentProject={project} user={user}/>

          <div className="flex-1 flex overflow-hidden">
            <LeftSideBar currentProject={project} user={user}/>

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
