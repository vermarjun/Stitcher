// src/Layouts/Dashboard.layout.tsx
import { RecoilRoot } from 'recoil';
import { useEffect } from 'react';
import Header from "../Components/Dashboard/Header/Main.header";
import LeftSideBar from "../Components/Dashboard/LeftSideBar/Main.leftsidebar";
import Footer from "../Components/Dashboard/Footer.dashboard";
import RightSideBar from "../Components/Dashboard/RightSideBar/Main.rightsidebar";
import Timeline from "../Components/Dashboard/Timeline.dashboard";
import VideoPlayer from "../Components/Dashboard/VideoPlayer.dashboard";
import { Toaster } from "@/Components/ui/sonner";

// Initialize app with sample data (replace with API calls)
function DashboardInitializer() {
  useEffect(() => {
    // TODO: Initialize user session
    // const initializeSession = async () => {
    //   try {
    //     const user = await api.auth.getCurrentUser();
    //     const projects = await api.projects.getUserProjects();
    //     // Set recoil states with fetched data
    //   } catch (error) {
    //     console.error('Failed to initialize session:', error);
    //   }
    // };
    // initializeSession();

    // Keyboard shortcuts for the entire app
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S - Save project
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        console.log('Global save triggered');
        // TODO: Implement global save
      }
      // Ctrl/Cmd + N - New project
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        console.log('New project triggered');
        // TODO: Implement new project
      }
      // Ctrl/Cmd + O - Open project
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        console.log('Open project triggered');
        // TODO: Implement open project
      }
      // Escape - Clear selections
      if (e.key === 'Escape') {
        console.log('Escape pressed - clearing selections');
        // TODO: Clear all selections
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
      <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden antialiased">
        {/* Global initialization */}
        <DashboardInitializer />
        
        {/* Header - Fixed height */}
        <Header />
        
        {/* Main Content Area - Takes remaining height and prevents overflow */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Sidebar - Fixed width */}
          <LeftSideBar />
          
          {/* Center - Video Player and Timeline - Flexible width */}
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Video Player - Takes available space */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <VideoPlayer />
            </div>
            
            {/* Timeline - Fixed height */}
            <div className="flex-shrink-0">
              <Timeline />
            </div>
          </main>
          
          {/* Right Sidebar - AI Assistant - Fixed width, full height with internal scroll */}
          <div className="w-80 flex-shrink-0 h-full overflow-hidden">
            <RightSideBar />
          </div>
        </div>
        
        {/* Footer Status Bar - Fixed height */}
        <div className="flex-shrink-0">
          <Footer />
        </div>
        
        {/* Global Toast Notifications */}
        <Toaster />
      </div>
    </RecoilRoot>
  );
};

export default DashboardLayout;