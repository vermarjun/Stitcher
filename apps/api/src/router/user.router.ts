import express, { Router } from 'express';
import { 
  signup, 
  login, 
  getUser, 
  updateUser, 
  changePassword,
  uploadProfilePhoto,
  deleteUser, 
  requestPasswordReset, 
  resetPassword,
  getUserProfile,
  // NEW: Follow system controllers
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus,
  getSuggestedUsers,
  removeFollower,
  searchUsers,
  uploadProfileBanner
} from "../controller/user.controller";
import auth from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router: Router = express.Router();

// Public routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);

// Protected routes
// Get Update Delete user's profile:
router.get('/me', auth, getUser);
router.put('/me', auth, updateUser);
router.delete('/me', auth, deleteUser);

// Password and profile photo:
router.put('/change-password', auth, changePassword);
router.post('/profile-photo', auth, upload.single('profilePhoto'), uploadProfilePhoto);
router.post('/profile-banner', auth, upload.single('profileBanner'), uploadProfileBanner);

// NEW: Follow system routes (protected)
router.post('/:userId/follow', auth, followUser); // Follow a user
router.delete('/:userId/unfollow', auth, unfollowUser); // Unfollow a user
router.delete('/:userId/remove-follower', auth, removeFollower); // Remove a follower from your followers list
router.get('/:userId/followers', getFollowers); // Get list of followers (public)
router.get('/:userId/following', getFollowing); // Get list of following (public)
router.get('/:userId/follow-status', auth, checkFollowStatus); // Check if current user follows this user
router.get('/suggestions', auth, getSuggestedUsers); // Get suggested users to follow

// Public profile route (should be last to avoid conflicts)
router.get('/:userId/profile', getUserProfile); // Can be username or user ID

/**
 * @route   GET /api/users/search
 * @desc    Search users by username (contains query)
 * @query   q - Search query string
 * @example /api/users/search?q=john
 */
router.get('/search', auth, searchUsers);

export default router;