import express, { Router } from 'express';
import {
  login,
  getUser,
  updateUser,
  changePassword,
  uploadProfilePhoto,
  deleteUser,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
  authWithGoogle,
  completeOnboardingTour,
  startSignup,
  verifySignupOtp,
  resendSignupOtp
} from "../controller/user.controller";
import auth from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router: Router = express.Router();

// Public routes. Signup always goes through the OTP flow
// (/signup/start then /signup/verify).
router.post('/signup/start', startSignup);
router.post('/signup/verify', verifySignupOtp);
router.post('/signup/resend', resendSignupOtp);
router.post('/login', login);
router.get('/google', authWithGoogle);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);

// Protected routes
router.get('/me', auth, getUser);
router.post('/me/onboarding/complete', auth, completeOnboardingTour);
router.put('/me', auth, updateUser);
router.delete('/me', auth, deleteUser);

router.put('/change-password', auth, changePassword);
router.post('/profile-photo', auth, upload.single('profilePhoto'), uploadProfilePhoto);

export default router;
