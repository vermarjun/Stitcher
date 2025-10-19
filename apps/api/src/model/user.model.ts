import { Document, Schema, Model, model, Types } from 'mongoose';

// Interface for OAuth credentials
interface IOAuthCredentials {
  provider: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
}

// Interface representing a User document in MongoDB
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  oAuthCredentials?: IOAuthCredentials[];
  profilePhoto: string;
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
}

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
  }]
},{ timestamps: true });

// Create the User model
const User: Model<IUser> = model<IUser>('User', UserSchema);

export default User;