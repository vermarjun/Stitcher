import { Request, Response } from 'express';
import User from '../model/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sendMail from '../util/mailer.util';
import { JWT_CONFIG, PASSWORD_RESET_CONFIG } from '../config';
import cloudinary from '../util/cloudinary.util';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { NotificationService } from '../util/notificationservice.util';

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

interface IUser {
  _id: string;
  username: string;
  email: string;
  password: string;
  bio?: string;
  profilePhoto?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: number;
  [key: string]: any;
}

export const signup = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ message: 'This username or email is taken, please try again with a different username or email' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    return res.status(201).json({ message: 'User created successfully.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const login = async (req: IUserRequest, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    // Validate fields
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Find user by email
    const user: IUser | null = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "User not found!" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString() },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn } as jwt.SignOptions
    );

    // Update last active timestamp
    user.lastActive = new Date();
    await user.save();

    // Return user data (only public info)
    return res.status(200).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        plan: user.plan,
        role: user.role,
        bio: user.bio,
        profilePhoto: user.profilePhoto,
        profileBanner: user.profileBanner,
        aura: user.aura,
        stats: user.stats,
        followersCount: user.stats?.followersCount || 0,
        followingCount: user.stats?.followingCount || 0,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        isActive: user.isActive,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getUser = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const user: IUser | null = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json(user);
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getUserProfile = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: 'User userId is required.' });
    }
    const user = await User.findById(userId)
      .select('username bio profilePhoto createdAt stats aura plan role likedPosts communityPosts followers following')
      .lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const userProfile = {
      _id: user._id.toString(),
      username: user.username,
      profilePhoto: user.profilePhoto || 'https://www.gravatar.com/avatar/?d=mp',
      bio: user.bio || '',
      createdAt: user.createdAt,
      stats: user.stats,
      plan: user.plan,
      role: user.role,
      communityPosts: user.communityPosts,
      likedPosts: user.likedPosts,
      aura: user.aura,
      followers: user.followers,
      following: user.following
    };
    return res.status(200).json(userProfile);
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const updateUser = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const updates = req.body;
    if (updates.password) delete updates.password; // Prevent password update here
    const user: IUser | null = await User.findByIdAndUpdate(
      req.userId, 
      updates, 
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json(user);
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
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
  try {
    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    
    // Use Promise wrapper for better async handling
    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'profile_photos', 
          public_id: user._id.toString(), 
          overwrite: true 
        },
        async (error, result) => {
          if (error || !result) {
            return resolve(
              res.status(500).json({ 
                message: 'Cloudinary upload failed.', 
                error 
              })
            );
          }
          
          // Update user profile photo
          user.profilePhoto = result.secure_url;
          await user.save();
          
          // ✅ Send notification to user about profile photo update
          try {
            await NotificationService.notifyProfileUpdate(
              new Types.ObjectId(user._id),
              'photo',
              'Your profile photo has been updated successfully! 📸',
              { 
                profilePhoto: result.secure_url,
                updatedAt: new Date()
              }
            );
          } catch (notifError) {
            // Log but don't fail the request if notification fails
            console.error('Failed to send profile update notification:', notifError);
          }
          
          return resolve(
            res.status(200).json({
              message: 'Profile photo uploaded successfully.',
              profilePhoto: result.secure_url,
            })
          );
        }
      );
      
      // Pipe file buffer into Cloudinary upload_stream
      uploadStream.end(req.file.buffer);
    });
  } catch (err: any) {
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
};

/**
 * Upload or update user profile banner
 */
export const uploadProfileBanner = async (req: any, res: Response): Promise<Response> => {
  try {
    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    
    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'profile_banners', 
          public_id: `banner_${user._id.toString()}`, 
          overwrite: true,
          transformation: [
            { width: 1500, height: 500, crop: 'fill' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        async (error, result) => {
          if (error || !result) {
            return resolve(
              res.status(500).json({ 
                message: 'Cloudinary upload failed.', 
                error 
              })
            );
          }
          
          user.profileBanner = result.secure_url;
          await user.save();
          
          try {
            await NotificationService.notifyProfileUpdate(
              new Types.ObjectId(user._id),
              'photo',
              'Your profile banner has been updated successfully! 🎨',
              { 
                profileBanner: result.secure_url,
                updatedAt: new Date()
              }
            );
          } catch (notifError) {
            console.error('Failed to send profile update notification:', notifError);
          }
          
          return resolve(
            res.status(200).json({
              message: 'Profile banner uploaded successfully.',
              profileBanner: result.secure_url,
            })
          );
        }
      );
      
      uploadStream.end(req.file.buffer);
    });
  } catch (err: any) {
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
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
    
    const resetLink = `${req.protocol}://${req.get('host')}/api/users/reset-password/${resetToken}`;
    
    await sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `Reset your password using this link: ${resetLink}`,
      html: `<p>You requested a password reset.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>If you did not request this, please ignore this email.</p>`,
    });
    
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
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    return res.status(200).json({ message: 'Password reset successful.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const followUser = async (req: IUserRequest, res: Response): Promise<Response> => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const currentUserId = req.userId;
      const targetUserId = req.params.userId;

      if (!currentUserId || !targetUserId) {
        throw new Error("User IDs are required.");
      }

      if (currentUserId === targetUserId) {
        throw new Error("You cannot follow yourself.");
      }

      const [currentUser, targetUser] = await Promise.all([
        User.findById(currentUserId).session(session),
        User.findById(targetUserId).session(session),
      ]);

      if (!currentUser || !targetUser) {
        throw new Error("User not found.");
      }

      if (currentUser.following.includes(targetUserId as any)) {
        throw new Error("You are already following this user.");
      }

      // ✅ run sequentially to avoid race conditions
      await User.findByIdAndUpdate(
        currentUserId,
        { 
          $addToSet: { following: targetUserId },
          $inc: { 'stats.followingCount': 1 },
        },
        { session }
      );

      const updatedTargetUser = await User.findByIdAndUpdate(
        targetUserId,
        { 
          $addToSet: { followers: currentUserId },
          $inc: { 'stats.followersCount': 1 },
        },
        { session }
      );

      if (updatedTargetUser) {
        // Store follower count for milestone check
        session.commitTransaction();
        
        // Send follow notification
        await NotificationService.notifyFollow(
          new Types.ObjectId(currentUserId),
          new Types.ObjectId(targetUserId)
        );
        
        // Check for milestone (10, 50, 100, 500, 1000, 5000, 10000 followers)
        const milestones = [10, 50, 100, 500, 1000, 5000, 10000];
        if (milestones.includes(updatedTargetUser.stats.followersCount)) {
          await NotificationService.notifyMilestone(
            new Types.ObjectId(targetUserId),
            'followers',
            updatedTargetUser.stats.followersCount
          );
        }
      }
    });

    return res.status(200).json({
      message: "Successfully followed user.",
      following: true,
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    session.endSession();
  }
};


/**
 * Unfollow a user
 * DELETE /api/users/:userId/unfollow
 */
export const unfollowUser = async (req: IUserRequest, res: Response): Promise<Response> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.userId;
    
    if (!currentUserId || !targetUserId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'User IDs are required.' });
    }
    
    if (currentUserId === targetUserId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid operation.' });
    }
    
    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId).session(session),
      User.findById(targetUserId).session(session)
    ]);
    
    if (!currentUser || !targetUser) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found.' });
    }
    
    // Check if actually following
    if (!currentUser.following.includes(targetUserId as any)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'You are not following this user.' });
    }
    
    // Remove from following/followers arrays and update counts
    await Promise.all([
      User.findByIdAndUpdate(
        currentUserId,
        { 
          $pull: { following: targetUserId },
          $inc: { 'stats.followingCount': -1 }
        },
        { session }
      ),
      User.findByIdAndUpdate(
        targetUserId,
        { 
          $pull: { followers: currentUserId },
          $inc: { 'stats.followersCount': -1 }
        },
        { session }
      )
    ]);
    
    await session.commitTransaction();
    
    return res.status(200).json({ 
      message: 'Successfully unfollowed user.',
      following: false
    });
  } catch (err: any) {
    await session.abortTransaction();
    return res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * Remove a follower from your followers list
 * DELETE /api/users/:userId/remove-follower
 */
export const removeFollower = async (req: IUserRequest, res: Response): Promise<Response> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const currentUserId = req.userId; // User removing the follower
    const followerUserId = req.params.userId; // Follower to be removed
    
    if (!currentUserId || !followerUserId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'User IDs are required.' });
    }
    
    if (currentUserId === followerUserId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid operation.' });
    }
    
    const [currentUser, followerUser] = await Promise.all([
      User.findById(currentUserId).session(session),
      User.findById(followerUserId).session(session)
    ]);
    
    if (!currentUser || !followerUser) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found.' });
    }
    
    // Check if this user is actually a follower
    if (!currentUser.followers.includes(followerUserId as any)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'This user is not following you.' });
    }
    
    // Remove from followers/following arrays and update counts
    await Promise.all([
      User.findByIdAndUpdate(
        currentUserId,
        { 
          $pull: { followers: followerUserId },
          $inc: { 'stats.followersCount': -1 }
        },
        { session }
      ),
      User.findByIdAndUpdate(
        followerUserId,
        { 
          $pull: { following: currentUserId },
          $inc: { 'stats.followingCount': -1 }
        },
        { session }
      )
    ]);
    
    await session.commitTransaction();
    
    return res.status(200).json({ 
      message: 'Successfully removed follower.'
    });
  } catch (err: any) {
    await session.abortTransaction();
    return res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * Get list of followers for a user
 * GET /api/users/:userId/followers
 */
export const getFollowers = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }
    
    const user = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'username profilePhoto bio stats.followersCount stats.followingCount',
        options: { skip, limit }
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const totalFollowers = user.stats.followersCount || 0;
    const totalPages = Math.ceil(totalFollowers / limit);
    
    return res.status(200).json({
      followers: user.followers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: totalFollowers,
        hasMore: page < totalPages
      }
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * Get list of users that a user is following
 * GET /api/users/:userId/following
 */
export const getFollowing = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }
    
    const user = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'username profilePhoto bio stats.followersCount stats.followingCount',
        options: { skip, limit }
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const totalFollowing = user.stats.followingCount || 0;
    const totalPages = Math.ceil(totalFollowing / limit);
    
    return res.status(200).json({
      following: user.following,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: totalFollowing,
        hasMore: page < totalPages
      }
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * Check if current user follows a specific user
 * GET /api/users/:userId/follow-status
 */
export const checkFollowStatus = async (req: IUserRequest, res: Response): Promise<Response> => {
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.userId;
    
    if (!currentUserId || !targetUserId) {
      return res.status(400).json({ message: 'User IDs are required.' });
    }
    
    if (currentUserId === targetUserId) {
      return res.status(200).json({ 
        isFollowing: false,
        isOwnProfile: true
      });
    }
    
    const currentUser = await User.findById(currentUserId).select('following');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const isFollowing = currentUser.following.includes(targetUserId as any);
    
    return res.status(200).json({ 
      isFollowing,
      isOwnProfile: false
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * Get suggested users to follow
 * GET /api/users/suggestions/users
 */
export const getSuggestedUsers = async (req: IUserRequest, res: Response): Promise<Response> => {
  try {
    const currentUserId = req.userId;
    const limit = parseInt(req.query.limit as string) || 5;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const currentUser = await User.findById(currentUserId).select('following').lean();

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Combine the current user ID and the following list to exclude
    const excludedIds = [...(currentUser.following || []), currentUserId];

    // Option 1: Simple deterministic sorting
    const suggestedUsers = await User.find({
      _id: { $nin: excludedIds },
      isActive: true,
    })
      .select('username profilePhoto bio plan stats.followersCount stats.followingCount')
      .sort({ 'stats.followersCount': -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // Option 2 (optional): Add random fallback if too few suggestions
    if (suggestedUsers.length < limit) {
      const remaining = limit - suggestedUsers.length;
      const randomUsers = await User.aggregate([
        { $match: { _id: { $nin: excludedIds }, isActive: true } },
        { $sample: { size: remaining } },
        { $project: { username: 1, profilePhoto: 1, bio: 1, plan: 1, 'stats.followersCount': 1, 'stats.followingCount': 1 } }
      ]);

      suggestedUsers.push(...randomUsers);
    }

    return res.status(200).json({
      success: true,
      count: suggestedUsers.length,
      suggestions: suggestedUsers,
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

interface UserSearchResult {
  _id: string;
  username: string;
  profilePhoto?: string;
  plan?: string;
}

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
      return;
    }

    const searchQuery = q.trim();
    
    if (searchQuery.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Search query cannot be empty'
      });
      return;
    }

    // Search for users with username containing the query (case-insensitive)
    const users = await User.find({
      username: { $regex: searchQuery, $options: 'i' },
      isActive: true
    })
      .select('_id username profilePhoto plan')
      .limit(5)
      .lean()
      .exec();

    const searchResults: UserSearchResult[] = users.map(user => ({
      _id: user._id.toString(),
      username: user.username,
      profilePhoto: user.profilePhoto,
      plan: user.plan
    }));

    res.status(200).json({
      success: true,
      count: searchResults.length,
      data: searchResults
    });

  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while searching users',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};