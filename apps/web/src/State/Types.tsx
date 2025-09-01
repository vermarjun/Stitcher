export type Resolution = {
  width: Number;
  height: Number;
};

export type Timeline = {
  _id: String;
  projectId: String;
  resolution: Resolution;
  tracks: any;
  duration: Number;
  fps: Number;
  gridSize?: Number;
  snapToGrid?: Boolean;
  zoom?: Number;
  createdAt: Date;
  updatedAt: Date;
};

export type Project = {
  _id: string;
  name: string;
  description?: string;
  bytes: Number;
  compiled: Boolean;
  playback_url: String;
  preview_url: String;
  createdAt: Date;
  updatedAt: Date;
  videoUrl?: string;
  thumbnailUrl?: string;
  status: "draft" | "processing" | "completed" | "error";
  timeline: Timeline;
};

export type User = {
  id: string;
  username: string;
  email: string;
  plan: string;
  role: string;
  bio: string;
  profilePhoto: string;
};

export enum TemplateType {
  VIDEO = "video",
  AUDIO = "audio",
}

export type Template = {
  _id: string;
  name: string;
  description?: string;
  type: TemplateType;
  thumbnail?: string;
  url: string;
  duration?: number;
  bytes: number;
  metadata: Record<string, any>;
  likesCount?: number;
  isLikedByUser?: boolean;
  isInProject?: boolean;
  projectAssetId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export enum AssetType {
  VIDEO = "video",
  AUDIO = "audio",
}

export enum TrackType {
  VIDEO = "video",
  AUDIO = "audio",
  TEXT = "text",
}

export enum TextAnimationType {
  FADE_IN = "fadeIn",
  FADE_OUT = "fadeOut",
  NONE = "none",
}

export enum AssetOrigin {
  TEMPLATE = "template",
  UPLOAD = "upload",
  GENERATED_VIDEO = "generated_video",
}

export interface Asset {
  _id: string;
  name: string;
  type: AssetType;
  origin: AssetOrigin;
  url: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
  metadata: Record<string, any>;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  isOnTimeline?: boolean;
}

export interface ITimelineItemBase {
  _id: string;
  type: "video" | "audio" | "text";
  trackId: string;
  startTime: number;
  endTime: number;
  assetId?: Asset;
  metadata: Record<string, any>;
  volume?: number;
  opacity?: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
}

export interface IVideoTimelineItem extends ITimelineItemBase {
  type: "video";
  assetId: Asset;
  sourceStartTime: number;
  sourceEndTime: number;
  speed: number;
}

export interface IAudioTimelineItem extends ITimelineItemBase {
  type: "audio";
  assetId: Asset;
  sourceStartTime: number;
  sourceEndTime: number;
  speed: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface ITextTimelineItem extends ITimelineItemBase {
  type: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  animationIn?: TextAnimationType;
  animationOut?: TextAnimationType;
}

type ITimelineItem =
  | IVideoTimelineItem
  | IAudioTimelineItem
  | ITextTimelineItem;

export interface ITrack {
  _id: string;
  type: TrackType;
  projectId: string;
  timelineId: string;
  order: number;
  locked: boolean;
  muted: boolean;
  items: ITimelineItem[];
}

export type VideoGenerationRequest = {
  id: string;
  prompt: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  projectId: string;
  createdAt: Date;
  completedAt?: Date;
  videoUrl?: string;
  error?: string;
};

export type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  assetId?: any; // Add asset property
  metadata?: {
    tokens?: number;
    model?: string;
    processingTime?: number;
  };
};

export const messageActions = {
  createMessage: (
    content: string,
    role: Message["role"],
    assetId?: any
  ): Message => ({
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content,
    role,
    timestamp: new Date(),
    assetId, // Add asset parameter
  }),

  createVideoGenerationRequest: (
    prompt: string,
    projectId: string
  ): VideoGenerationRequest => ({
    id: `req_${Date.now()}`,
    prompt,
    status: "pending",
    progress: 0,
    projectId,
    createdAt: new Date(),
  }),
};
