import { useScroll, useTransform, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { HyperText } from "../magicui/hyper-text";

interface TimelineEntry {
  title: string;
  prompt: string;
  mediaSrc: string;
  mediaType: string;
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const mediaRefs = useRef<(HTMLVideoElement | HTMLImageElement)[]>([]);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref]);

  // Set up intersection observer for media
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const media = entry.target as HTMLVideoElement | HTMLImageElement;
          
          if (entry.isIntersecting) {
            if (media.tagName === 'VIDEO') {
              (media as HTMLVideoElement).play().catch((e) => console.log("Autoplay prevented:", e));
            }
            // GIFs will autoplay by default since they're img elements
          } else {
            if (media.tagName === 'VIDEO') {
              (media as HTMLVideoElement).pause();
            }
            // For GIFs, we can't pause them, but we can reset the source to stop them
            if (media.tagName === 'IMG' && media.getAttribute('data-type') === 'gif') {
              // Reset the src to stop the GIF animation
              const src = media.src;
              media.src = "";
              media.src = src;
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    mediaRefs.current.forEach((media) => {
      if (media) observer.observe(media);
    });

    return () => {
      mediaRefs.current.forEach((media) => {
        if (media) observer.unobserve(media);
      });
    };
  }, [data]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div className="w-full bg-neutral-950 font-sans md:px-10">
      <div className="w-full flex justify-center items-center text-white pt-10 pb-20">
        <HyperText className="font-bold text-5xl md:text-6xl" startOnView={true} animateOnHover={true}>
          Examples
        </HyperText>
      </div>

      {/* Scrollable Content */}
      <div ref={containerRef} className="w-full">
        <div ref={ref} className="relative max-w-7xl mx-auto pb-20">
          {data.map((item, index) => (
            <div
              key={index}
              className="flex justify-start pb-10 md:pb-40 md:gap-10"
            >
              <div className="sticky flex flex-col md:flex-row z-40 items-center top-40 self-start max-w-xs lg:max-w-sm md:w-full">
                <div className="h-10 absolute left-3 md:left-3 w-10 rounded-full bg-black flex items-center justify-center">
                  <div className="h-4 w-4 rounded-full bg-neutral-800 border border-neutral-700 p-2" />
                </div>
                <h3 className="hidden md:block text-xl md:pl-20 md:text-5xl font-bold text-neutral-500 ">
                  {item.title}
                </h3>
              </div>

              <div className="relative pl-20 pr-4 md:pl-4 w-full">
                <h3 className="md:hidden block text-2xl mb-4 text-left font-bold text-neutral-500">
                  {item.title}
                </h3>
                
                {/* Prompt Box */}
                <div className="mb-6 p-6 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg">
                  <p className="text-neutral-200 text-lg">{item.prompt}</p>
                </div>
                
                {/* Media Player - Video or GIF */}
                <div className="rounded-xl overflow-hidden border border-neutral-800">
                  {item.mediaType === 'video' ? (
                    <video
                      ref={(el) => {
                        if (el) mediaRefs.current[index] = el;
                      }}
                      src={item.mediaSrc}
                      muted
                      loop
                      playsInline
                      className="w-full h-auto"
                    />
                  ) : (
                    <img
                      ref={(el) => {
                        if (el) mediaRefs.current[index] = el;
                      }}
                      src={item.mediaSrc}
                      alt="Animation"
                      data-type="gif"
                      className="w-full h-auto"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
          <div
            style={{
              height: height + "px",
            }}
            className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-neutral-700 to-transparent to-[99%]  [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)] "
          >
            <motion.div
              style={{
                height: heightTransform,
                opacity: opacityTransform,
              }}
              className="absolute inset-x-0 top-0  w-[2px] bg-gradient-to-t from-purple-500 via-blue-500 to-transparent from-[0%] via-[10%] rounded-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};