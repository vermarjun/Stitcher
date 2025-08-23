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