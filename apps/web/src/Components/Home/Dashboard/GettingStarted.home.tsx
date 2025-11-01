import React from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import {
  Users,
  HelpCircle
} from "lucide-react";

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
    <div className="flex items-center justify-between w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">{title}</h3>
          <p className="text-xs text-zinc-400">{description}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        className="bg-zinc-800 text-white text-xs hover:bg-zinc-700 transition-colors duration-200 h-8 px-3"
        onClick={onClick}
      >
        {buttonLabel}
      </Button>
    </div>
  );
};

export const ActionButtons = () => {
  return (
    <div className="flex flex-col justify-between h-full gap-2 bg-black p-3 md:p-4">
      <ActionCard
        icon={<Users size={18} />}
        title="Invite team members"
        description="Create great content with your team"
        buttonLabel="Add users"
        onClick={() => alert("Invite users clicked")}
      />
      <ActionCard
        icon={<HelpCircle size={18} />}
        title="Visit our help center"
        description="Learn how to use Clueso"
        buttonLabel="Learn more"
        onClick={() => alert("Help center clicked")}
      />
      <ActionCard
        icon={<HelpCircle size={18} />}
        title="Visit our help center"
        description="Learn how to use Clueso"
        buttonLabel="Learn more"
        onClick={() => alert("Help center clicked")}
      />
    </div>
  );
};

const GettingStarted = () => {
  return (
    <div className="space-y-4 animate-in fade-in duration-700 delay-400">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white">Getting Started</h2>
        <p className="text-zinc-400 text-xs">
          Learn the basics with these quick videos
        </p>
      </div>
      <div className="xl:flex gap-4">
        <div className="w-full h-fit grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="py-0 border border-zinc-800 hover:border-zinc-700 transition-colors duration-200 cursor-pointer group overflow-hidden bg-black hover:bg-zinc-900">
            <div className="relative">
              <div className="aspect-video bg-zinc-800 transition-colors duration-200">
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/u6DUz9Mm-oM?si=LV7Nve1FBhemgG3_"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="border-b border-zinc-600 group-hover:scale-105 transition-all duration-200"
                ></iframe>
              </div>
            </div>
            <CardContent className="px-3 pb-5 text-left">
              <h3 className="font-medium text-white text-sm group-hover:text-white transition-colors duration-200 mb-1">
                What is Stitcher
              </h3>
              <p className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors duration-200">
                An introduction to Stitcher
              </p>
            </CardContent>
          </Card>
          <Card className="py-0 border border-zinc-800 hover:border-zinc-700 transition-colors duration-200 cursor-pointer group overflow-hidden bg-black hover:bg-zinc-900">
            <div className="relative">
              <div className="aspect-video bg-zinc-800 transition-colors duration-200">
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/u6DUz9Mm-oM?si=LV7Nve1FBhemgG3_"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="border-b border-zinc-600 group-hover:scale-105 transition-all duration-200"
                ></iframe>
              </div>
            </div>
            <CardContent className="px-3 text-left">
              <h3 className="font-medium text-white text-sm group-hover:text-white transition-colors duration-200 mb-1">
                Create Your First Video
              </h3>
              <p className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors duration-200">
                Make your first AI animation
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="xl:w-fit w-full min-w-0">
          <ActionButtons/>
        </div>
      </div>
    </div>
  );
};

export default GettingStarted;