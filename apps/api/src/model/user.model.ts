import { Document, Schema, Model, model, Types } from 'mongoose';

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

export interface IPayment {
  razorpayPaymentId: String,
  razorpayOrderId: String,
  plan: String,
  amount: Number,
  createdAt: Date
  status: {
    type: String,
    enum: ["created", "paid", "failed", "refunded"],
    default: "created"
  },
}

// Interface representing a User document in MongoDB
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  // oAuthCredentials?: IOAuthCredentials[]; Removed this field, it is kinda senseless
  // If user uses password to signup -> they can use both OAuth as well as password to login but if they used OAuth to signup they can't use password to login they must use OAuth only to login
  usedOAuth?: boolean; //Added this instead, it makes more sense so that if user tries to login with password, I can tell them that no you used OAuth go with that only
  profilePhoto: string;
  profileBanner: string;
  lastActive: Date;
  createdAt: Date;
  isActive: boolean;
  bio: string;
  role: {
    type: String;
    enum: ['user', 'admin']
  }
  plan: 'free' | 'basic' | 'plus' | 'max';
  credits: {
    generation: number;
    editing: number;
    expiresAt: Date
  };
  isTestAccount: boolean;
  invitedBy?: Types.ObjectId;
  invitationCode?: string;
  payments: IPayment[],
  resetPasswordToken?: string;
  resetPasswordExpires?: Date | number;
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
    required: false, // oauth me password nahi hoga
  },
  usedOAuth: {
    type: Boolean,
    required: false // old users might not have this field
  },
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
    enum: ['user', 'admin'],
    default: 'user',
  },
  isTestAccount: {
    type: Boolean,
    default: false
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'plus', 'max'],
    default: 'free'
  },
  credits: {
    generation: { type: Number, default: 5 },
    editing: { type: Number, default: 10 },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
  },
  payments: [
    {
      razorpayPaymentId: { type: String },
      razorpayOrderId: { type: String },
      plan: { type: String },
      amount: { type: Number },
      createdAt: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ["created", "paid", "failed", "refunded"],
        default: "created"
      },
    }
  ],
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