import { Request, Response } from 'express';
import User from '../model/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendSignupOtpEmail,
  sendPasswordResetEmail,
} from '../email/email.service';
import { pubClient } from '../queue/connection';
import { JWT_CONFIG, PASSWORD_RESET_CONFIG, EMAIL_VERIFICATION_CONFIG, API_PREFIX, PUBLIC_APP_URL } from '../config';
import { storage } from '../storage';
import fs from 'fs';
import { getOAuth2Client } from '../util/googleClient.util';
import axios from 'axios';
import { IUser } from '../model/user.model';

interface IUserRequest extends Request {
  userId?: string;
  body: {
    username?: string;
    email?: string;
    password?: string;
    currentPassword?: string;
    newPassword?: string;
    bio?: string;
    [key: string]: any;
  };
}

interface IUserResponse extends Response {
  [key: string]: any;
}

interface IGoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

// Generates a fresh email-verification token and stamps it (+ expiry) onto the
// (unsaved) user document. Caller is responsible for persisting. Returns the
// raw token to embed in the verification link.
function issueEmailVerificationToken(user: IUser): string {
  const token = crypto.randomBytes(EMAIL_VERIFICATION_CONFIG.tokenLength).toString('hex');
  user.emailVerificationToken = token;
  user.emailVerificationExpires = Date.now() + EMAIL_VERIFICATION_CONFIG.tokenExpiry;
  return token;
}

// Absolute URL of the API verify endpoint (which verifies, then redirects the
// browser back to the app). Built from the request host so it works across
// environments without extra config.
function buildVerifyUrl(req: Request, token: string): string {
  return `${req.protocol}://${req.get('host')}${API_PREFIX}/users/verify-email/${token}`;
}

// Public shape of a user returned by login/signup/google. Keep in sync with
// the web client's User type.
function publicUser(user: IUser) {
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    bio: user.bio,
    profilePhoto: user.profilePhoto,
    createdAt: user.createdAt,
    lastActive: user.lastActive,
    isActive: user.isActive,
    onboardingTourCompletedAt: user.onboardingTourCompletedAt ?? null,
  };
}

export const authWithGoogle = async (req: Request, res: Response) => {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.status(404).json({ error: "google_auth_disabled" });
  }

  const code = req.query.code;

  if (!code) {
    return res.status(400).json({ error: "no code provided" });
  }

  try {
    const googleRes = await oauth2Client.getToken(code as string);

    const userRes = await axios.get<IGoogleUser>(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`
    );

    const { email, name, picture } = userRes.data;

    // STEP 1: Clean username (remove all spaces completely)
    const cleanUsername = name.replace(/\s+/g, "").toLowerCase(); // ex: "Arjun Verma" -> "arjunverma"

    // STEP 2: Ensure username is unique
    let finalUsername = cleanUsername;
    let usernameExists = await User.findOne({ username: finalUsername });

    while (usernameExists) {
      // Generate random 4-digit suffix
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      finalUsername = `${cleanUsername}${randomSuffix}`;

      usernameExists = await User.findOne({ username: finalUsername });
    }

    // STEP 3: Find user by email
    let user: IUser | null = await User.findOne({ email });

    // STEP 4: If user is new (signup), use unique username
    if (!user) {
      user = new User({
        username: finalUsername,
        email,
        profilePhoto: picture,
        usedOAuth: true,
        // Google has already verified the address — no verification email needed.
        emailVerified: true,
      });

      await user.save();

      // Welcome the first-time OAuth signup (non-blocking).
      void sendWelcomeEmail({ to: user.email, username: user.username, appUrl: PUBLIC_APP_URL });
    }

    // Reject banned users before issuing a token.
    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been banned.", banned: true });
    }

    // ✅ STEP 5: Generate JWT
    const token = jwt.sign(
      { userId: user._id?.toString() },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn } as jwt.SignOptions
    );

    res.status(200).json({
      message: "success",
      token,
      user: publicUser(user)
    });

  } catch (err) {
    console.log("OAuth Error:", err);
    res.status(500).json({
      message: "I'm sorry, OAuth failed somehow. Please try again."
    });
  }
};


// ─── OTP-gated signup (email + password) ──────────────────────────────────────
// No User doc is created until the email is verified by OTP. The pending
// registration (username, email, bcrypt hash, code) lives in Redis with a 10-min
// TTL, so abandoned signups self-clean and never leave half-built accounts.
const SIGNUP_OTP_TTL_SECONDS = 600; // 10 minutes
const SIGNUP_OTP_MAX_ATTEMPTS = 5;
const signupOtpKey = (email: string): string => `signup:otp:${email}`;

function sixDigitCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

interface PendingSignup { username: string; email: string; passwordHash: string; code: string; attempts: number; }

// POST /users/signup/start — validate, stash a pending registration in Redis, email an OTP.
export const startSignup = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { password } = req.body;
    let { username, email } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    username = username.trim();
    email = email.trim().toLowerCase();
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'Email already exists. Try logging in instead.' });
    }
    if (await User.findOne({ username })) {
      return res.status(409).json({ message: 'Username already taken. Try a different one.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const code = sixDigitCode();
    const pending: PendingSignup = { username, email, passwordHash, code, attempts: 0 };
    await pubClient.set(signupOtpKey(email), JSON.stringify(pending), 'EX', SIGNUP_OTP_TTL_SECONDS);

    // Fire-and-forget via the email queue (the worker sends within ~1s).
    void sendSignupOtpEmail({ to: email, username, code });

    return res.status(200).json({ message: 'otp_sent', email });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /users/signup/verify — check the OTP, then create the account and log in.
export const verifySignupOtp = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    let { email, code } = req.body as { email?: string; code?: string };
    email = email?.trim().toLowerCase();
    code = String(code ?? '').trim();
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required.' });
    }

    const raw = await pubClient.get(signupOtpKey(email));
    if (!raw) {
      return res.status(400).json({ message: 'Your code expired. Please start signup again.' });
    }
    const pending = JSON.parse(raw) as PendingSignup;

    if (pending.code !== code) {
      pending.attempts += 1;
      if (pending.attempts >= SIGNUP_OTP_MAX_ATTEMPTS) {
        await pubClient.del(signupOtpKey(email));
        return res.status(429).json({ message: 'Too many incorrect attempts. Please start signup again.' });
      }
      const ttl = await pubClient.ttl(signupOtpKey(email));
      await pubClient.set(signupOtpKey(email), JSON.stringify(pending), 'EX', ttl > 0 ? ttl : SIGNUP_OTP_TTL_SECONDS);
      return res.status(400).json({ message: 'Incorrect code. Please try again.', attemptsLeft: SIGNUP_OTP_MAX_ATTEMPTS - pending.attempts });
    }

    // Race/double-submit guard: re-check uniqueness at creation time.
    if (await User.findOne({ email })) {
      await pubClient.del(signupOtpKey(email));
      return res.status(409).json({ message: 'Email already exists. Try logging in instead.' });
    }

    const user = new User({
      username: pending.username,
      email: pending.email,
      password: pending.passwordHash,
      usedOAuth: false,
      emailVerified: true,
    });
    await user.save();
    await pubClient.del(signupOtpKey(email));

    void sendWelcomeEmail({ to: user.email, username: user.username, appUrl: PUBLIC_APP_URL });

    const token = jwt.sign(
      { userId: user._id?.toString() },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn } as jwt.SignOptions
    );
    return res.status(201).json({
      token,
      user: publicUser(user),
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /users/signup/resend — re-issue a fresh OTP for an in-flight signup.
export const resendSignupOtp = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    let { email } = req.body as { email?: string };
    email = email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const raw = await pubClient.get(signupOtpKey(email));
    if (!raw) return res.status(400).json({ message: 'Your session expired. Please start signup again.' });

    const pending = JSON.parse(raw) as PendingSignup;
    pending.code = sixDigitCode();
    pending.attempts = 0;
    await pubClient.set(signupOtpKey(email), JSON.stringify(pending), 'EX', SIGNUP_OTP_TTL_SECONDS);
    void sendSignupOtpEmail({ to: email, username: pending.username, code: pending.code });

    return res.status(200).json({ message: 'otp_resent', email });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const login = async (req: IUserRequest, res: Response): Promise<Response> => {
  try {
    const { password } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    // Validate fields
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Find user by email
    const user: IUser | null = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "User not found!" });
    }

    if (user.usedOAuth) {
      return res.status(401).json({ message: "This account uses Google OAuth. Please login using Google." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been banned.", banned: true });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id?.toString() },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn } as jwt.SignOptions
    );

    // Update last active timestamp
    user.lastActive = new Date();
    await user.save();

    // Return user data (only public info)
    return res.status(200).json({
      token,
      user: publicUser(user),
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getUser = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const user: IUser | null = await User.findById(req.userId).select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json(user);
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Marks the one-time product tour as completed (or skipped) for the current user.
// Idempotent: only stamps the timestamp the first time, so "completed once, ever"
// holds even if the client calls this more than once.
export const completeOnboardingTour = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (!user.onboardingTourCompletedAt) {
      user.onboardingTourCompletedAt = new Date();
      await user.save();
    }

    return res.status(200).json({
      success: true,
      onboardingTourCompletedAt: user.onboardingTourCompletedAt,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

export const updateUser = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const userId = req.userId;

    // Only these fields are editable here. Password has its own endpoint.
    const updates: Record<string, unknown> = {};
    for (const key of ['username', 'email', 'bio'] as const) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Fetch the current user
    const currentUser: IUser | null = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // Block username/email edits for OAuth-only accounts
    if (currentUser.usedOAuth) {
      if (updates.email) {
        return res.status(403).json({
          message: "Cannot edit Emails for Google OAuth accounts.",
        });
      }
    }

    // If username is being updated, enforce uniqueness
    if (updates.username && updates.username !== currentUser.username) {
      const existingUsername = await User.findOne({
        username: updates.username,
        _id: { $ne: userId }, // exclude current user
      });

      if (existingUsername) {
        return res.status(409).json({
          message: "Username already taken. Try a different one.",
        });
      }
    }

    const updatedUser: IUser | null = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.status(200).json(updatedUser);
  } catch (err: any) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const changePassword = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const uploadProfilePhoto = async (req: any, res: Response): Promise<Response> => {
  const tmpPath: string | undefined = req.file?.path;
  try {
    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const ext = (req.file.originalname.match(/\.[a-zA-Z0-9]{1,5}$/)?.[0] ?? '.jpg').toLowerCase();
    const stored = await storage.putFile(req.file.path, `profile_photos/${user._id}-${Date.now()}${ext}`, {
      contentType: req.file.mimetype,
    });

    user.profilePhoto = stored.url;
    await user.save();

    return res.status(200).json({
      message: 'Profile photo uploaded successfully.',
      profilePhoto: stored.url,
    });
  } catch (err: any) {
    return res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  } finally {
    if (tmpPath) fs.promises.unlink(tmpPath).catch(() => undefined);
  }
};

export const deleteUser = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const user: IUser | null = await User.findByIdAndDelete(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const requestPasswordReset = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const user: IUser | null = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const resetToken = crypto.randomBytes(PASSWORD_RESET_CONFIG.tokenLength).toString('hex');
    const resetTokenExpiry = Date.now() + PASSWORD_RESET_CONFIG.tokenExpiry;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    const resetLink = `${req.protocol}://${req.get('host')}${API_PREFIX}/users/reset-password/${resetToken}`;

    void sendPasswordResetEmail({ to: user.email, resetUrl: resetLink });

    return res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const resetPassword = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) return res.status(400).json({ message: 'Password is required.' });

    const user: IUser | null = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });

    user.password = await bcrypt.hash(password, 10);
    // Clear the OAuth-only flag: setting a password makes password login valid.
    // Without this, a Google-signup user who sets a password here would still be
    // blocked by login() ("This account uses Google OAuth"). They keep Google
    // login too — authWithGoogle doesn't depend on this flag.
    user.usedOAuth = false;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password reset successful.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/users/verify-email/:token
// Verifies the address and redirects the browser back to the app with
// ?emailVerified=1 (success) or =0 (invalid/expired). Opened directly from the
// link in the verification email.
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const appUrl = PUBLIC_APP_URL.replace(/\/$/, '');
  try {
    const { token } = req.params;

    const user = token
      ? await User.findOne({
          emailVerificationToken: token,
          emailVerificationExpires: { $gt: Date.now() },
        })
      : null;

    if (!user) {
      res.redirect(`${appUrl}/?emailVerified=0`);
      return;
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.redirect(`${appUrl}/?emailVerified=1`);
  } catch {
    res.redirect(`${appUrl}/?emailVerified=0`);
  }
};

// POST /api/users/resend-verification  { email }
// Re-issues a verification email. Always responds 200 with a generic message so
// the endpoint can't be used to probe which emails have accounts.
export const resendVerification = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    let { email } = req.body;
    email = email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const generic = {
      message: 'If that account exists and is unverified, a new verification email has been sent.',
    };

    const user: IUser | null = await User.findOne({ email });
    // No-op (but identical response) for: no account, already verified, or OAuth
    // accounts (which are verified by Google and have no password to protect).
    if (!user || user.emailVerified || user.usedOAuth) {
      return res.status(200).json(generic);
    }

    const token = issueEmailVerificationToken(user);
    await user.save();
    const verifyUrl = buildVerifyUrl(req, token);
    void sendVerificationEmail({ to: user.email, username: user.username, verifyUrl });

    return res.status(200).json(generic);
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
