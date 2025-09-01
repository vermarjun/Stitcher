import express from 'express';
import {
  getTimelineByProjectId,
  updateTimeline
} from '../controller/timeline.controller';

const router = express.Router();

// Get timeline by project ID
router.get('/project/:projectId', getTimelineByProjectId);

// Update timeline properties
router.put('/:timelineId', updateTimeline);

export default router;