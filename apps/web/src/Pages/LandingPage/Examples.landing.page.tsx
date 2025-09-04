import { Timeline } from "@/Components/ui/timeline";

export function TimelineDemo() {
  const data = [
  {
    title: "Example 1",
    prompt: "This is the first prompt text that will appear in the box",
    mediaSrc: "https://raw.githubusercontent.com/rohitg00/manim-video-generator/main/static/gifs/complex_analysis.gif",
    mediaType: 'gif'
  },
  {
    title: "Example 2",
    prompt: "This is the second prompt with different text content",
    mediaSrc: "https://raw.githubusercontent.com/rohitg00/manim-video-generator/main/static/gifs/3d_calculus.gif",
    mediaType: 'gif'
  },
  {
    title: "Example 1",
    prompt: "This is the first prompt text that will appear in the box",
    mediaSrc: "https://raw.githubusercontent.com/rohitg00/manim-video-generator/main/static/gifs/complex_analysis.gif",
    mediaType: 'gif'
  },
  {
    title: "Example 2",
    prompt: "This is the second prompt with different text content",
    mediaSrc: "https://raw.githubusercontent.com/rohitg00/manim-video-generator/main/static/gifs/3d_calculus.gif",
    mediaType: 'gif'
  },
  {
    title: "Example 1",
    prompt: "This is the first prompt text that will appear in the box",
    mediaSrc: "https://raw.githubusercontent.com/rohitg00/manim-video-generator/main/static/gifs/complex_analysis.gif",
    mediaType: 'gif'
  }
];
  return (
    <div className="relative w-full overflow-clip">
      <Timeline data={data} />
    </div>
  );
}

export default TimelineDemo