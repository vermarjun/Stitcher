// src/Layouts/Dashboard.layout.tsx
import { RecoilRoot } from 'recoil';
import { useEffect } from 'react';
import Header from "../Components/Dashboard/Header/Main.header";
import LeftSideBar from "../Components/Dashboard/LeftSideBar/Main.leftsidebar";
import RightSideBar from "../Components/Dashboard/RightSideBar/Main.rightsidebar";
import Timeline from "../Components/Dashboard/Timeline.dashboard";
import VideoPlayer from "../Components/Dashboard/VideoPlayer.dashboard";
import { Toaster } from "@/Components/ui/sonner";

// Initialization logic
function DashboardInitializer() {
  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        console.log('Global save triggered');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        console.log('New project triggered');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        console.log('Open project triggered');
      }
      if (e.key === 'Escape') {
        console.log('Escape pressed - clearing selections');
      }
    };

    document.addEventListener('keydown', handleGlobalKeyPress);
    return () => document.removeEventListener('keydown', handleGlobalKeyPress);
  }, []);
  return null;
}

const DashboardLayout = () => {
  return (
    <RecoilRoot>
      <div className="h-screen w-full bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white flex flex-col overflow-hidden antialiased p-3">
        <DashboardInitializer />

        {/* Header */}
        <div className="mb-3 rounded-2xl bg-white/5 backdrop-blur-md shadow-lg p-3">
          <Header />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden min-h-0 gap-3">
          {/* Left Sidebar */}
          <div className="w-64 rounded-2xl bg-white/5 backdrop-blur-lg shadow-md overflow-hidden">
            <LeftSideBar />
          </div>

          {/* Center Section */}
          <main className="flex-1 flex flex-col gap-3 min-w-0">
            {/* Video Player */}
            <div className="flex-1 rounded-2xl bg-white/5 backdrop-blur-lg shadow-md overflow-hidden">
              <VideoPlayer />
            </div>

            {/* Timeline */}
            <div className="h-48 rounded-2xl bg-white/5 backdrop-blur-lg shadow-md overflow-hidden">
              <Timeline />
            </div>
          </main>

          {/* Right Sidebar */}
          <div className="w-80 rounded-2xl bg-white/5 backdrop-blur-lg shadow-md overflow-hidden">
            <RightSideBar />
          </div>
        </div>

        {/* Toasts */}
        <Toaster />
      </div>
    </RecoilRoot>
  );
};

export default DashboardLayout;
