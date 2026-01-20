import React from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import {
  Users,
  LayoutTemplate,
  BookOpen
} from "lucide-react";
import { ExternalLink } from "lucide-react";

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onClick?: () => void;
}

const ActionCard = ({
  icon,
  title,
  description,
  buttonLabel,
  onClick,
}: ActionCardProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200 gap-3 sm:gap-0 flex-1">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 ring-1 ring-white/10">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <p className="text-xs text-zinc-400">{description}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        className="w-full sm:w-auto bg-zinc-800 text-white text-xs hover:bg-zinc-700 hover:text-white transition-all duration-200 h-8 px-4"
        onClick={onClick}
      >
        {buttonLabel}
      </Button>
    </div>
  );
};

export const ActionButtons = ({ onNavigate }: { onNavigate: (key: string) => void }) => {
  return (
    <div className="flex flex-col gap-3 h-full">
      <ActionCard
        icon={<LayoutTemplate size={18} />}
        title="Browse Templates"
        description="Start with a pre-made design"
        buttonLabel="Explore"
        onClick={() => onNavigate("templates")}
      />
      <ActionCard
        icon={<Users size={18} />}
        title="Join Community"
        description="Connect with other creators"
        buttonLabel="Join"
        onClick={() => onNavigate("community")}
      />
      <ActionCard
        icon={<BookOpen size={18} />}
        title="Documentation"
        description="Learn how to use Stitcher"
        buttonLabel="Read"
        onClick={() => window.open("https://docs.stitcher.com", "_blank")}
      />
    </div>
  );
};

interface Props {
  onNavigate: (key: string) => void;
}

const GettingStarted = ({ onNavigate }: Props) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-700 delay-400">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white">Getting Started</h2>
        <p className="text-zinc-400 text-sm">
          Learn the basics and explore resources
        </p>
      </div>
      <div className="flex flex-col xl:flex-row gap-5 h-auto xl:h-[260px]">
        {/* Videos Grid */}
        <div className="w-full xl:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-5 h-full">
          <Card className="border border-zinc-800 hover:border-zinc-700 transition-all duration-300 cursor-pointer group overflow-hidden bg-black hover:bg-zinc-900/50 flex flex-col h-full p-0">
            <div className="relative w-full aspect-video m-0 p-0">
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/u6DUz9Mm-oM?si=LV7Nve1FBhemgG3_"
                  title="What is Stitcher"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-300 block border-0"
                ></iframe>
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <h3 className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors duration-200 mb-1 flex items-center gap-2">
                What is Stitcher
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-zinc-400">
                A quick introduction to the platform
              </p>
            </CardContent>
          </Card>
          
          <Card className="border border-zinc-800 hover:border-zinc-700 transition-all duration-300 cursor-pointer group overflow-hidden bg-black hover:bg-zinc-900/50 flex flex-col h-full p-0">
            <div className="relative w-full aspect-video m-0 p-0">
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/u6DUz9Mm-oM?si=LV7Nve1FBhemgG3_"
                  title="Create Your First Video"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-300 block border-0"
                ></iframe>
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-center">
              <h3 className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors duration-200 mb-1 flex items-center gap-2">
                Create First Video
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-zinc-400">
                Step-by-step guide to your first animation
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions Column */}
        <div className="w-full xl:w-1/3 min-w-[300px] h-full">
          <ActionButtons onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
};

export default GettingStarted;