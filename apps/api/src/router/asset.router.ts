import { Router } from 'express';
import {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  getAssetsByProject,
  getAssetsByType,
  getAssetsByOrigin,
  getAssetsStats,
  generateUploadSignature,
  saveAssetMetadata,
  deleteAsset
} from "../controller/asset.controller";
import auth from '../middleware/auth.middleware';

const router = Router();

router.post('/', auth, createAsset);                    // POST /api/assets
router.get('/', auth, getAssets);                       // GET /api/assets
router.get('/stats', auth, getAssetsStats);             // GET /api/assets/stats
router.get('/:id', auth, getAssetById);                 // GET /api/assets/:id
router.put('/:id', auth, updateAsset);                  // PUT /api/assets/:id

// Filtering routes
router.get('/project/:projectId', auth, getAssetsByProject);  // GET /api/assets/project/:projectId
router.get('/type/:type', auth, getAssetsByType);             // GET /api/assets/type/:type
router.get('/origin/:origin', auth, getAssetsByOrigin);       // GET /api/assets/origin/:origin


// POST /api/asset/upload-signature
router.post('/upload-signature', auth, generateUploadSignature);

// POST /api/asset/save-metadata
router.post('/save-metadata', auth, saveAssetMetadata);

// DELETE /api/asset/:assetId
router.delete('/:assetId', auth, deleteAsset);

export default router;