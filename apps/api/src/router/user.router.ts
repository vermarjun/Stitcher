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
  resetPassword 
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
// Get Update Delete user's profile:
router.put('/change-password', auth, changePassword);
router.post('/profile-photo', auth, upload.single('profilePhoto') ,uploadProfilePhoto);

export default router;