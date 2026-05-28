import express from 'express';
import {
  getTimelineByProjectId,
  updateTimeline,
  exportTimelineVideo
} from '../controller/timeline.controller';
import auth from '../middleware/auth.middleware';
import { requireProjectOwnership, requireTimelineOwnership } from '../middleware/ownership.middleware';

const router = express.Router();

// All timeline routes require authentication
router.use(auth);

// Get timeline by project ID — ownership checked via projectId in params
router.get('/project/:projectId', requireProjectOwnership('params', 'projectId'), getTimelineByProjectId);

// Export the current timeline to a single mp4 — ownership checked via projectId
router.post('/project/:projectId/export', requireProjectOwnership('params', 'projectId'), exportTimelineVideo);

// Update timeline — ownership checked by loading timeline and tracing to project
router.put('/:timelineId', requireTimelineOwnership('params', 'timelineId'), updateTimeline);

export default router;
