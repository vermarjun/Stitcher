import { Router } from 'express';
import {
  getBackpackByUserId,
  addItemToBackpack,
  removeItemFromBackpack,
  toggleFavourite,
  updateItemNotes,
  getBackpackStats,
  getFilteredBackpackItems,
  addBackPackItemToProject,
  getBackpackByUserIdDashboard
} from '../controller/backpack.controller';
import auth from '../middleware/auth.middleware';

const router = Router();

// ============= BACKPACK RETRIEVAL =============
router.get('/', auth, getBackpackByUserId);
router.get('/:projectId', auth, getBackpackByUserIdDashboard);           // GET /api/backpack/backpack
router.get('/stats', auth, getBackpackStats);        // GET /api/backpack/backpack/stats
router.get('/items', auth, getFilteredBackpackItems); // GET /api/backpack/backpack/items

// ============= ITEM MANAGEMENT =============
router.post('/items', auth, addItemToBackpack);      // POST /api/backpack/backpack/items
router.delete('/items/:itemId', auth, removeItemFromBackpack); // DELETE /api/backpack/items/:itemId

// ============= ITEM ACTIONS =============
router.patch('/items/:itemId/favorite', auth, toggleFavourite); // PATCH /api/backpack/items/:itemId/favourite
router.patch('/items/:itemId/notes', auth, updateItemNotes);     // PATCH /api/backpack/items/:itemId/notes

// add the backpack item to the project
// params me itemId chahiye, projectId body me
router.post('/items/:itemId/addtoproject', auth, addBackPackItemToProject);

export default router;