// types.ts
export interface IUser {
  _id: string;
  username: string;
  profilePhoto?: string;
  bio?: string;
  createdAt: string;
}

export interface IAsset {
  _id: string;
  name: string;
  url: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
}

export interface IComment {
  _id: string;
  userId: IUser;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  likes: string[];
  isLiked?: boolean;
  parentCommentId?: string;
}

export interface ICommunityPost {
  _id: string;
  assetId: IAsset;
  authorId: IUser;
  title: string;
  description?: string;
  tags: string[];
  likes: { userId: string; createdAt: string }[];
  likesCount: number;
  comments: IComment[];
  commentsCount: number;
  analytics: {
    views: number;
    uniqueViews: number;
    saves: number;
  };
  publishedAt: string;
  isLiked?: boolean;
  isSavedByUser?: boolean;
  isAddedToBackpack?: boolean;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface LeaderboardUser {
  rank: number;
  username: string;
  posts: number;
  likes: number;
  avatar: string;
}

export interface TrendingTopic {
  tag: string;
  posts: number;
  trending: boolean;
}

export interface SuggestedCreator {
  username: string;
  followers: string;
  avatar: string;
  verified: boolean;
}