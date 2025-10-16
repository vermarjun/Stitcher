// routes/projectScriptRoutes.ts
import { Router } from 'express';
import {
  getProjectScript,
  updateProjectScript,
  editProjectScript
} from '../controller/script.controller';

const router: Router = Router();

router.get('/:projectId', getProjectScript);

router.put('/:projectId', updateProjectScript);

router.patch('/:projectId', editProjectScript);

export default router;