import express, { Router } from 'express';
import {
    deleteTemplate,
    updateTemplate, 
    createNewTemplate, 
    getTemplateById, 
    addTemplateToProject, 
    fetchAllTemplates,
    toggleTemplateLike
} from '../controller/templates.controller';
import auth from '../middleware/auth.middleware';

const router: Router = express.Router();

// User routes
router.get('/', auth, fetchAllTemplates);
router.get('/:id', auth, getTemplateById);
router.post('/:id/add-to-project', auth, addTemplateToProject)
router.post('/:id/like', auth, toggleTemplateLike)

// Admmin only functionality add karni hai
router.post('/', createNewTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
export default router;