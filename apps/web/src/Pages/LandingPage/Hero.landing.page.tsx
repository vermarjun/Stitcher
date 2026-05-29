import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShimmerButton } from "@/Components/magicui/shimmer-button";
import { ArrowRightIcon, StarHalf, X, ArrowUp, RotateCw, Menu } from "lucide-react";
import { LandingRightSideBar } from "./RightSideBar";
import { useScroll, useTransform, MotionValue } from "motion/react";
import { Marquee } from "@/Components/magicui/marquee";
import Prism from "./Prism.landing.page";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import api from "@/api";

interface FlipWordsProps {
  words: string[];
  duration?: number;
  className?: string;
}

// Aceternity FlipWords Component (exact implementation)
const FlipWords = ({ words, duration = 3000, className }: FlipWordsProps) => {
  const [currentWord, setCurrentWord] = useState(words[0]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const startAnimation = useCallback(() => {
    if (!isVisible) return;
    const word = words[words.indexOf(currentWord) + 1] || words[0];
    setCurrentWord(word);
    setIsAnimating(true);
  }, [currentWord, words, isVisible]);

  // Observe visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2 }, // trigger when 20% visible
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isAnimating && isVisible) {
      const timeout = setTimeout(() => {
        startAnimation();
      }, duration);
      return () => clearTimeout(timeout);
    }
  }, [isAnimating, duration, startAnimation, isVisible]);

  return (
    <div ref={containerRef} className={className}>
      <AnimatePresence
        onExitComplete={() => {
          setIsAnimating(false);
        }}
      >
        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 10,
          }}
          exit={{
            opacity: 0,
            y: -40,
            x: 40,
            filter: "blur(8px)",
            scale: 2,
            position: "absolute",
          }}
          className={cn("z-10 inline-block relative px-2", className)}
          key={currentWord}
        >
          {currentWord.split(" ").map((word, wordIndex) => (
            <motion.span
              key={word + wordIndex}
              initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                delay: wordIndex * 0.3,
                duration: 0.3,
              }}
              className="inline-block whitespace-nowrap"
            >
              {word.split("").map((letter, letterIndex) => (
                <motion.span
                  key={word + letterIndex}
                  initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{
                    delay: wordIndex * 0.3 + letterIndex * 0.05,
                    duration: 0.2,
                  }}
                  className="inline-block"
                >
                  {letter}
                </motion.span>
              ))}
              <span className="inline-block">&nbsp;</span>
            </motion.span>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

interface UserRatingCardProps {
  className?: string;
}

export const UserRatingCard: React.FC<UserRatingCardProps> = ({ className = "" }) => {
  const avatars = [
    {
      src: "https://github.com/shadcn.png",
      alt: "@shadcn",
      fallback: "CN",
    },
    {
      src: "https://github.com/leerob.png",
      alt: "@leerob",
      fallback: "LR",
    },
    {
      src: "https://github.com/evilrabbit.png",
      alt: "@evilrabbit",
      fallback: "ER",
    },
    {
      src: "https://github.com/vercel.png",
      alt: "@vercel",
      fallback: "V",
    },
    {
      src: "https://github.com/nextjs.png",
      alt: "@nextjs",
      fallback: "N",
    },
  ];

  // Generate stars for 4.8 rating
  const renderStars = () => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < 4) {
        // Full stars
        stars.push(
          <Star key={i} className="w-7 h-7 fill-yellow-400 text-yellow-400" />,
        );
      } else {
        // 0.8 partial star (appears as full for simplicity)
        stars.push(
          <StarHalf
            key={i}
            className="w-7 h-7 fill-yellow-400 text-yellow-400"
          />,
        );
      }
    }
    return stars;
  };

  return (
    <div className={`md:flex items-center gap-2 rounded-lg ${className}`}>
      {/* Overlapping Avatars */}
      <div className="flex -space-x-4">
        {avatars.map((avatar, index) => (
          <Avatar key={index} className="w-12 h-12 border-2 border-neutral-300">
            <AvatarImage loading="lazy" src={avatar.src} alt={avatar.alt} />
            <AvatarFallback className="bg-neutral-300 text-gray-200">
              {avatar.fallback}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>

      {/* Rating and Text */}
      <div className="flex flex-col md:items-start justify-center items-center gap-2">
        {/* Stars */}
        <div className="flex">{renderStars()}</div>

        {/* User count text */}
        <p className="text-gray-300 text-xs font-medium text-left">
          10+ Active users
        </p>
      </div>
    </div>
  );
};

// Container Scroll Components
export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.7, 0.9] : [1.05, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      className="flex items-center justify-center relative"
      ref={containerRef}
    >
      <div
        className="md:w-full w-screen relative"
        style={{
          perspective: "1000px",
        }}
      >
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const VideoElement: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.5 },
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isVisible) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isVisible]);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      loop
      preload="none"
      poster="https://dummyimage.com/400x300/1a1a1a/ffffff&text=Loading..."
      className="w-full h-full object-cover rounded-2xl"
    >
      <source
        src="https://remotionlambda-useast1-vpt8nii3zp.s3.amazonaws.com/cdn-landing-page/animstats-hero-video.webm"
        type="video/webm"
      />
      <source
        src="https://remotionlambda-useast1-vpt8nii3zp.s3.amazonaws.com/cdn-landing-page/animstats-hero-video.mp4"
        type="video/mp4"
      />
      Your browser does not support the video tag.
    </video>
  );
};

export const Header = ({ translate, titleComponent }: any) => {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="div text-center"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="md:w-full w-screen bg-[#222222] rounded-[30px] shadow-2xl"
    >
      <div className="h-full md:w-full w-screen overflow-hidden rounded-2xl dark:bg-zinc-900 md:rounded-2xl md:p-4 ">
        {children}
      </div>
    </motion.div>
  );
};



// A featured template as returned by the public GET /template/featured endpoint.
// `assetId` carries the real Template ObjectId so the drag payload resolves to a
// real DB document instead of the old hardcoded fake IDs.
interface FeaturedTemplate {
  url: string;
  assetId: string;
}

// Raw shape returned by the public endpoint (only public-safe fields).
interface FeaturedTemplateApi {
  _id: string;
  title?: string;
  type?: string;
  url: string;
  thumbnail?: string;
  duration?: number;
}


const DraggableVideoCard = ({ template }: { template: FeaturedTemplate }) => {
    return (
      <div 
        className="relative w-40 md:w-60 aspect-video rounded-lg overflow-hidden border border-neutral-800 cursor-grab active:cursor-grabbing group"
        draggable="true"
        onDragStart={(e) => {
            e.dataTransfer.setData("video_url", template.url);
            e.dataTransfer.setData("asset_id", template.assetId);
            e.dataTransfer.effectAllowed = "copy";
        }}
      >
        <video
          src={template.url}
          muted
          loop
          autoPlay
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Drag Me</span>
        </div>
      </div>
    );
  };

const Hero = () => {
  const navigate = useNavigate();
  const words = ["Explain?", "Visualize?", "Present?", "Illustrate?", "Learn?"];
  const promptExamples = ["Create a lissajous curve.", "Explain Binary Search.", "Help me visualize a leetocde question."];
  
  // Map short labels to full prompts
  const quickPrompts = [
    { label: "Mandala pattern", fullPrompt: "Create a mandala pattern that draws itself from center outward with symmetrical petals and geometric patterns in gold and purple" },
    { label: "Lissajous curve", fullPrompt: "Create a lissajous curve by plotting parametric equations with two different frequency sine waves" },
    { label: "Boolean operations", fullPrompt: "Create a clean, visually striking Manim animation that demonstrates Boolean set operations using overlapping 2D shapes." },
  ];
  
  const [prompt, setPrompt] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [attachedTemplate, setAttachedTemplate] = useState<FeaturedTemplate | null>(null);

  // Real featured templates fetched from the public API on mount.
  const [templateVideos, setTemplateVideos] = useState<FeaturedTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchFeaturedTemplates = async () => {
      try {
        const res = await api.get("/template/featured", { params: { limit: 6 } });
        const list: FeaturedTemplateApi[] = res.data?.data?.templates ?? [];
        if (cancelled) return;
        setTemplateVideos(
          list
            .filter((t) => t?._id && t?.url)
            .map((t) => ({ url: t.url, assetId: t._id })),
        );
      } catch (err) {
        // Fail gracefully — the section hides itself when the list is empty.
        console.error("Failed to load featured templates", err);
        if (!cancelled) setTemplateVideos([]);
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    };
    fetchFeaturedTemplates();
    return () => {
      cancelled = true;
    };
  }, []);


  // Responsive Prism dimensions
  const [prismDimensions, setPrismDimensions] = useState({ height: 20, baseWidth: 7 });
  
  useEffect(() => {
    const updatePrismDimensions = () => {
      if (window.innerWidth < 768) {
        setPrismDimensions({ height: 20, baseWidth: 4 });
      } else {
        setPrismDimensions({ height: 20, baseWidth: 7 });
      }
    };
    
    updatePrismDimensions();
    window.addEventListener("resize", updatePrismDimensions);
    return () => window.removeEventListener("resize", updatePrismDimensions);
  }, []);

  /* Sidebar Logic */
  const [showSidebar, setShowSidebar] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [sidebarInitialPrompt, setSidebarInitialPrompt] = useState("");
  const [sidebarAssetId, setSidebarAssetId] = useState<string | undefined>(undefined);

  const handleHeroSubmit = () => {
    if (!prompt.trim()) return;
    setSidebarInitialPrompt(prompt);
    setSidebarAssetId(attachedTemplate?.assetId);
    setChatStarted(true);
    setShowSidebar(true);
    setPrompt(""); // Clear hero prompt
    setAttachedTemplate(null); // Clear attachment
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    // Check for dragged string data (video url and assetId)
    const videoUrl = e.dataTransfer.getData("video_url");
    const assetId = e.dataTransfer.getData("asset_id");
    if (videoUrl && assetId) {
        setAttachedTemplate({ url: videoUrl, assetId });
    }
  };


  return (
    <section
      id="home"
      className="relative w-full min-h-screen md:rounded-b-4xl overflow-hidden bg-black flex flex-col items-center justify-center pt-20"
    >
      {/* Prism animated background */}
      <div className="absolute inset-0 z-0 opacity-60">
        <Prism
          animationType="rotate"
          height={prismDimensions.height}
          baseWidth={prismDimensions.baseWidth}
          scale={3.6}
          hueShift={0}
          colorFrequency={0.8}
          // Safari-specific settings (darker/less bright)
          safariGlow={0.14}
          safariNoise={0.05}
          // Chrome-specific settings (brighter)
          chromeGlow={1.2}
          chromeNoise={0.2}
          // Mobile
          mobileGlow={1.2}
          mobileNoise={0.2}
        />
      </div>

      {/* Math Theme Overlays - Left */}
      <div className="hidden lg:flex absolute left-30 top-50 opacity-50 pointer-events-none mix-blend-screen z-10 select-none">
        <img
          className="h-40 object-cover object-left scale-125 -translate-x-10"
          src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1760094972/image-removebg-preview_fshtui.png"
          alt="math-theme-left"
        />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-transparent to-black" />
      </div>

      {/* Math Theme Overlays - Right */}
      <div className="hidden lg:flex absolute right-10 top-80 opacity-30 pointer-events-none mix-blend-screen z-10 select-none justify-end">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-l from-transparent to-black" />
        <img
          className="h-40 object-cover object-right scale-125 translate-x-10"
          src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1760094545/LqaDfYdr-removebg-preview_fvjrsm.png"
          alt="math-theme-right"
        />
      </div>

      <div className="-mt-20 relative z-20 w-full flex flex-col items-center justify-between h-full pb-6 md:pb-10 pt-8 lg:pt-16">
        
        {/* Main Content Area - Centered Vertically available space */}
        <div className="flex-1 flex flex-col items-center justify-center w-full px-4 gap-6 md:gap-8">
            
            {/* Headlines */}
            <div className="flex flex-col items-center text-center gap-2 md:gap-0">
                <div className="flex flex-col sm:flex-row items-center justify-center text-7xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[1.1] tracking-tighter gap-2 md:gap-5 flex-wrap">
                    <span>Need to</span>
                    <FlipWords words={words} className="text-neutral-400" />
                </div>
                
                <p className="mt-4 text-base sm:text-lg md:text-xl text-neutral-400 max-w-2xl leading-relaxed font-normal tracking-wide px-4 text-balance">
                  Turn your prompts into animations. Just explain, Stitcher animates!
                </p>
            </div>

            {/* CTA */}
            <div
                onClick={() => navigate("/home")}
                className="flex justify-center items-center"
            >
                <ShimmerButton background="black" className="shadow-2xl px-8 py-3 md:px-12 md:py-4">
                  <div className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10 lg:text-base">
                    Start Creating Today
                  </div>
                  <ArrowRightIcon className="ml-3 w-4 h-4 md:w-5 md:h-5" />
                </ShimmerButton>
            </div>

            {/* Prompt Interface */}
            <div className="w-full max-w-3xl flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
                
                {/* Prompt Input Box */}
                <div 
                    className={cn(
                        "relative w-full rounded-2xl md:rounded-3xl transition-all duration-300",
                        dragActive ? "scale-[1.01] ring-2 ring-blue-500/50" : "hover:shadow-lg"
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    {/* Glassmorphism Background */}
                    <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden flex flex-col w-full relative z-10 shadow-2xl">
                        
                        {/* Input Area */}
                        <div className="relative w-full p-4 md:p-5 flex items-end gap-3 md:gap-4">
                            
                            {/* Inline Attachment Thumbnail */}
                            {attachedTemplate && (
                                <div className="relative group shrink-0 animate-in fade-in zoom-in duration-200 self-center">
                                    <div className="h-9 w-16 md:h-12 md:w-20 rounded-lg overflow-hidden bg-black border border-white/10 relative shadow-sm">
                                        <video src={attachedTemplate.url} className="w-full h-full object-cover opacity-90" />
                                    </div>
                                    <button 
                                        onClick={() => setAttachedTemplate(null)}
                                        className="absolute -top-2 -right-2 bg-neutral-800 text-white border border-neutral-700 rounded-full p-0.5 shadow-md hover:bg-neutral-600 transition-colors z-10"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            )}

                            <div className="relative flex-1 self-center">
                                    {/* Disappearing Placeholder */}
                                {!prompt && (
                                    <div className="absolute inset-0 top-0 pointer-events-none opacity-40 flex items-start pt-1">
                                        <span className="mr-2 text-neutral-500 text-lg md:text-xl font-light whitespace-nowrap">Try:</span>
                                        <FlipWords 
                                            words={promptExamples} 
                                            className="text-neutral-400 text-lg md:text-xl font-light -ml-2"
                                            duration={2500}
                                        />
                                    </div>
                                )}
                                <textarea 
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder=""
                                    className="w-full bg-transparent border-none outline-none text-white text-lg md:text-xl resize-none placeholder-transparent z-10 font-light leading-relaxed min-h-[40px] md:min-h-[50px] py-1"
                                    autoComplete="off"
                                    rows={Math.min(3, Math.max(2, (prompt.match(/\n/g) || []).length + 1))}
                                    style={{ height: 'auto' }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleHeroSubmit();
                                      }
                                    }}
                                />
                            </div>
                            
                            {/* Send Button */}
                            <button 
                                onClick={handleHeroSubmit}
                                className="h-10 w-10 md:h-12 md:w-12 bg-white text-black hover:bg-neutral-200 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:scale-105 active:scale-95 shrink-0 ml-1 mb-1 self-end"
                            >
                                <ArrowRightIcon className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Example Quick Prompts - Scrollable on mobile */}
                <div className="w-full relative">
                  <div className="flex flex-nowrap md:flex-wrap items-center gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 no-scrollbar md:justify-center scroll-smooth -mx-4 md:mx-0 px-4 md:px-0">
                      {quickPrompts.map((item, i) => (
                      <button key={i} onClick={() => setPrompt(item.fullPrompt)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/30 hover:bg-neutral-800 border border-white/5 hover:border-white/10 text-neutral-400 hover:text-white text-xs md:text-sm transition-all group backdrop-blur-sm whitespace-nowrap">
                          <span>{item.label}</span>
                          <ArrowUp size={12} className="opacity-50 group-hover:opacity-100 rotate-45" />
                      </button>
                      ))}
                      <button className="flex-shrink-0 p-1.5 rounded-full bg-neutral-900/30 hover:bg-neutral-800 border border-white/5 text-neutral-500 hover:text-white transition-all backdrop-blur-sm">
                          <RotateCw size={14} />
                      </button>
                  </div>
                  {/* Fade gradients for scroll indication on mobile */}
                  <div className="md:hidden absolute left-0 top-0 bottom-2 w-4 bg-gradient-to-r from-black to-transparent pointer-events-none" />
                  <div className="md:hidden absolute right-0 top-0 bottom-2 w-4 bg-gradient-to-l from-black to-transparent pointer-events-none" />
                </div>

            </div>
        </div>

        {/* Marquee Footer - Stick to bottom. Skeleton while loading, hidden if empty. */}
        {templatesLoading ? (
          <div className="w-full max-w-3xl overflow-hidden mt-auto [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] pb-4 md:pb-6">
            <div className="flex gap-4 justify-center">
                {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                        key={idx}
                        className="w-40 md:w-60 aspect-video rounded-lg border border-neutral-800 bg-neutral-900/40 animate-pulse"
                    />
                ))}
            </div>
          </div>
        ) : templateVideos.length > 0 ? (
          <div className="w-full max-w-3xl overflow-hidden mt-auto [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] pb-4 md:pb-6">
            <Marquee pauseOnHover className="[--duration:40s]">
                {templateVideos.map((template) => (
                    <DraggableVideoCard key={template.assetId} template={template} />
                ))}
            </Marquee>
            <div className="w-full flex justify-center items-center mt-3 animate-pulse">
                <p className="text-neutral-600 text-[10px] md:text-xs uppercase tracking-widest font-medium">Try editing these templates!</p>
            </div>
          </div>
        ) : null}
      </div>


      {chatStarted && (
        <button 
            onClick={() => setShowSidebar(true)} 
            className="fixed top-24 right-6 z-40 p-3 bg-neutral-900/80 backdrop-blur-md rounded-full border border-white/10 text-white shadow-lg hover:bg-neutral-800 transition-all hover:scale-105 animate-in fade-in zoom-in duration-300"
        >
            <Menu className="w-6 h-6" />
        </button>
      )}

      <LandingRightSideBar 
        isOpen={showSidebar} 
        onClose={() => setShowSidebar(false)}
        initialPrompt={sidebarInitialPrompt}
        assetId={sidebarAssetId}
        onLimitReached={() => {
            // Optional: could redirect or show modal here, but mostly handled in sidebar for now
        }}
      />
    </section>
  );
};

export default Hero;
