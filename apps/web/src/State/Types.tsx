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

export interface IUserStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  followersCount: number;
  followingCount: number;
  lastUpdated: Date;
}

// This is what is stored in local storage
export type IUser = {
  _id: string;
  username?: string;
  email?: string;
  profilePhoto?: string;
  profileBanner?: string; 
  lastActive?: Date;
  createdAt?: string | Date;
  isActive?: boolean;
  bio: string;
  role?: string | 'user' | 'admin';
  plan?: 'free' | 'basic' | 'plus' | 'max';
  credits?: {
    generation: number;
    editing: number;
    expiresAt: Date | string | number;
  };
  isTestAccount?: boolean;
  projects?: string[];
  communityPosts?: string[];
  likedPosts?: string[];
  aura?: number;
  stats?: IUserStats;
  followers?: string[];
  following?: string[];
};

export enum TemplateType {
  VIDEO = "video",
  AUDIO = "audio",
}

export type Template = {
  _id: string;
  title: string;
  post_description?: string;
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
}

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
  code?: string;
  scene_name?:string;
  scene_description?:string;
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
  isAddedToBackpack?: boolean;
  waveformPeaks?: number[] | null;
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