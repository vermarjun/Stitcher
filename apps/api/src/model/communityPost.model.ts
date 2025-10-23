import { Schema, Document, Types, Model, model } from "mongoose";
import { 
  incrementUserLikeCount, 
  decrementUserLikeCount,
  incrementUserCommentCount,
  decrementUserCommentCount,
  incrementUserViewCount
} from '../util/auraupdate.util';

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
  likes: Types.ObjectId[];
  parentCommentId?: Types.ObjectId;
}

// Interface for community post analytics
export interface IPostAnalytics {
  views: number;
  uniqueViews: number;
  saves: number;
}

export interface ICommunityPostMethods {
  addLike(userId: Types.ObjectId): Promise<void>;
  removeLike(userId: Types.ObjectId): Promise<void>;
  addComment(userId: Types.ObjectId, content: string, parentCommentId?: Types.ObjectId): Promise<Types.ObjectId>;
  incrementView(isUnique?: boolean): Promise<void>;
}

// Main CommunityPost interface
export interface ICommunityPost extends Document {
  assetId: Types.ObjectId;
  authorId: Types.ObjectId;
  title: string;
  description?: string;
  tags: string[];
  likes: ILike[];
  likesCount: number;
  comments: IComment[];
  commentsCount: number;
  analytics: IPostAnalytics;
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
  likes: [LikeSchema],
  likesCount: { type: Number, default: 0, index: true },
  comments: [CommentSchema],
  commentsCount: { type: Number, default: 0 },
  analytics: { 
    type: PostAnalyticsSchema, 
    default: () => ({
      views: 0,
      uniqueViews: 0,
      saves: 0
    })
  },
  publishedAt: { type: Date, default: Date.now, index: true },
  lastActivityAt: { type: Date, default: Date.now, index: true }
}, { 
  timestamps: true,
  optimisticConcurrency: true 
});

// Compound indexes for common queries
CommunityPostSchema.index({ status: 1, visibility: 1, publishedAt: -1 });
CommunityPostSchema.index({ authorId: 1, status: 1, publishedAt: -1 });
CommunityPostSchema.index({ tags: 1, status: 1, likesCount: -1 });
CommunityPostSchema.index({ isFeatured: 1, publishedAt: -1 });
CommunityPostSchema.index({ likesCount: -1, publishedAt: -1 });
CommunityPostSchema.index({ 'analytics.views': -1, publishedAt: -1 });
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

// UPDATED: Add like and update user's cached stats
CommunityPostSchema.methods.addLike = async function(userId: Types.ObjectId) {
  const existingLike = this.likes.find(
    (like: ILike) => like.userId.toString() === userId.toString()
  );
  
  if (!existingLike) {
    this.likes.push({ userId, createdAt: new Date() });
    this.likesCount = this.likes.length;
    this.lastActivityAt = new Date();
    
    // Increment author's aura AND cached stats
    await incrementUserLikeCount(this.authorId);
  }
};

// UPDATED: Remove like and update user's cached stats
CommunityPostSchema.methods.removeLike = async function(userId: Types.ObjectId) {
  const previousLength = this.likes.length;
  this.likes = this.likes.filter(
    (like: ILike) => like.userId.toString() !== userId.toString()
  );
  
  if (this.likes.length < previousLength) {
    this.likesCount = this.likes.length;
    this.lastActivityAt = new Date();
    
    // Decrement author's aura AND cached stats
    await decrementUserLikeCount(this.authorId);
  }
};

// UPDATED: Add comment and update user's cached stats
CommunityPostSchema.methods.addComment = async function(
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
  
  // Increment author's aura AND cached stats
  await incrementUserCommentCount(this.authorId);
  
  return comment._id;
};

// UPDATED: Increment view and update user's cached stats
CommunityPostSchema.methods.incrementView = async function(isUnique: boolean = false) {
  this.analytics.views += 1;
  if (isUnique) {
    this.analytics.uniqueViews += 1;
  }
  
  // Increment author's aura AND cached stats
  await incrementUserViewCount(this.authorId);
};

const CommunityPost: CommunityPostModel = model<ICommunityPost, CommunityPostModel>(
  'CommunityPost', 
  CommunityPostSchema
);

export default CommunityPost;