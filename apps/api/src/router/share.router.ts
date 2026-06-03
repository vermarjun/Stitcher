import express from 'express';
import auth from '../middleware/auth.middleware';
import { createSharedVideo, getSharedVideo } from '../controller/timeline.controller';

// Authenticated POST to create a share link; public GET to resolve one.
const router = express.Router();

router.post('/', auth, createSharedVideo);
router.get('/:shareId', getSharedVideo);

export default router;
