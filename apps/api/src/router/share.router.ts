import express from 'express';
import { getSharedVideo } from '../controller/timeline.controller';

// Public — no auth. Resolves a share token to playable video metadata.
const router = express.Router();

router.get('/:shareId', getSharedVideo);

export default router;
