import { Request, Response } from 'express';
import { getTopUsersByAura } from '../util/auraupdate.util';
import User from '../model/user.model';

/**
 * Get top users by aura for leaderboard
 * GET /api/leaderboard/top
 */
export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const { limit = 5 } = req.query;
    const limitNum = parseInt(limit as string);

    // Validate limit
    if (limitNum < 1 || limitNum > 100) {
      res.status(400).json({ error: 'Limit must be between 1 and 100' });
      return;
    }

    const topUsers = await getTopUsersByAura(limitNum);

    res.json({
      success: true,
      data: topUsers
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}

/**
 * Get user's rank and aura
 * GET /api/leaderboard/user/:userId/rank
 */
export async function getUserRank(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('username profilePhoto aura bio');
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Count users with higher aura to determine rank
    const rank = await User.countDocuments({
      isActive: true,
      aura: { $gt: user.aura }
    }) + 1;

    // Get total active users count
    const totalUsers = await User.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          profilePhoto: user.profilePhoto,
          bio: user.bio,
          aura: user.aura
        },
        rank,
        totalUsers,
        percentile: totalUsers > 0 ? ((totalUsers - rank + 1) / totalUsers * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching user rank:', error);
    res.status(500).json({ error: 'Failed to fetch user rank' });
  }
}

/**
 * Get current user's rank and aura (authenticated)
 * GET /api/leaderboard/my-rank
 */
export async function getMyRank(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(userId).select('username profilePhoto aura bio');
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Count users with higher aura to determine rank
    const rank = await User.countDocuments({
      isActive: true,
      aura: { $gt: user.aura }
    }) + 1;

    // Get total active users count
    const totalUsers = await User.countDocuments({ isActive: true });

    // Get users around current user (2 above, 2 below)
    const usersAbove = await User.find({
      isActive: true,
      aura: { $gt: user.aura }
    })
      .sort({ aura: 1 })
      .limit(2)
      .select('username profilePhoto aura bio')
      .lean();

    const usersBelow = await User.find({
      isActive: true,
      aura: { $lt: user.aura }
    })
      .sort({ aura: -1 })
      .limit(2)
      .select('username profilePhoto aura bio')
      .lean();

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          profilePhoto: user.profilePhoto,
          bio: user.bio,
          aura: user.aura
        },
        rank,
        totalUsers,
        percentile: totalUsers > 0 ? ((totalUsers - rank + 1) / totalUsers * 100).toFixed(2) : 0,
        nearbyUsers: {
          above: usersAbove.reverse(),
          below: usersBelow
        }
      }
    });
  } catch (error) {
    console.error('Error fetching my rank:', error);
    res.status(500).json({ error: 'Failed to fetch rank' });
  }
}

/**
 * Get leaderboard statistics
 * GET /api/leaderboard/stats
 */
export async function getLeaderboardStats(req: Request, res: Response): Promise<void> {
  try {
    const [totalUsers, totalAura, topUser] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: '$aura' } } }
      ]),
      User.findOne({ isActive: true })
        .sort({ aura: -1 })
        .select('username profilePhoto aura')
        .lean()
    ]);

    const averageAura = totalUsers > 0 && totalAura.length > 0 
      ? Math.round(totalAura[0].total / totalUsers) 
      : 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalAura: totalAura.length > 0 ? totalAura[0].total : 0,
        averageAura,
        topUser: topUser || null
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard stats' });
  }
}

/**
 * Get leaderboard with pagination
 * GET /api/leaderboard/paginated
 */
export async function getPaginatedLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // Validate pagination params
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      res.status(400).json({ error: 'Invalid pagination parameters' });
      return;
    }

    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find({ isActive: true })
        .sort({ aura: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('username profilePhoto aura bio')
        .lean(),
      User.countDocuments({ isActive: true })
    ]);

    // Add rank to each user
    const usersWithRank = users.map((user, index) => ({
      ...user,
      rank: skip + index + 1
    }));

    res.json({
      success: true,
      data: usersWithRank,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching paginated leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}