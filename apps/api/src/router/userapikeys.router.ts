import { Router } from 'express';
import {
  getUserApiKeys,
  saveApiKeys,
  getApiKeyDetails,
  updateApiKey,
  deleteApiKey,
  toggleApiKeyStatus,
  getAgentsStatus
} from '../controller/userapikeys.controller';
import auth from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(auth);

// GET /api/keys - Get all API keys for the authenticated user
router.get('/', getUserApiKeys);

// GET /api/keys/agents - Get status of all available agents
router.get('/agents', getAgentsStatus);

// GET /api/keys/:agentId - Get details for a specific agent's API key
router.get('/:agentId', getApiKeyDetails);

// POST /api/keys - Save/update multiple API keys at once
router.post('/', saveApiKeys);

// PUT /api/keys/:agentId - Update a specific agent's API key
router.put('/:agentId', updateApiKey);

// PATCH /api/keys/:agentId/toggle - Toggle active status of a specific API key
router.patch('/:agentId/toggle', toggleApiKeyStatus);

// DELETE /api/keys/:agentId - Delete a specific agent's API key
router.delete('/:agentId', deleteApiKey);

export default router;