import User from '../model/user.model';
import CommunityPost from '../model/communityPost.model';
import { Types } from 'mongoose';

export const AURA_POINTS = {
  VIEW: 5,
  LIKE: 10,
  COMMENT: 20
};

/**
 * Recalculates and updates a user's total aura based on all their community posts
 */
export async function recalculateUserAura(userId: Types.ObjectId | string): Promise<number> {
  const posts = await CommunityPost.find({ authorId: userId });
  
  let totalAura = 0;
  
  for (const post of posts) {
    totalAura += post.analytics.views * AURA_POINTS.VIEW;
    totalAura += post.likesCount * AURA_POINTS.LIKE;
    totalAura += post.commentsCount * AURA_POINTS.COMMENT;
  }
  
  await User.findByIdAndUpdate(userId, { aura: totalAura });
  
  return totalAura;
}

/**
 * Increments a user's aura by a specific amount
 */
export async function incrementUserAura(
  userId: Types.ObjectId | string, 
  amount: number
): Promise<void> {
  await User.findByIdAndUpdate(
    userId,
    { $inc: { aura: amount } },
    { new: true }
  );
}

/**
 * Gets top N users by aura for leaderboard
 */
export async function getTopUsersByAura(limit: number = 5) {
  return await User.find({ isActive: true })
    .sort({ aura: -1 })
    .limit(limit)
    .select('username profilePhoto aura bio')
    .lean();
}