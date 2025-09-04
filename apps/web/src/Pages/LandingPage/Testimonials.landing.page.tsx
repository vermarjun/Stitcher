import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import dashboardimage from "/dashboard.png";
import timelineimage from "/timeline.png";
import AIchatimage from "/AIchat.png";
import homepageimage from "/homepage.png";

const images = [
  homepageimage,
  AIchatimage,
  dashboardimage,
  timelineimage,
  "https://res.cloudinary.com/dloh4tkp5/video/upload/v1756994906/202509040734_h1ndhn.mp4", //earth
  "https://res.cloudinary.com/dloh4tkp5/video/upload/v1756997181/heartequation_bpcizy.mp4", //heart
  "https://res.cloudinary.com/dloh4tkp5/video/upload/v1756997561/pi_dqd5m6.mp4", //pi
  "https://res.cloudinary.com/dloh4tkp5/video/upload/v1756997854/doublependulum_mbckjs.mp4", //doublependulum
  "https://res.cloudinary.com/dloh4tkp5/video/upload/v1756990356/ezgif-1c22e6dbdda273_frao3j.mp4",
  "https://res.cloudinary.com/dloh4tkp5/image/upload/v1756999225/3d_calculus_ziwjza.gif",
  "https://res.cloudinary.com/dloh4tkp5/video/upload/v1757006283/Lorenz_Attractor_Visualization_-_Simulation_of_Chaos_a.k.a_Butterfly_Effect_-_Visualization_101_1080p_h264_apudib.mp4",
  "https://res.cloudinary.com/dloh4tkp5/video/upload/v1757006850/tree_yoifqz.mp4",
];

const firstRow = images.slice(0, 4);
const secondRow = images.slice(4, 8);
const thirdRow = images.slice(8, 12);

const ImageCard = ({ img }: { img: string }) => {
  return (
    <figure
      className={cn(
        "relative md:h-48 md:w-86 h-30 w-48 cursor-pointer overflow-hidden rounded-xl border",
        "border-gray-700 bg-gray-800 hover:bg-gray-700 transition-colors duration-300"
      )}
    >
      <img className="w-full h-full object-cover rounded-xl" alt="" src={img} />
    </figure>
  );
};

const VideoCard = ({ vid }: { vid: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Ensure video plays when component mounts and handles any autoplay restrictions
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.log("Autoplay prevented:", error);
        // Handle autoplay restrictions if needed
      });
    }
  }, []);

  return (
    <figure
      className={cn(
        "relative md:h-48 md:w-86 h-30 w-48 cursor-pointer overflow-hidden rounded-xl border",
        "border-gray-700 hover:bg-gray-700 transition-colors duration-300"
      )}
    >
      <video
        ref={videoRef}
        loop
        muted // Added muted to help with autoplay restrictions
        autoPlay
        playsInline // Added for iOS compatibility
        className="w-full h-full object-cover rounded-xl"
        src={vid}
      />
    </figure>
  );
};

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children: React.ReactNode;
}

function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      className={cn(
        "group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] gap-16",
        "flex-row",
        className
      )}
    >
      {Array(4)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex shrink-0 justify-around gap-16 flex-row",
              "animate-[marquee_var(--duration)_linear_infinite]",
              pauseOnHover && "group-hover:[animation-play-state:paused]",
              reverse && "[animation-direction:reverse]"
            )}
          >
            {children}
          </div>
        ))}
    </div>
  );
}

export function MarqueeDemo() {
  return (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-black">
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-100% - 1rem)); }
        }
      `}</style>

      <Marquee className="[--duration:20s] mb-4">
        {firstRow.map((item, index) => {
          if (item.endsWith('.mp4')) {
            return <VideoCard key={`first-${index}`} vid={item} />;
          } else {
            return <ImageCard key={`first-${index}`} img={item} />;
          }
        })}
      </Marquee>

      <Marquee reverse className="[--duration:25s] mb-4">
        {secondRow.map((item, index) => {
          if (item.endsWith('.mp4')) {
            return <VideoCard key={`second-${index}`} vid={item} />;
          } else {
            return <ImageCard key={`second-${index}`} img={item} />;
          }
        })}
      </Marquee>

      <Marquee className="[--duration:30s]">
        {thirdRow.map((item, index) => {
          if (item.endsWith('.mp4')) {
            return <VideoCard key={`third-${index}`} vid={item} />;
          } else {
            return <ImageCard key={`third-${index}`} img={item} />;
          }
        })}
      </Marquee>

      {/* Left gradient fade */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-10"></div>

      {/* Right gradient fade */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-10"></div>
    </div>
  );
}

export default MarqueeDemo;