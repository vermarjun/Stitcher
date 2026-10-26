import { Document, Schema, Model, model, Types } from 'mongoose';

// A single long-term memory point — a free-form preference the system has
// learned about the user (e.g. "prefers a white background"). Each point has a
// stable id so the reflect() agent can target it for update/forget.
export interface IMemoryPoint {
  id: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
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
  lastActive: Date;
  createdAt: Date;
  isActive: boolean;
  bio: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date | number;
  // Email verification. emailVerified defaults false for password signups and
  // true for OAuth (Google already verifies the address). The token is consumed
  // on the verify endpoint and cleared after use.
  emailVerified?: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date | number;
  projects?: Types.ObjectId[];
  memory: IMemoryPoint[];
  // Timestamp of when the user finished (or skipped) the one-time product tour.
  // null/absent => never seen it => show the tour once. Set once, never reset.
  onboardingTourCompletedAt?: Date | null;
}

const MemoryPointSchema = new Schema<IMemoryPoint>({
  id: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
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
  projects: [{
    type: Schema.Types.ObjectId,
    ref: 'Project',
  }],
  memory: {
    type: [MemoryPointSchema],
    default: []
  },
  // One-time product tour: null until the user finishes or skips it.
  onboardingTourCompletedAt: {
    type: Date,
    default: null
  },
  // ── Password reset ──────────────────────────────────────────────────────
  // These were declared on IUser but never defined on the schema, so under
  // Mongoose strict mode they were silently dropped on save. Defined here so
  // the reset token actually persists and the reset flow can match it.
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  // ── Email verification ────────────────────────────────────────────────────
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
  },
  emailVerificationExpires: {
    type: Date,
  }
}, { timestamps: true });

const User: Model<IUser> = model<IUser>('User', UserSchema);
export default User;