import { Copy } from "lucide-react";
import { Button } from "../../Components/ui/button";

const data = [
  {
    prompt: "Create a highly polished animation to visualize a Binary Search Tree whose structure morphs smoothly.",
    mediaSrc: "https://res.cloudinary.com/dodlenepk/video/upload/q_auto,f_auto,w_600/v1757006850/tree_yoifqz.mp4",
    mediaType: 'gif',
    // Titles removed per instruction "no text" (title), only prompt remains in overlay
  },
  {
    prompt: "Create a highly polished 3D Manim animation that visualizes the Lorenz Attractor in a cinematic and educational way.",
    mediaSrc: "https://res.cloudinary.com/dodlenepk/video/upload/q_auto,f_auto,w_600/v1757006283/Lorenz_Attractor_Visualization_-_Simulation_of_Chaos_a.k.a_Butterfly_Effect_-_Visualization_101_1080p_h264_apudib.mp4",
    mediaType: 'gif',
  },
  {
    prompt: "Create a 3D animation for a smooth mathematical surface defined by a scalar function z=f(x,y)",
    mediaSrc: "https://res.cloudinary.com/dodlenepk/image/upload/q_auto,f_auto,w_600/v1756999225/3d_calculus_ziwjza.mp4",
    mediaType: 'gif',
  },
  {
    prompt: "Create a clean, cinematic 3D animation that visualizes a convex mathematical surface emerging from the xy-plane.",
    mediaSrc: "https://res.cloudinary.com/dodlenepk/video/upload/q_auto,f_auto,w_600/v1756990356/ezgif-1c22e6dbdda273_frao3j.mp4",
    mediaType: 'gif',
  },
  {
    prompt: "Animate indian gdp growth between year 2020 to 2025, use modern minimal colors.",
    mediaSrc: "https://res.cloudinary.com/dodlenepk/video/upload/v1769164126/IndiaGDP_a8oexw.mp4",
    mediaType: 'gif',
  },
  // {
  //   prompt: "This is the first prompt text that will appear in the box",
  //   mediaSrc: "",
  //   mediaType: 'gif',
  // },
  {
    prompt: "Create a lissajous curve by plotting parametric equations with two different frequency sine waves",
    mediaSrc: "https://res.cloudinary.com/dodlenepk/video/upload/v1769164127/LissajousCurves_yoz0yp.mp4",
    mediaType: 'gif',
  },
  // {
  //   prompt: "This is the first prompt text that will appear in the box",
  //   mediaSrc: "",
  //   mediaType: 'gif',
  // },
];

export function Examples({ scrollRef }: { scrollRef?: React.RefObject<HTMLDivElement> }) {
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div ref={scrollRef} className="w-full max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
         <h2 className="text-3xl font-bold tracking-tight text-white mb-4 sm:text-5xl">
            See What's Possible
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-neutral-400">
            From mathematical visualizations to physical simulations, create stunning animations with simple text prompts.
          </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {data.map((item, idx) => (
          <div key={idx} className="flex flex-col gap-3 group">
            {/* Video Container */}
            <div className="relative rounded-xl overflow-hidden aspect-video bg-neutral-900 ring-1 ring-white/10">
               <video
                src={item.mediaSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            
            {/* Content Below */}
            <div className="flex items-start justify-between gap-4 px-1">
               <p className="text-sm text-neutral-300 font-medium leading-relaxed">
                 <span className="text-neutral-500 font-semibold select-none mr-1">Prompt:</span>
                 {item.prompt}
               </p>
               
               <Button 
                 size="icon"
                 variant="ghost"
                 className="shrink-0 text-neutral-500 hover:text-white hover:bg-neutral-800"
                 onClick={() => handleCopy(item.prompt)}
               >
                 <Copy className="w-4 h-4" />
                 <span className="sr-only">Copy Prompt</span>
               </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Examples;