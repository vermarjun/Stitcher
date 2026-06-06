import { DotLoader } from '@/Components/ui/dot-loader';

// Column helper: all 7 dot indices in column `c` of the 7×7 grid
const col = (c: number) => [0, 1, 2, 3, 4, 5, 6].map((r) => r * 7 + c);

// Ping-pong column sweep: left → right → left
const FRAMES = [
  col(0), col(1), col(2), col(3), col(4), col(5), col(6),
  col(5), col(4), col(3), col(2), col(1),
];

const PageLoader = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
    <DotLoader
      frames={FRAMES}
      duration={75}
      dotClassName="bg-foreground/10 transition-colors duration-75 [&.active]:bg-foreground/70"
    />
  </div>
);

export default PageLoader;
