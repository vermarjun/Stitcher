import React from "react";
import Prism from "./Prism.landing.page";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";


const CTA: React.FC = () => {

  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches
  );

  const prismProps = useMemo(
    () =>
      isMobile
        ? {
            animationType: "rotate",
            height: 14,
            baseWidth: 10,
            scale: 1.6,
            hueShift: -1,
            timeScale: 0.05, 
            colorFrequency: 1,
            noise: 0.2,
            glow: 0.8,
          }
        : {
            animationType: "rotate",
            height: 24,
            baseWidth: 14,
            scale: 3.6,
            hueShift: -1,
            timeScale: 0.08, 
            colorFrequency: 1,
            noise: 0.2,
            glow: 0.8,
          },
    [isMobile]
  );

  // Debounced resize handler to detect mobile screens
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleResize = () => {
      setIsMobile(mediaQuery.matches);
    };


    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    mediaQuery.addEventListener("change", debouncedResize);
    return () => {
      mediaQuery.removeEventListener("change", debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);
  return (
    <section id="endpagecta" className="relative w-full h-full px-4 rounded-b-2xl">
      <div className="max-w-5xl py-18 px-4 mx-auto text-center">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Prism {...prismProps} suspendWhenOffscreen />
        </div>
        <h2 className="text-3xl font-bold md:text-5xl lg:text-6xl mb-6 text-neutral-200 md:flex justify-center items-center">
          Don't just tell.
          <div className="md:w-fit md:mt-0 mt-2 w-full flex justify-center items-center">
            <div className="relative overflow-hidden w-fit">
              {/* Metallic text */}
              <span
                className="font-extrabold text-transparent bg-clip-text 
                      bg-gradient-to-r from-gray-300 via-gray-100 to-gray-400
                      drop-shadow-lg relative z-10"
              >
                Show!
              </span>

              {/* Glare effect with custom animation - contained within parent */}
              <div
                className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/60 to-transparent 
                   blur-[2px] transform -skew-x-12 z-0 overflow-hidden"
                style={{
                  animation: "metallicGlare 10s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </h2>
        <p className="text-neutral-200 text-base md:text-xl lg:text-2xl mb-10 opacity-90 max-w-3xl mx-auto">
          Create captivating videos & GIFs that explain, engage, and convert.
        </p>
        <button onClick={() => navigate("/home")} className="cursor-pointer z-50 text-white px-8 md:px-12 py-3 md:py-4 rounded-lg border-1 tracking-widest font-normal bg-transparent hover:bg-[#b2bbc3] hover:text-black transition duration-500">
          Start Creating Now
        </button>
      </div>
    </section>
  );
};

export default CTA;
