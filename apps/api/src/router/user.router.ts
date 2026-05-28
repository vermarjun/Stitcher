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
  uploadProfileBanner,
  authWithGoogle,
  getUserCredits
} from "../controller/user.controller";
import auth from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { requireFeature } from '../middleware/feature.middleware';

const router: Router = express.Router();

// Public routes
router.post('/signup', signup);
router.post('/login', login);
router.get('/google', authWithGoogle);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);

// Protected routes
// Get Update Delete user's profile:
router.get('/me', auth, getUser);
router.get('/me/credits', auth, getUserCredits);
router.put('/me', auth, updateUser);
router.delete('/me', auth, deleteUser);

// Password and profile photo:
router.put('/change-password', auth, changePassword);
router.post('/profile-photo', auth, upload.single('profilePhoto'), uploadProfilePhoto);
router.post('/profile-banner', auth, upload.single('profileBanner'), uploadProfileBanner);

// Follow system + public profiles — community surface, gated for v1 relaunch.
// requireFeature("community") makes these 404 while the flag is off.
const community = requireFeature('community');
router.post('/:userId/follow', community, auth, followUser); // Follow a user
router.delete('/:userId/unfollow', community, auth, unfollowUser); // Unfollow a user
router.delete('/:userId/remove-follower', community, auth, removeFollower); // Remove a follower from your followers list
router.get('/:userId/followers', community, getFollowers); // Get list of followers (public)
router.get('/:userId/following', community, getFollowing); // Get list of following (public)
router.get('/:userId/follow-status', community, auth, checkFollowStatus); // Check if current user follows this user
router.get('/suggestions', community, auth, getSuggestedUsers); // Get suggested users to follow

// Public profile route (should be last to avoid conflicts)
router.get('/:userId/profile', community, getUserProfile); // Can be username or user ID

/**
 * @route   GET /api/users/search
 * @desc    Search users by username (contains query)
 * @query   q - Search query string
 * @example /api/users/search?q=john
 */
router.get('/search', auth, searchUsers);

export default router;