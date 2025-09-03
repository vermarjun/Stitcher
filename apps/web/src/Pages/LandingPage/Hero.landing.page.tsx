import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShimmerButton } from "@/Components/magicui/shimmer-button";
import { ArrowRightIcon, StarHalf } from "lucide-react";
import { useScroll, useTransform, MotionValue } from "motion/react";
import Prism from "./Prism.landing.page";
import ProductOfTheDay from "/ProductOfTheDay.png";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";

// Utility function for classnames
const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};

// Aceternity FlipWords Component (exact implementation)
const FlipWords = ({ words, duration = 3000, className }) => {
  const [currentWord, setCurrentWord] = useState(words[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  const startAnimation = useCallback(() => {
    const word = words[words.indexOf(currentWord) + 1] || words[0];
    setCurrentWord(word);
    setIsAnimating(true);
  }, [currentWord, words]);

  useEffect(() => {
    if (!isAnimating)
      setTimeout(() => {
        startAnimation();
      }, duration);
  }, [isAnimating, duration, startAnimation]);

  return (
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
  );
};

interface UserRatingCardProps {
  className?: string;
}

const UserRatingCard: React.FC<UserRatingCardProps> = ({ className = "" }) => {
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
          <Star key={i} className="w-7 h-7 fill-yellow-400 text-yellow-400" />
        );
      } else {
        // 0.8 partial star (appears as full for simplicity)
        stars.push(
          <StarHalf
            key={i}
            className="w-7 h-7 fill-yellow-400 text-yellow-400"
          />
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
            <AvatarImage src={avatar.src} alt={avatar.alt} />
            <AvatarFallback className="bg-neutral-300 text-gray-200">
              {avatar.fallback}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>

      {/* Rating and Text */}
      <div className="flex flex-col justify-center items-center gap-2">
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
      className="flex items-center justify-center relative p-2 md:p-20"
      ref={containerRef}
    >
      <div
        className="w-full relative"
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
      className="w-full bg-[#222222] rounded-[30px] shadow-2xl"
    >
      <div className=" h-full w-full  overflow-hidden rounded-2xl dark:bg-zinc-900 md:rounded-2xl md:p-4 ">
        {children}
      </div>
    </motion.div>
  );
};

const Hero = () => {
  const words = ["Explain", "Visualize", "Present", "Illustrate", "Learn"];

  return (
    <div className="relative w-full h-full z-10 px-4 rounded-b-2xl">
      {/* Prism animated background */}
      <div className="absolute inset-0 z-0">
        <Prism
          animationType="hover"
          height={3.5}
          baseWidth={4.5}
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          noise={0.2}
          glow={1}
        />
      </div>

      <div className="">
        {/* Container Scroll Section */}
        <ContainerScroll
          titleComponent={
            <>
              {/* Content */}
              <div className="relative z-10 text-center justify-center items-center">
                <div className="flex justify-center items-center">
                  <img src={ProductOfTheDay} alt="" className="max-h-26" />
                </div>
                <div className="mb-8">
                  <div className="flex flex-col justify-center items-center text-5xl md:text-7xl lg:text-8xl font-black text-white leading-tight tracking-tighter">
                    <div className="flex w-screen">
                      <div className="w-1/2 flex items-center justify-end">
                        Need to
                      </div>
                      <div className="w-1/2 flex justify-start items-center text-left">
                        <FlipWords words={words} className="text-neutral-400" />
                      </div>
                    </div>
                    <div className="flex justify-center items-center">
                      Something?
                    </div>
                  </div>

                  {/* Tagline */}
                  <div className="mt-4 text-xl md:text-2xl text-neutral-400 font-bold flex justify-center items-center">
                    Explain visually, Try Stitcher!
                  </div>
                </div>

                {/* Subheading - Fixed typography and presentation */}
                <div className="md:mb-8 mb-14 max-w-4xl text-center mx-auto w-full">
                  <p className="text-xl md:text-2xl text-neutral-400 leading-relaxed font-normal tracking-wide">
                    Turn your prompts into engaging videos, no editing
                    required.
                    <br className="md:flex hidden" />
                    <span> </span>
                    Just explain, Stitcher animates! Tough concepts or tricky
                    questions, Stitcher transforms your words into visuals that
                    make understanding easier.
                  </p>
                </div>

                {/* CTA Buttons */}
                <div className="flex justify-center items-center">
                  <ShimmerButton
                    background="black"
                    className="shadow-2xl px-16 py-5 md:mb-8 mb-14"
                  >
                    <div className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10 lg:text-lg">
                      Start Creating Today
                    </div>
                    <ArrowRightIcon className="ml-4" />
                  </ShimmerButton>
                </div>
                <div className="w-full flex justify-center items-center">
                  <UserRatingCard />
                </div>
              </div>
            </>
          }
        >
          {/* This is where you'll add your video */}
          <div className="flex items-center justify-center h-full w-full">
            <div className="bg-black w-full h-full flex items-center justify-center rounded-2xl">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover rounded-2xl"
              >
                {/* Add your video source here */}
                <source
                  src="https://remotionlambda-useast1-vpt8nii3zp.s3.amazonaws.com/cdn-landing-page/animstats-hero-video.webm"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </ContainerScroll>
      </div>
    </div>
  );
};

export default Hero;
