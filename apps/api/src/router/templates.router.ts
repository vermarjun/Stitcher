import express, { Router } from 'express';
import {
    deleteTemplate,
    updateTemplate,
    createNewTemplate,
    getTemplateById,
    addTemplateToProject,
    fetchAllTemplates,
    fetchFeaturedTemplates,
    toggleTemplateLike
} from '../controller/templates.controller';
import auth from '../middleware/auth.middleware';

const router: Router = express.Router();

// Public route (NO auth) — curated, public-safe template set for the marketing
// landing page. Declared before '/:id' so it is not captured as an id param.
router.get('/featured', fetchFeaturedTemplates);

// Public-read routes (already auth-gated for user-specific data)
router.get('/', auth, fetchAllTemplates);
router.get('/:id', auth, getTemplateById);
router.post('/:id/add-to-project', auth, addTemplateToProject);
router.post('/:id/like', auth, toggleTemplateLike);

// Write routes — require authentication (admin-only by convention; no per-user ownership field on Template)
router.post('/', auth, createNewTemplate);
router.put('/:id', auth, updateTemplate);
router.delete('/:id', auth, deleteTemplate);

export default router;
