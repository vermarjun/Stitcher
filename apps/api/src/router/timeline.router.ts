import express from 'express';
import {
  getTimelineByProjectId,
  updateTimeline,
  exportTimelineVideo
} from '../controller/timeline.controller';
import auth from '../middleware/auth.middleware';
import { requireProjectAccess, requireTimelineAccess } from '../middleware/access.middleware';

const router = express.Router();

// All timeline routes require authentication
router.use(auth);

// Get timeline by project ID — owner or accepted collaborator
router.get('/project/:projectId', requireProjectAccess('params', 'projectId'), getTimelineByProjectId);

// Export the current timeline to a single mp4 — owner or accepted collaborator
router.post('/project/:projectId/export', requireProjectAccess('params', 'projectId'), exportTimelineVideo);

// Update timeline — owner or accepted collaborator
router.put('/:timelineId', requireTimelineAccess('params', 'timelineId'), updateTimeline);

export default router;
