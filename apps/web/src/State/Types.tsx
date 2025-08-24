export type Resolution = {
    width: Number,
    height: Number
}

export type Timeline = {
    _id: String;
    projectId: String;
    resolution: Resolution;
    tracks: any;
    duration: Number;
    fps: Number;
    gridSize: Number;
    snapToGrid: Boolean;
    zoom: Number;
    createdAt: Date;
    updatedAt: Date;
}

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
  status: 'draft' | 'processing' | 'completed' | 'error';
};

export type User = {
    id: string;
    username: string;
    email: string;
    plan: string,
    role: string,
    bio: string,
    profilePhoto: string
};

export enum TemplateType {
  VIDEO = 'video',
  AUDIO = 'audio',
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
}

export enum AssetType {
  VIDEO = "video",
  AUDIO = "audio",
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