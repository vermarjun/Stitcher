import express, { Router } from 'express';
import { searchPrompts } from '../controller/searchBar.controller';
import auth from '../middleware/auth.middleware';

const router: Router = express.Router();

// Protected routes
router.get('/prompts', auth, searchPrompts);

export default router;