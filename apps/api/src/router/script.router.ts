// routes/projectScriptRoutes.ts
import { Router } from 'express';
import {
  getProjectScript,
  updateProjectScript,
  editProjectScript
} from '../controller/script.controller';
import auth from '../middleware/auth.middleware';
import { requireProjectOwnership } from '../middleware/ownership.middleware';

const router: Router = Router();

// All script routes require authentication and project ownership.
router.use(auth);

router.get('/:projectId', requireProjectOwnership('params', 'projectId'), getProjectScript);

router.put('/:projectId', requireProjectOwnership('params', 'projectId'), updateProjectScript);

router.patch('/:projectId', requireProjectOwnership('params', 'projectId'), editProjectScript);

export default router;
