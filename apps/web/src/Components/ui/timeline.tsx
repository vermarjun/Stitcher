import { useScroll, useTransform, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { HyperText } from "../magicui/hyper-text";

interface TimelineEntry {
  title: string;
  prompt: string;
  mediaSrc: string;
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const mediaRefs = useRef<HTMLVideoElement[]>([]);

  // Use ResizeObserver instead of window resize for efficiency
  useEffect(() => {
    if (!ref.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(ref.current);
    return () => resizeObserver.disconnect();
  }, [data]);

  // Intersection observer for lazy-loading + autoplay
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;

          if (entry.isIntersecting) {
            // Attach src only when needed
            if (!video.src) {
              video.src = video.dataset.src || "";
            }
            video.play().catch((e) =>
              console.log("Autoplay prevented:", e)
            );
          } else {
            video.pause();
            video.currentTime = 0; // free memory
          }
        });
      },
      { threshold: 0.5 }
    );

    mediaRefs.current.forEach((video) => {
      if (video) observer.observe(video);
    });

    return () => {
      mediaRefs.current.forEach((video) => {
        if (video) observer.unobserve(video);
      });
    };
  }, [data]);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start center", "end center"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div className="w-full bg-neutral-950 font-sans md:px-10">
      {/* Heading */}
      <div className="w-full flex justify-center items-center text-white pt-10 pb-20">
        <HyperText
          className="font-bold text-5xl md:text-6xl"
          startOnView
          animateOnHover
        >
          Examples
        </HyperText>
      </div>

      {/* Timeline Container */}
      <div ref={containerRef} className="w-full relative pb-20">
        <div
          ref={ref}
          className="relative max-w-7xl mx-auto flex flex-col gap-10 md:gap-20"
        >
          {data.map((item, index) => (
            <div key={index} className="flex justify-start md:gap-10 relative">
              {/* Timeline Node */}
              <div className="sticky flex flex-col md:flex-row z-40 items-center top-40 self-start max-w-xs lg:max-w-sm md:w-full">
                <div className="h-10 absolute left-3 md:left-3 w-10 rounded-full bg-black flex items-center justify-center">
                  <div className="h-4 w-4 rounded-full bg-neutral-800 border border-neutral-700 p-2" />
                </div>
                <h3 className="hidden md:block text-xl md:pl-20 md:text-5xl font-bold text-neutral-500">
                  {item.title}
                </h3>
              </div>

              {/* Content */}
              <div className="relative pl-20 pr-4 md:pl-4 w-full">
                <h3 className="md:hidden block text-2xl mb-4 text-left font-bold text-neutral-500">
                  {item.title}
                </h3>

                {/* Prompt Box */}
                <div className="mb-6 p-6 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg">
                  <p className="text-neutral-200 text-lg">{item.prompt}</p>
                </div>

                {/* Video Player */}
                <div className="rounded-xl overflow-hidden border border-neutral-800">
                  <video
                    ref={(el) => {
                      if (el) mediaRefs.current[index] = el;
                    }}
                    preload="none"
                    // use lightweight poster
                    poster={`https://res.cloudinary.com/dloh4tkp5/video/upload/q_auto,f_auto,w_300/${item.mediaSrc.split("/").pop()?.replace(".mp4", ".jpg")}`}
                    data-src={item.mediaSrc} // lazy-load actual video
                    muted
                    loop
                    playsInline
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Tracing Beam */}
          {height > 0 && (
            <div
              style={{ height: height + "px" }}
              className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent via-neutral-700 to-transparent [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
            >
              <motion.div
                style={{
                  height: heightTransform,
                  opacity: opacityTransform,
                }}
                className="absolute inset-x-0 top-0 w-[2px] bg-gradient-to-t from-purple-500 via-blue-500 to-transparent rounded-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
