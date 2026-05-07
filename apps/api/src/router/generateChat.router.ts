import { Router } from 'express';
import {
    generateChatResponse,
    getChatHistory,
    getProjectChats,
    getChatUpdate,
    getLatestAssistantMessage,
    stopGeneration,
    completeGeneration,
    generateGuestChatResponse
} from '../controller/generateChat.controller';
import auth from "../middleware/auth.middleware";
import { refreshCredits } from '../middleware/refreshCredits.middleware';
import { requireChatOwnership } from '../middleware/ownership.middleware';

const router = Router();

/**
 * @route   POST /api/generate-chat/guest
 * @desc    Generate chat response for unauthenticated (guest) users
 * @access  Public
 */
router.post('/guest', generateGuestChatResponse);

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
 */
router.get('/update/:chatId', auth, getChatUpdate);

/**
 * @route   GET /api/generate-chat/latest-message/:chatId
 * @desc    Get latest assistant message (for polling updates from microservice)
 * @access  Private
 */
router.get('/latest-message/:chatId', auth, requireChatOwnership('params', 'chatId'), getLatestAssistantMessage);

/**
 * @route   GET /api/generate-chat/project/:projectId
 * @desc    Get all chats for a project
 * @access  Private
 */
router.get('/project/:projectId', auth, getProjectChats);

/**
 * @route   GET /api/generate-chat/:chatId
 * @desc    Get chat history
 * @access  Private
 */
router.get('/:chatId', auth, getChatHistory);

/**
 * @route   POST /api/generate-chat/cancel/:chatId
 * @desc    Stop/cancel ongoing generation
 * @access  Private
 */
router.post('/cancel/:chatId', auth, stopGeneration);

/**
 * @route   POST /api/generate-chat/complete
 * @desc    Called by microservice to signal completion and deduct credits
 * @access  Private (microservice-to-server; auth ensures it carries a valid JWT)
 */
router.post('/complete', auth, completeGeneration);

export default router;
