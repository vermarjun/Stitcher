import { Router } from 'express';
import {
    generateChatResponse,
    getChatHistory,
    getProjectChats,
    getChatUpdate,
    getLatestAssistantMessage,
    stopGeneration,
    completeGeneration,
} from '../controller/generateChat.controller';
import auth from "../middleware/auth.middleware";
import { refreshCredits } from '../middleware/refreshCredits.middleware';

const router = Router();

/**
 * @route   POST /api/generate-chat
 * @desc    Generate chat response (main flow)
 * @access  Private
 * @body    { projectId: string, prompt: string, chatId?: string }
 */
router.post('/', auth, refreshCredits, generateChatResponse);

/**
 * @route   GET /api/generate-chat/update/:chatId
 * @desc    Get updated chat 
 * @access  Private
 * @params  chatId: string
 * @query   projectId: string
 */
router.get('/update/:chatId', auth, getChatUpdate);

/**
 * @route   GET /api/generate-chat/latest-message/:chatId
 * @desc    Get latest assistant message (for polling updates from microservice)
 * @access  Private
 * @params  chatId: string
 * @query   projectId: string, userId: string
 */
router.get('/latest-message/:chatId', getLatestAssistantMessage);

/**
 * @route   GET /api/generate-chat/project/:projectId
 * @desc    Get all chats for a project
 * @access  Private
 * @params  projectId: string
 */
router.get('/project/:projectId', auth, getProjectChats);

/**
 * @route   GET /api/generate-chat/:chatId
 * @desc    Get chat history
 * @access  Private
 * @params  chatId: string
 */
router.get('/:chatId', auth, getChatHistory);

router.post('/cancel/:chatId', auth, stopGeneration);

router.post('/complete', completeGeneration);

export default router;