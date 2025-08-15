// routes/apiKeyRoutes.ts
import express from 'express';
import {
  getApiKeys,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  getBestApiKey,
} from '../controller/userapikeys.controller';
import authenticate from '../middleware/auth.middleware'; // Assuming you have auth middleware

const router = express.Router();

// Protect all routes with authentication
router.use(authenticate);

// Get all API keys for the user
router.get('/', getApiKeys);

// Add a new API key
router.post('/', addApiKey);

// Update an API key
router.put('/:id', updateApiKey);

// Delete an API key
router.delete('/:id', deleteApiKey);

export default router;