// routes/projectScriptRoutes.ts
import { Router } from 'express';
import {
  getProjectScript,
  updateProjectScript,
  editProjectScript
} from '../controller/script.controller';
import auth from '../middleware/auth.middleware';
import { requireProjectAccess, requireProjectEditor } from '../middleware/access.middleware';

const router: Router = Router();

// All script routes require authentication. Reads allow any member (owner /
// editor / viewer); writes require editor or owner.
router.use(auth);

router.get('/:projectId', requireProjectAccess('params', 'projectId'), getProjectScript);

router.put('/:projectId', requireProjectEditor('params', 'projectId'), updateProjectScript);

router.patch('/:projectId', requireProjectEditor('params', 'projectId'), editProjectScript);

export default router;
