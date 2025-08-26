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

const router = Router();

router.post('/', createAsset);                    // POST /api/assets
router.get('/', getAssets);                       // GET /api/assets
router.get('/stats', getAssetsStats);             // GET /api/assets/stats
router.get('/:id', getAssetById);                 // GET /api/assets/:id
router.put('/:id', updateAsset);                  // PUT /api/assets/:id

// Filtering routes
router.get('/project/:projectId', getAssetsByProject);  // GET /api/assets/project/:projectId
router.get('/type/:type', getAssetsByType);             // GET /api/assets/type/:type
router.get('/origin/:origin', getAssetsByOrigin);       // GET /api/assets/origin/:origin


// POST /api/asset/upload-signature
router.post('/upload-signature', generateUploadSignature);

// POST /api/asset/save-metadata
router.post('/save-metadata', saveAssetMetadata);

// DELETE /api/asset/:assetId
router.delete('/:assetId', deleteAsset);

export default router;