import TimelineEditor from "./TimeLine/main.timeline";
import VideoPlayer from "./VideoPlayer/main.videoplayer";
import { useState, useEffect, useRef, useCallback } from "react";
import VideoPlayerLoading from "@/Components/LoadingScreens/VideoPlayer.loader";
import TimelineEditorLoading from "@/Components/LoadingScreens/Timeline.loader";
import api from "@/api";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/Components/ui/resizable";
import type {
  Project,
  Timeline,
  ITimelineItemBase,
} from "@/State/Types";
import { toast } from "sonner";

interface Props {
  currentProject?: Project;
}

const VideoEditor = ({ currentProject }: Props) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const projectId = currentProject?._id;
      if (!projectId) return;
      const response = await api.get(`/timeline/project/${projectId}`);
      console.log("Timeline Object: ",response.data);
      setTimeline(response.data);
    } catch (err) {
      console.error("Error fetching timeline:", err);
      toast.error("Error fetching timeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  // playback loop
  useEffect(() => {
    if (!timeline) return;
    if (isPlaying) {
      const animate = (ts: number) => {
        if (lastTimeRef.current) {
          const delta = (ts - lastTimeRef.current) / 1000;
          setCurrentTime((prev) => {
            const nt = prev + delta;
            if (nt >= Number(timeline.duration)) {
              setIsPlaying(false);
              return Number(timeline.duration);
            }
            return nt;
          });
        }
        lastTimeRef.current = ts;
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      lastTimeRef.current = 0;
    }
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, timeline?.duration]);

  const handlePlayPause = () => setIsPlaying((p) => !p);
  const handleTimeUpdate = (t: number) => setCurrentTime(t);

  const handleUpdateTextItem = (
    itemId: string,
    updates: Partial<ITimelineItemBase>
  ) => {
    if (!timeline) return;
    console.log("TEXT ITEM UPDATED: ",itemId, updates);
    console.log(timeline)
    setTimeline((prev) =>
      prev
        ? {
            ...prev,
            tracks: prev.tracks.map((track: any) =>
              track.type === "text"
                ? {
                    ...track,
                    items: track.items.map((it: ITimelineItemBase) =>
                      it._id === itemId ? { ...it, ...updates } : it
                    ),
                  }
                : track
            ),
          }
        : prev
    );
    console.log(timeline);
  };

  useEffect(()=>{
    console.log("updated hogyi!!!: ",timeline);
  }, [timeline]);

  // FIXED: Backend sync with useCallback and timeline dependency
  const syncToBackend = useCallback(async (tl: Timeline) => {
    console.log("Syncing timeline:", tl); // Debug log
    const res = await api.put(`/timeline/${tl._id}`, tl);
    if (!res.data.success) throw new Error("Failed to sync");
  }, [timeline]); // Add timeline as dependency

  return (
    <ResizablePanelGroup direction="vertical" className="h-full w-full">
      {/* Video Player Resizable */}
      <ResizablePanel defaultSize={62}>
        {isLoading || !timeline ? (
          <VideoPlayerLoading />
        ) : (
          <VideoPlayer
            timeline={timeline}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeUpdate={handleTimeUpdate}
            onPlayPause={handlePlayPause}
            onUpdateTextItem={handleUpdateTextItem}
            editingTextId={editingTextId}
            setEditingTextId={setEditingTextId}
          />
        )}
      </ResizablePanel>
      <ResizableHandle withHandle />
      {/* Timeline Resizable */}
      <ResizablePanel defaultSize={38}>
        {isLoading || !timeline ? (
          <TimelineEditorLoading />
        ) : (
          <TimelineEditor
            timeline={timeline}
            currentTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            onTimelineUpdate={(tl) => setTimeline(tl)}
            onSync={syncToBackend}
          />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default VideoEditor;