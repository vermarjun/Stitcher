import { WobbleCard } from "@/Components/ui/wobble-card";
import { HyperText } from "@/Components/magicui/hyper-text";

export function VideoFeaturesDemo() {
  return (
    <>
      <div className="w-full flex justify-center items-center text-white pt-10 pb-10">
        <HyperText className="font-bold text-5xl md:text-6xl" startOnView={true} animateOnHover={true}>
          Features
        </HyperText>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto w-full ">
        {/* Main Feature - AI Chat Animation */}
        <WobbleCard
          containerClassName="col-span-1 lg:col-span-2 h-full bg-gradient-to-br from-purple-600 to-blue-700 min-h-[500px] lg:min-h-[300px]"
          className=""
        >
          <div className="max-w-lg">
            <h2 className="text-left text-balance text-base md:text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
              Chat with AI to Create Mathematical Animations
            </h2>
            <p className="mt-4 text-left text-base/6 text-neutral-200">
              Generate high-quality, mathematically accurate programmatic
              animations for explanatory videos. No timeline complexity - just
              describe what you want and AI implements it.
            </p>
          </div>
          <div className="absolute -right-4 lg:-right-[20%] -bottom-10 w-32 h-32 bg-white/20 rounded-full flex items-center justify-center">
            <div className="w-16 h-16 bg-white/40 rounded-full animate-pulse"></div>
          </div>
        </WobbleCard>
        {/* Timeline & Manual Tools */}
        <WobbleCard containerClassName="col-span-1 min-h-[300px] bg-gradient-to-br from-green-600 to-teal-700">
          <h2 className="max-w-80 text-left text-balance text-base md:text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
            Visual Timeline & Manual Controls
          </h2>
          <p className="mt-4 max-w-[26rem] text-left text-base/6 text-neutral-200">
            Access a visual timeline to see your video tracks and manually add
            texts, crop content, or apply fading effects when you need precise
            control.
          </p>
        </WobbleCard>

        {/* Content Library & Custom API */}
        <WobbleCard containerClassName="col-span-1 lg:col-span-3 bg-gradient-to-br from-slate-800 to-slate-900 min-h-[500px] lg:min-h-[600px] xl:min-h-[300px]">
          <div className="max-w-2xl">
            <h2 className="max-w-sm md:max-w-lg text-left text-balance text-base md:text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
              Massive Content Library & Custom AI Integration
            </h2>
            <p className="mt-4 max-w-[40rem] text-left text-base/6 text-neutral-200">
              Import audio and video content from our huge library of prebuilt
              templates for direct use in your projects. Plus, bring your own
              API keys for custom AI models - pay only for the software, use
              your preferred AI services.
            </p>
          </div>
          <div className="absolute -right-10 md:-right-[20%] lg:-right-[10%] -bottom-10 flex space-x-4">
            <div className="w-24 h-24 bg-white/10 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 bg-white/30 rounded"></div>
            </div>
            <div className="w-24 h-24 bg-white/10 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 bg-white/30 rounded-full"></div>
            </div>
            <div className="w-24 h-24 bg-white/10 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 bg-white/30 rounded-sm"></div>
            </div>
          </div>
        </WobbleCard>
      </div>
    </>
  );
}

export default VideoFeaturesDemo;
