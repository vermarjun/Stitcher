// API Response Types
// This file contains all type definitions for API responses from the backend

// ============================================================================
// Generic API Response Wrapper
// ============================================================================

export interface ApiResponse<T = any> {
    success?: boolean;
    message?: string;
    data?: T;
    error?: string;
}

export interface ApiErrorResponse {
    message: string;
    error?: string;
}

// ============================================================================
// User Types
// ============================================================================

export interface IUserStats {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    totalViews: number;
    followersCount: number;
    followingCount: number;
    lastUpdated: Date;
}

export interface IPayment {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    plan: string;
    amount: number;
    createdAt: Date;
    status: "created" | "paid" | "failed" | "refunded";
}

export interface IUser {
    _id: string;
    username: string;
    email: string;
    usedOAuth?: boolean;
    profilePhoto: string;
    profileBanner: string;
    lastActive: Date;
    createdAt: Date | string;
    isActive: boolean;
    bio: string;
    role: {
        type: string;
        enum: ['user', 'admin'];
    };
    plan: 'free' | 'basic' | 'plus' | 'max';
    credits: {
        generation: number;
        editing: number;
        expiresAt: Date;
    };
    isTestAccount: boolean;
    invitedBy?: string;
    invitationCode?: string;
    payments?: IPayment[];
    projects?: string[];
    communityPosts?: string[];
    likedPosts?: string[];
    aura: number;
    stats: IUserStats;
    followers: string[];
    following: string[];
}

export interface AuthResponse {
    token: string;
    user: IUser;
    message?: string;
}

export interface UserCreditsResponse {
    success: boolean;
    message: {
        plan: string;
        credits: {
            generation: number;
            editing: number;
            expiresAt: Date;
        };
    };
}

// ============================================================================
// Project Types
// ============================================================================

export interface IProject {
    _id: string;
    name: string;
    timeline: string | ITimeline;
    edit_chat: string;
    bytes: number;
    compiled: boolean;
    playback_url: string;
    preview_url?: string;
    project_script: string;
    status: 'draft' | 'in_progress' | 'compiled' | 'error';
    createdAt: Date;
    updatedAt: Date;
}

// ============================================================================
// Timeline Types
// ============================================================================

export interface IResolution {
    width: number;
    height: number;
}

export interface ITimeline {
    _id: string;
    projectId: string;
    tracks: string[] | ITrack[];
    duration: number;
    fps: number;
    resolution: IResolution;
    snapToGrid?: boolean;
    gridSize?: number;
    zoom?: number;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================================================
// Track Types
// ============================================================================

export enum TrackType {
    VIDEO = 'video',
    AUDIO = 'audio',
    TEXT = 'text'
}

export interface ITrack {
    _id: string;
    type: TrackType;
    projectId: string;
    timelineId: string;
    order: number;
    locked: boolean;
    muted: boolean;
    items: string[] | ITimelineItem[];
    createdAt: Date;
    updatedAt: Date;
}

// ============================================================================
// Timeline Item Types
// ============================================================================

export interface ITimelineItemBase {
    _id: string;
    type: "video" | "audio" | "text";
    trackId: string;
    startTime: number;
    endTime: number;
    assetId?: string | IAsset;
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
    assetId: string | IAsset;
    sourceStartTime: number;
    sourceEndTime: number;
    speed: number;
}

export interface IAudioTimelineItem extends ITimelineItemBase {
    type: "audio";
    assetId: string | IAsset;
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
    animationIn?: string;
    animationOut?: string;
}

export type ITimelineItem =
    | IVideoTimelineItem
    | IAudioTimelineItem
    | ITextTimelineItem;

// ============================================================================
// Asset Types
// ============================================================================

export enum AssetType {
    VIDEO = 'video',
    AUDIO = 'audio'
}

export enum AssetOrigin {
    TEMPLATE = 'template',
    UPLOAD = 'upload',
    GENERATED_VIDEO = 'generated_video'
}

export interface IAsset {
    _id: string;
    name: string;
    type: AssetType;
    code?: string;
    scene_name?: string;
    scene_description?: string;
    origin: AssetOrigin;
    url: string;
    thumbnail: string;
    duration?: number;
    width?: number;
    height?: number;
    bytes: number;
    metadata: Record<string, any>;
    projectId: string;
    isOnTimeline: boolean;
    originalTemplateId?: string;
    createdAt: string;
    updatedAt: string;
    isAddedToBackpack?: boolean;
}

export interface CloudinaryUploadParams {
    signature: string;
    cloudName: string;
    apiKey: string;
    uploadParams: Record<string, any>;
}

// ============================================================================
// Template Types
// ============================================================================

export enum TemplateType {
    VIDEO = 'video',
    AUDIO = 'audio'
}

export interface ITemplate {
    _id: string;
    title: string;
    post_description?: string;
    type: TemplateType;
    thumbnail?: string;
    url: string;
    duration?: number;
    bytes: number;
    metadata: Record<string, any>;
    scene_name?: string;
    scene_description?: string;
    code?: string;
    likesCount?: number;
    isLikedByUser?: boolean;
    isInProject?: boolean;
    projectAssetId?: string;
    createdAt?: string;
    updatedAt?: string;
}

// ============================================================================
// Backpack Types
// ============================================================================

export enum BackpackItemType {
    ASSET = 'Asset',
    TEMPLATE = 'Template'
}

export enum BackpackItemSource {
    PROJECT = 'project',
    COMMUNITY_POST = 'community_post',
    TEMPLATE_LIBRARY = 'template_library'
}

export interface IBackpackItem {
    _id: string;
    itemType: BackpackItemType;
    itemId: string | IAsset | ITemplate;
    favourite: boolean;
    source: BackpackItemSource;
    sourceId?: string;
    tags: string[];
    notes?: string;
    addedAt: Date;
}

export interface IBackpack {
    _id: string;
    userId: string;
    items: IBackpackItem[];
    totalItems: number;
    totalBytes: number;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================================================
// API Keys Types
// ============================================================================

export interface IApiKey {
    _id: string;
    userId: string;
    agentId: string;
    agentName: string;
    keyValue: string;
    baseUrl: string;
    modelName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
    type: 'project' | 'asset' | 'template' | 'user';
    id: string;
    title: string;
    description?: string;
    thumbnail?: string;
    url?: string;
}

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentOrderResponse {
    id: string;
    amount: number;
    currency: string;
    receipt?: string;
}

export interface PaymentVerificationResponse {
    success: boolean;
    message: string;
    plan?: string;
    credits?: {
        generation: number;
        editing: number;
    };
}

// ============================================================================
// Generation & Chat Types
// ============================================================================

export interface GenerationResponse {
    success: boolean;
    message: string;
    jobId?: string;
    status?: string;
}

export interface ChatMessage {
    _id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}

// ============================================================================
// Upload Response Types
// ============================================================================

export interface UploadResponse {
    success: boolean;
    message: string;
    url?: string;
    thumbnail?: string;
    assetId?: string;
}

export interface ProfilePhotoUploadResponse {
    message: string;
    profilePhoto: string;
}

export interface ProfileBannerUploadResponse {
    message: string;
    profileBanner: string;
}
