import { Router } from 'express';
import { 
  processEditChat, 
  getEditChatHistory, 
  rollbackTimeline 
} from '../controller/editChat.controller';

const router = Router();

/**
 * POST /api/edit-chat/process
 * Process a user prompt to edit the timeline
 * Body: { projectId: string, prompt: string }
 */
router.post('/process', processEditChat);

/**
 * GET /api/edit-chat/history/:projectId
 * Get the edit chat history for a project
 * Params: { projectId: string }
 */
router.get('/history/:projectId', getEditChatHistory);

/**
 * POST /api/edit-chat/rollback
 * Rollback timeline to a previous state from chat history
 * Body: { projectId: string, messageIndex: number }
 */
router.post('/rollback', rollbackTimeline);

export default router;