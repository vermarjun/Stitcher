import { Router } from 'express';
import {
  getBackpackByUserId,
  addItemToBackpack,
  removeItemFromBackpack,
  toggleFavourite,
  updateItemNotes,
  getBackpackStats,
  getFilteredBackpackItems
} from '../controller/backpack.controller';
import auth from '../middleware/auth.middleware';

const router = Router();

// ============= BACKPACK RETRIEVAL =============
router.get('/', auth, getBackpackByUserId);           // GET /api/backpack/backpack
router.get('/stats', auth, getBackpackStats);        // GET /api/backpack/backpack/stats
router.get('/items', auth, getFilteredBackpackItems); // GET /api/backpack/backpack/items

// ============= ITEM MANAGEMENT =============
router.post('/items', auth, addItemToBackpack);      // POST /api/backpack/backpack/items
router.delete('/items/:itemId', auth, removeItemFromBackpack); // DELETE /api/backpack/items/:itemId

// ============= ITEM ACTIONS =============
router.patch('/items/:itemId/favourite', auth, toggleFavourite); // PATCH /api/backpack/items/:itemId/favourite
router.patch('/items/:itemId/notes', auth, updateItemNotes);     // PATCH /api/backpack/items/:itemId/notes

export default router;