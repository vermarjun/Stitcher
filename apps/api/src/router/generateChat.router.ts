import { Router } from 'express';
import {
    generateChatResponse,
    getChatHistory,
    getProjectChats,
    getChatUpdate,
    getLatestAssistantMessage,
    getUserJobs,
    getChatStatus,
    stopGeneration,
} from '../controller/generateChat.controller';
import auth from "../middleware/auth.middleware";
import { requireChatOwnership, requireProjectOwnership } from '../middleware/ownership.middleware';

const router = Router();


/**
 * @route   POST /api/generate-chat
 * @desc    Generate chat response (main flow)
 * @access  Private
 * @body    { projectId: string, prompt: string, chatId?: string }
 */
router.post('/', auth, requireProjectOwnership('body', 'projectId'), generateChatResponse);

/**
 * @route   GET /api/generate-chat/update/:chatId
 * @desc    Get updated chat
 * @access  Private
 */
router.get('/update/:chatId', auth, requireChatOwnership('params', 'chatId'), getChatUpdate);

/**
 * @route   GET /api/generate-chat/latest-message/:chatId
 * @desc    Get latest assistant message 
 * @access  Private
 */
router.get('/latest-message/:chatId', auth, requireChatOwnership('params', 'chatId'), getLatestAssistantMessage);

/**
 * @route   GET /api/generatechat/jobs
 * @desc    Get the authenticated user's generation/edit job history (F2.4)
 * @access  Private
 * @query   status=active|recent, limit, skip
 *
 * NOTE: must be registered BEFORE the `/:chatId` catch-all below so "jobs" is
 * not mistaken for a chat id.
 */
router.get('/jobs', auth, getUserJobs);

/**
 * @route   GET /api/generate-chat/project/:projectId
 * @desc    Get all chats for a project
 * @access  Private
 */
router.get('/project/:projectId', auth, requireProjectOwnership('params', 'projectId'), getProjectChats);

/**
 * @route   GET /api/generatechat/:chatId/status
 * @desc    Polling fallback — returns { status, finalUrl, jobId, sceneProgress }
 *          for the most recent job of this chat. The frontend polls this when
 *          the socket misses the 'job_complete' event.
 * @access  Private (auth + ownership check inside handler)
 *
 * NOTE: must be registered BEFORE the bare /:chatId catch-all below so Express
 * does not treat "status" as a chatId.
 */
router.get('/:chatId/status', auth, getChatStatus);

/**
 * @route   GET /api/generate-chat/:chatId
 * @desc    Get chat history
 * @access  Private
 */
router.get('/:chatId', auth, requireChatOwnership('params', 'chatId'), getChatHistory);

/**
 * @route   POST /api/generate-chat/cancel/:chatId
 * @desc    Stop/cancel ongoing generation
 * @access  Private
 */
router.post('/cancel/:chatId', auth, requireChatOwnership('params', 'chatId'), stopGeneration);

export default router;
