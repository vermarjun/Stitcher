import { Timeline } from "@/Components/ui/timeline";

export function Examples() {
  const data = [
  {
    title: "Example 1",
    prompt: "This is the first prompt text that will appear in the box",
    mediaSrc: "https://res.cloudinary.com/dloh4tkp5/video/upload/q_auto,f_auto,w_600/v1757006850/tree_yoifqz.mp4",
    mediaType: 'gif'
  },
  {
    title: "Example 2",
    prompt: "This is the second prompt with different text content",
    mediaSrc: "https://res.cloudinary.com/dloh4tkp5/video/upload/q_auto,f_auto,w_600/v1757006283/Lorenz_Attractor_Visualization_-_Simulation_of_Chaos_a.k.a_Butterfly_Effect_-_Visualization_101_1080p_h264_apudib.mp4",
    mediaType: 'gif'
  },
  {
    title: "Example 1",
    prompt: "This is the first prompt text that will appear in the box",
    mediaSrc: "https://res.cloudinary.com/dloh4tkp5/image/upload/q_auto,f_auto,w_600/v1756999225/3d_calculus_ziwjza.mp4",
    mediaType: 'gif'
  },
  {
    title: "Example 2",
    prompt: "This is the second prompt with different text content",
    mediaSrc: "https://res.cloudinary.com/dloh4tkp5/video/upload/q_auto,f_auto,w_600/v1756990356/ezgif-1c22e6dbdda273_frao3j.mp4",
    mediaType: 'gif'
  },
  {
    title: "Example 1",
    prompt: "This is the first prompt text that will appear in the box",
    mediaSrc: "https://res.cloudinary.com/dloh4tkp5/video/upload/q_auto,f_auto,w_600/v1756997854/doublependulum_mbckjs.mp4",
    mediaType: 'gif'
  }
];
  return (
    <section id="examples" className="relative w-full overflow-clip">
      <Timeline data={data} />
    </section>
  );
}

export default Examples