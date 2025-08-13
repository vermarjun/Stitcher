import Header from "../Components/Dashboard/Header.dashboard"
import Explorer from "../Components/Dashboard/Explorer.dashboard"
import Footer from "../Components/Dashboard/Footer.dashboard"
import PromptBar from "../Components/Dashboard/PromptBar.dashboard"
import Timeline from "../Components/Dashboard/Timeline.dashboard"
import VideoPlayer from "../Components/Dashboard/VideoPlayer.dashboard"

const DashboardLayout = () => {
  return (
    <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden">
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        <Explorer />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          <VideoPlayer />
          <Timeline />
        </main>
        {/* <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden"> */}
          <PromptBar />
        {/* </div> */}
      </div>
      
      <Footer />
    </div>
  );
};

export default DashboardLayout;