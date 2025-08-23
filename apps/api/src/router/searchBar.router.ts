import express, { Router } from 'express';
import { searchChats, searchProjects } from '../controller/searchBar.controller';
import auth from '../middleware/auth.middleware';

const router: Router = express.Router();

// Protected routes
router.get('/projects', auth, searchProjects);
router.get('/chats', auth, searchChats);

export default router;