import { Schema, Document, Types, Model, model } from "mongoose";

// Interface for likes
export interface ILike {
  userId: Types.ObjectId;
  createdAt: Date;
}

// Interface for comments
export interface IComment {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
  likes: Types.ObjectId[]; // User IDs who liked the comment
  parentCommentId?: Types.ObjectId; // For nested replies
}

// Interface for community post analytics
export interface IPostAnalytics {
  views: number;
  uniqueViews: number;
  saves: number;
}

export interface ICommunityPostMethods {
  addLike(userId: Types.ObjectId): void;
  removeLike(userId: Types.ObjectId): void;
  addComment(userId: Types.ObjectId, content: string, parentCommentId?: Types.ObjectId): Types.ObjectId;
  incrementView(isUnique?: boolean): void;
}

// Main CommunityPost interface
export interface ICommunityPost extends Document {
  // Core references
  assetId: Types.ObjectId; //In future I will make this an array
  authorId: Types.ObjectId;
  
  // Post content
  title: string;
  description?: string;
  tags: string[];
  
  // Engagement metrics
  likes: ILike[];
  likesCount: number;
  comments: IComment[];
  commentsCount: number;
  
  // Analytics
  analytics: IPostAnalytics;
  
  // Timestamps
  publishedAt: Date;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LikeSchema = new Schema<ILike>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const CommentSchema = new Schema<IComment>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 2000 },
  isEdited: { type: Boolean, default: false },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  parentCommentId: { type: Schema.Types.ObjectId, ref: 'Comment' }
}, { timestamps: true });

const PostAnalyticsSchema = new Schema<IPostAnalytics>({
  views: { type: Number, default: 0 },
  uniqueViews: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
}, { _id: false });

export type CommunityPostModel = Model<ICommunityPost, {}, ICommunityPostMethods>;

const CommunityPostSchema = new Schema<ICommunityPost, CommunityPostModel, ICommunityPostMethods>({
  // Core references
  assetId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Asset', 
    required: true,
    index: true 
  },
  authorId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  
  // Post content
  title: { 
    type: String, 
    required: true,
    maxlength: 200,
    trim: true 
  },
  description: { 
    type: String, 
    maxlength: 5000,
    trim: true 
  },
  tags: [{ 
    type: String, 
    lowercase: true,
    trim: true,
    maxlength: 50 
  }],

  // Engagement metrics
  likes: [LikeSchema],
  likesCount: { type: Number, default: 0, index: true },
  comments: [CommentSchema],
  commentsCount: { type: Number, default: 0 },
  
  // Analytics
  analytics: { 
    type: PostAnalyticsSchema, 
    default: () => ({
      views: 0,
      uniqueViews: 0,
      shares: 0,
      downloads: 0,
      clickThroughs: 0
    })
  },
  
  // Activity tracking
  publishedAt: { type: Date, default: Date.now, index: true },
  lastActivityAt: { type: Date, default: Date.now, index: true }
}, { 
  timestamps: true,
  // Enable optimistic concurrency control for high-traffic updates
  optimisticConcurrency: true 
});

// Compound indexes for common queries
CommunityPostSchema.index({ status: 1, visibility: 1, publishedAt: -1 });
CommunityPostSchema.index({ authorId: 1, status: 1, publishedAt: -1 });
CommunityPostSchema.index({ tags: 1, status: 1, likesCount: -1 });
CommunityPostSchema.index({ isFeatured: 1, publishedAt: -1 });
CommunityPostSchema.index({ likesCount: -1, publishedAt: -1 }); // For trending posts
CommunityPostSchema.index({ 'analytics.views': -1, publishedAt: -1 }); // For popular posts

// Text index for search
CommunityPostSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Pre-save middleware to update counts
CommunityPostSchema.pre('save', function(next) {
  if (this.isModified('likes')) {
    this.likesCount = this.likes.length;
  }
  if (this.isModified('comments')) {
    this.commentsCount = this.comments.length;
  }
  next();
});

// Instance methods for engagement
CommunityPostSchema.methods.addLike = function(userId: Types.ObjectId) {
  const existingLike = this.likes.find(
    (like: ILike) => like.userId.toString() === userId.toString()
  );
  
  if (!existingLike) {
    this.likes.push({ userId, createdAt: new Date() });
    this.likesCount = this.likes.length;
    this.lastActivityAt = new Date();
  }
};

CommunityPostSchema.methods.removeLike = function(userId: Types.ObjectId) {
  this.likes = this.likes.filter(
    (like: ILike) => like.userId.toString() !== userId.toString()
  );
  this.likesCount = this.likes.length;
  this.lastActivityAt = new Date();
};

CommunityPostSchema.methods.addComment = function(
  userId: Types.ObjectId, 
  content: string,
  parentCommentId?: Types.ObjectId
) {
  const comment: IComment = {
    _id: new Types.ObjectId(),
    userId,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
    isEdited: false,
    likes: [],
    parentCommentId
  } as IComment;
  
  this.comments.push(comment);
  this.commentsCount = this.comments.length;
  this.lastActivityAt = new Date();
  
  return comment._id;
};

CommunityPostSchema.methods.incrementView = function(isUnique: boolean = false) {
  this.analytics.views += 1;
  if (isUnique) {
    this.analytics.uniqueViews += 1;
  }
};

const CommunityPost: CommunityPostModel = model<ICommunityPost, CommunityPostModel>(
  'CommunityPost', 
  CommunityPostSchema
);

export default CommunityPost;