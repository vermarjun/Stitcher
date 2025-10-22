import { Router } from 'express';
import {
  getLeaderboard,
  getUserRank,
  getMyRank,
  getLeaderboardStats,
  getPaginatedLeaderboard
} from '../controller/leaderboard.controller';
import auth from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/leaderboard/top
 * Get top users by aura
 * Query: { limit?: number } (default: 5, max: 100)
 */
router.get('/top', auth, getLeaderboard);

/**
 * GET /api/leaderboard/paginated
 * Get paginated leaderboard
 * Query: { page?: number, limit?: number }
 */
router.get('/paginated', auth, getPaginatedLeaderboard);

/**
 * GET /api/leaderboard/stats
 * Get leaderboard statistics (total users, total aura, average, top user)
 */
router.get('/stats', auth, getLeaderboardStats);

/**
 * GET /api/leaderboard/my-rank
 * Get current authenticated user's rank and nearby users
 * Requires authentication
 */
router.get('/my-rank', auth, getMyRank);

/**
 * GET /api/leaderboard/user/:userId/rank
 * Get specific user's rank and aura
 * Params: { userId: string }
 */
router.get('/user/:userId/rank', auth, getUserRank);

export default router;