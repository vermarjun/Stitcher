import { Router } from 'express';
import { generateChatResponse, getChatHistory, getProjectChats, rollbackToDescription } from '../controller/generateChat.controller';
import auth from "../middleware/auth.middleware"; 

const router = Router();

/**
 * @route   POST /api/generate-chat
 * @desc    Generate chat response (main flow)
 * @access  Private
 * @body    { projectId: string, prompt: string, chatId?: string }
 */
router.post('/', auth, generateChatResponse);

/**
 * @route   GET /api/generate-chat/:chatId
 * @desc    Get chat history
 * @access  Private
 * @params  chatId: string
 */
router.get('/:chatId', auth, getChatHistory);

/**
 * @route   GET /api/generate-chat/project/:projectId
 * @desc    Get all chats for a project
 * @access  Private
 * @params  projectId: string
 */
router.get('/project/:projectId', auth, getProjectChats );

/**
 * @route   POST /api/generate-chat/rollback
 * @desc    Rollback to a specific project description
 * @access  Private
 * @body    { chatId: string, messageIndex: number }
 */
router.post('/rollback', auth, rollbackToDescription);

export default router;