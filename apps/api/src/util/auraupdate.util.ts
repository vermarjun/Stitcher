import User from '../model/user.model';
import CommunityPost from '../model/communityPost.model';
import { Types } from 'mongoose';

export const AURA_POINTS = {
  VIEW: 5,
  LIKE: 10,
  COMMENT: 20
};

/**
 * Updates user stats when they receive a like
 * Increments both aura and like count atomically
 */
export async function incrementUserLikeCount(userId: Types.ObjectId | string): Promise<void> {
  await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        aura: AURA_POINTS.LIKE,
        'stats.totalLikes': 1 
      },
      $set: { 'stats.lastUpdated': new Date() }
    },
    { new: true }
  );
}

/**
 * Updates user stats when a like is removed
 * Decrements both aura and like count atomically
 */
export async function decrementUserLikeCount(userId: Types.ObjectId | string): Promise<void> {
  await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        aura: -AURA_POINTS.LIKE,
        'stats.totalLikes': -1 
      },
      $set: { 'stats.lastUpdated': new Date() }
    },
    { new: true }
  );
}

/**
 * Updates user stats when they receive a comment
 * Increments both aura and comment count atomically
 */
export async function incrementUserCommentCount(userId: Types.ObjectId | string): Promise<void> {
  await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        aura: AURA_POINTS.COMMENT,
        'stats.totalComments': 1 
      },
      $set: { 'stats.lastUpdated': new Date() }
    },
    { new: true }
  );
}

/**
 * Updates user stats when a comment is deleted
 * Decrements both aura and comment count atomically
 */
export async function decrementUserCommentCount(userId: Types.ObjectId | string): Promise<void> {
  await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        aura: -AURA_POINTS.COMMENT,
        'stats.totalComments': -1 
      },
      $set: { 'stats.lastUpdated': new Date() }
    },
    { new: true }
  );
}

/**
 * Updates user stats when they receive a view
 * Increments both aura and view count atomically
 */
export async function incrementUserViewCount(userId: Types.ObjectId | string): Promise<void> {
  await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        aura: AURA_POINTS.VIEW,
        'stats.totalViews': 1 
      },
      $set: { 'stats.lastUpdated': new Date() }
    },
    { new: true }
  );
}

/**
 * Updates user stats when a post is created
 * Increments post count
 */
export async function incrementUserPostCount(userId: Types.ObjectId | string): Promise<void> {
  await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 'stats.totalPosts': 1 },
      $set: { 'stats.lastUpdated': new Date() }
    },
    { new: true }
  );
}

/**
 * Updates user stats when a post is deleted
 * Decrements post count and adjusts aura/stats based on the post's engagement
 */
export async function decrementUserPostStats(
  userId: Types.ObjectId | string,
  post: { likesCount: number; commentsCount: number; analytics: { views: number } }
): Promise<void> {
  const auraLoss = 
    (post.analytics.views * AURA_POINTS.VIEW) +
    (post.likesCount * AURA_POINTS.LIKE) +
    (post.commentsCount * AURA_POINTS.COMMENT);

  await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        'stats.totalPosts': -1,
        'stats.totalLikes': -post.likesCount,
        'stats.totalComments': -post.commentsCount,
        'stats.totalViews': -post.analytics.views,
        aura: -auraLoss
      },
      $set: { 'stats.lastUpdated': new Date() }
    },
    { new: true }
  );
}

/**
 * Recalculates and updates a user's total aura and stats from scratch
 * Use this for data correction, migration, or fixing inconsistencies
 */
export async function recalculateUserAuraAndStats(userId: Types.ObjectId | string): Promise<void> {
  const posts = await CommunityPost.find({ authorId: userId });
  
  let totalAura = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalViews = 0;
  
  for (const post of posts) {
    totalViews += post.analytics.views;
    totalLikes += post.likesCount;
    totalComments += post.commentsCount;
    
    totalAura += post.analytics.views * AURA_POINTS.VIEW;
    totalAura += post.likesCount * AURA_POINTS.LIKE;
    totalAura += post.commentsCount * AURA_POINTS.COMMENT;
  }
  
  await User.findByIdAndUpdate(userId, { 
    aura: totalAura,
    stats: {
      totalPosts: posts.length,
      totalLikes,
      totalComments,
      totalViews,
      lastUpdated: new Date()
    }
  });
}

/**
 * Gets top N users by aura with their cached stats (FAST!)
 * No aggregation needed - just a simple query
 */
export async function getTopUsersByAuraWithStats(limit: number = 5) {
  return await User.find({ isActive: true })
    .sort({ aura: -1 })
    .limit(limit)
    .select('username profilePhoto aura bio stats')
    .lean();
}

/**
 * Gets top N users by aura for leaderboard (without stats)
 */
export async function getTopUsersByAura(limit: number = 5) {
  return await User.find({ isActive: true })
    .sort({ aura: -1 })
    .limit(limit)
    .select('username profilePhoto aura bio')
    .lean();
}

/**
 * Legacy function - kept for backwards compatibility
 * Now just calls recalculateUserAuraAndStats
 */
export async function recalculateUserAura(userId: Types.ObjectId | string): Promise<number> {
  await recalculateUserAuraAndStats(userId);
  const user = await User.findById(userId).select('aura');
  return user?.aura || 0;
}

/**
 * Legacy function - kept for backwards compatibility
 * Use specific increment functions instead
 */
export async function incrementUserAura(
  userId: Types.ObjectId | string, 
  amount: number
): Promise<void> {
  await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { aura: amount },
      $set: { 'stats.lastUpdated': new Date() }
    },
    { new: true }
  );
}