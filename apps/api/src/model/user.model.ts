import { Document, Schema, Model, model, Types } from 'mongoose';

// Interface for OAuth credentials
interface IOAuthCredentials {
  provider: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
}

// Interface for user stats
export interface IUserStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  followersCount: number;
  followingCount: number;
  lastUpdated: Date;
}

// Interface representing a User document in MongoDB
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  oAuthCredentials?: IOAuthCredentials[];
  profilePhoto: string;
  profileBanner: string; 
  lastActive: Date;
  createdAt: Date;
  isActive: boolean;
  bio: string;
  role: 'user' | 'admin';
  plan: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  projects?: Types.ObjectId[];
  communityPosts?: Types.ObjectId[];
  likedPosts?: Types.ObjectId[];
  aura: number;
  stats: IUserStats;
  followers: Types.ObjectId[];
  following: Types.ObjectId[];
}

const UserStatsSchema = new Schema<IUserStats>({
  totalPosts: { type: Number, default: 0, min: 0 },
  totalLikes: { type: Number, default: 0, min: 0 },
  totalComments: { type: Number, default: 0, min: 0 },
  totalViews: { type: Number, default: 0, min: 0 },
  followersCount: { type: Number, default: 0, min: 0 },
  followingCount: { type: Number, default: 0, min: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  oAuthCredentials: [{
    provider: { type: String, required: true },
    providerId: { type: String, required: true },
    accessToken: { type: String },
    refreshToken: { type: String }
  }],
  profilePhoto: {
    type: String,
    default: 'https://www.gravatar.com/avatar/?d=mp',
  },
  profileBanner: {
    type: String,
    default: '', 
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  bio: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'test_account'],
    default: 'user',
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  projects: [{
    type: Schema.Types.ObjectId,
    ref: 'Project',
  }],
  communityPosts: [{ 
    type: Schema.Types.ObjectId, 
    required: true,
    default: [],
    ref: 'CommunityPost' 
  }],
  likedPosts: [{ 
    type: Schema.Types.ObjectId, 
    required: true,
    default: [],
    ref: 'CommunityPost' 
  }],
  aura: {
    type: Number,
    default: 0,
    index: true
  },
  stats: {
    type: UserStatsSchema,
    default: () => ({
      totalPosts: 0,
      totalLikes: 0,
      totalComments: 0,
      totalViews: 0,
      followersCount: 0,
      followingCount: 0,
      lastUpdated: new Date()
    })
  },
  followers: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  following: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }]
}, { timestamps: true });

// Indexes for efficient leaderboard queries
UserSchema.index({ aura: -1, isActive: 1 });
UserSchema.index({ 'stats.totalPosts': -1 });
UserSchema.index({ 'stats.totalLikes': -1 });
UserSchema.index({ 'stats.totalViews': -1 });

// Indexes for follow system
UserSchema.index({ followers: 1 });
UserSchema.index({ following: 1 });
UserSchema.index({ 'stats.followersCount': -1 });
UserSchema.index({ 'stats.followingCount': -1 });

const User: Model<IUser> = model<IUser>('User', UserSchema);
export default User;