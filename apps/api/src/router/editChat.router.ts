import { Router } from 'express';
import {
  processEditChat,
  getEditChatHistory,
  rollbackTimeline
} from '../controller/editChat.controller';
import auth from '../middleware/auth.middleware';
import { requireProjectOwnership } from '../middleware/ownership.middleware';

const router = Router();

// All edit-chat routes require authentication
router.use(auth);

/**
 * POST /api/edit-chat/process
 * Process a user prompt to edit the timeline
 * Body: { projectId: string, prompt: string }
 */
router.post('/process', requireProjectOwnership('body', 'projectId'), processEditChat);

/**
 * GET /api/edit-chat/history/:projectId
 * Get the edit chat history for a project
 * Params: { projectId: string }
 */
router.get('/history/:projectId', requireProjectOwnership('params', 'projectId'), getEditChatHistory);

/**
 * POST /api/edit-chat/rollback
 * Rollback timeline to a previous state from chat history
 * Body: { projectId: string, messageIndex: number }
 */
router.post('/rollback', requireProjectOwnership('body', 'projectId'), rollbackTimeline);

export default router;
