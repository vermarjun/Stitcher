import { BentoCard, BentoGrid } from "@/Components/magicui/bento-grid";
import {
  Wand2,
  Zap,
  Clapperboard,
  LayoutTemplate,
  Sparkles,
} from "lucide-react";
import { FEATURES } from "@/config/features";

const allFeatures = [
  {
    Icon: Wand2,
    name: "AI Animation Editing",
    description: "Use AI to edit animations effortlessly. Attach data to a Graph template and let AI animate the plotting for you.",
    href: "/home",
    cta: "Try AI Edit",
    className: "col-span-3 lg:col-span-2 lg:row-span-2",
    community: false,
    background: (
      <img
        src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1769086787/pika-1769086763115-1x_uwl8fu.png"
        alt=""
        className="h-full w-full object-cover object-center"
      />
    ),
  },
  {
    Icon: Zap,
    name: "Lightning Fast Renders",
    description: "First animation pops up in under 20 seconds. Experience speed significantly faster than competitors.",
    href: "/home",
    cta: "Experience Speed",
    className: "col-span-3 lg:col-span-1",
    community: false,
    background: (
      <img
        src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1769087348/pika-1769087012923-1x_qe6ki9.png"
        alt=""
         className="h-full w-full object-cover object-center"
      />
    ),
  },
  {
    Icon: Clapperboard,
    name: "Community",
    description: "Share your creative works. Like, comment, and interact with posts from other creators in the community.",
    href: "/home",
    cta: "Join Community",
    className: "col-span-3 lg:col-span-1",
    community: true,
    background: (
      <img
        src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1769073837/pika-1769073815887-1x_h7urtv.png"
        alt=""
        className="h-full w-full object-cover object-center"
      />
    ),
  },
  {
    Icon: LayoutTemplate,
    name: "Web-Based Video Editor",
    description: "A full timeline-based editor. Stitch clips, add text overlays, audio tracks, and export 1080p video directly from your browser.",
    href: "/home",
    cta: "Open Editor",
    className: "col-span-3 lg:col-span-1",
    community: false,
    background: (
      <img
        src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1769073749/pika-1769073701395-1x_goiqwz.png"
        alt=""
        className="h-full w-full object-cover object-center"
      />
    ),
  },
  {
    Icon: Sparkles,
    name: "Animation Generation",
    description: "The core of Stitcher. Generate multi-scene animations with simple prompts like 'explain binary search' or 'plot indian gdp'. Refine them with natural language.",
    href: "/home",
    cta: "Start Generating",
    className: "col-span-3 lg:col-span-2",
    community: false,
    background: (
        <img
            src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1769087579/pika-1769087553128-1x_mrpyeh.png"
            alt=""
            className="h-full w-full object-cover object-center"
        />
    ),
  },
];

const features = allFeatures.filter(f => FEATURES.community || !f.community);

const Features = () => {
  return (
    <section className="relative w-full pt-32 pb-10 bg-black text-white overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center text-center mb-10">
                <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-6">
                    Everything you need to <span className="text-neutral-400">Stitch-it!</span>
                </h2>
                {/* <p className="text-neutral-400 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
                    Stitcher gives you the power to generate, edit, and share mathematical animations with unprecedented ease.
                </p> */}
            </div>

            <BentoGrid className="grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {features.map((feature, idx) => (
                    <BentoCard key={idx} {...feature} />
                ))}
            </BentoGrid>
        </div>
    </section>
  );
};

export default Features;
