import { Request, Response } from 'express';
import Asset, { AssetType, AssetOrigin } from '../model/asset.model';
import { Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

// Create a new asset
export const createAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      type,
      origin,
      url,
      thumbnail,
      duration,
      width,
      height,
      bytes,
      metadata,
      projectId,
      originalTemplateId
    } = req.body;

    // Validate required fields
    if (!name || !type || !origin || !url || !projectId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, type, origin, url, projectId'
      });
      return;
    }

    // Validate enum values
    if (!Object.values(AssetType).includes(type)) {
      res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${Object.values(AssetType).join(', ')}`
      });
      return;
    }

    if (!Object.values(AssetOrigin).includes(origin)) {
      res.status(400).json({
        success: false,
        message: `Invalid origin. Must be one of: ${Object.values(AssetOrigin).join(', ')}`
      });
      return;
    }

    // Validate projectId is a valid ObjectId
    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid projectId format'
      });
      return;
    }

    // Validate originalTemplateId if provided
    if (originalTemplateId && !Types.ObjectId.isValid(originalTemplateId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid originalTemplateId format'
      });
      return;
    }

    const asset = new Asset({
      name,
      type,
      origin,
      url,
      thumbnail: thumbnail || '',
      duration,
      width,
      height,
      bytes: bytes || 0,
      metadata: metadata || {},
      projectId,
      originalTemplateId
    });

    const savedAsset = await asset.save();

    res.status(201).json({
      success: true,
      data: savedAsset
    });
  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all assets with optional filtering and pagination
export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      projectId,
      type,
      origin,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = {};

    if (projectId) {
      if (!Types.ObjectId.isValid(projectId as string)) {
        res.status(400).json({
          success: false,
          message: 'Invalid projectId format'
        });
        return;
      }
      filter.projectId = new Types.ObjectId(projectId as string);
    }

    if (type && Object.values(AssetType).includes(type as AssetType)) {
      filter.type = type;
    }

    if (origin && Object.values(AssetOrigin).includes(origin as AssetOrigin)) {
      filter.origin = origin;
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const [assets, total] = await Promise.all([
      Asset.find(filter)
        .populate('projectId', 'name')
        .populate('originalTemplateId', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .exec(),
      Asset.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: assets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get asset by ID
export const getAssetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid asset ID format'
      });
      return;
    }

    const asset = await Asset.findById(id)
      .populate('projectId', 'name')
      .populate('originalTemplateId', 'name');

    if (!asset) {
      res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update asset
export const updateAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid asset ID format'
      });
      return;
    }

    // Remove fields that shouldn't be updated
    const { _id, createdAt, updatedAt, ...validUpdates } = updates;

    // Validate enum values if provided
    if (validUpdates.type && !Object.values(AssetType).includes(validUpdates.type)) {
      res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${Object.values(AssetType).join(', ')}`
      });
      return;
    }

    if (validUpdates.origin && !Object.values(AssetOrigin).includes(validUpdates.origin)) {
      res.status(400).json({
        success: false,
        message: `Invalid origin. Must be one of: ${Object.values(AssetOrigin).join(', ')}`
      });
      return;
    }

    const asset = await Asset.findByIdAndUpdate(
      id,
      validUpdates,
      { new: true, runValidators: true }
    ).populate('projectId', 'name').populate('originalTemplateId', 'name');

    if (!asset) {
      res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get assets by project ID
export const getAssetsByProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { type, origin } = req.query;

    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
      return;
    }

    const filter: any = { projectId: new Types.ObjectId(projectId) };

    if (type && Object.values(AssetType).includes(type as AssetType)) {
      filter.type = type;
    }

    if (origin && Object.values(AssetOrigin).includes(origin as AssetOrigin)) {
      filter.origin = origin;
    }

    const assets = await Asset.find(filter)
      .populate('originalTemplateId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching project assets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get assets by type
export const getAssetsByType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const { projectId } = req.query;

    if (!Object.values(AssetType).includes(type as AssetType)) {
      res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${Object.values(AssetType).join(', ')}`
      });
      return;
    }

    const filter: any = { type };

    if (projectId && Types.ObjectId.isValid(projectId as string)) {
      filter.projectId = new Types.ObjectId(projectId as string);
    }

    const assets = await Asset.find(filter)
      .populate('projectId', 'name')
      .populate('originalTemplateId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching assets by type:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get assets by origin
export const getAssetsByOrigin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { origin } = req.params;
    const { projectId } = req.query;

    if (!Object.values(AssetOrigin).includes(origin as AssetOrigin)) {
      res.status(400).json({
        success: false,
        message: `Invalid origin. Must be one of: ${Object.values(AssetOrigin).join(', ')}`
      });
      return;
    }

    const filter: any = { origin };

    if (projectId && Types.ObjectId.isValid(projectId as string)) {
      filter.projectId = new Types.ObjectId(projectId as string);
    }

    const assets = await Asset.find(filter)
      .populate('projectId', 'name')
      .populate('originalTemplateId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error('Error fetching assets by origin:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get assets statistics
export const getAssetsStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;

    const filter: any = {};
    if (projectId && Types.ObjectId.isValid(projectId as string)) {
      filter.projectId = new Types.ObjectId(projectId as string);
    }

    const stats = await Asset.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalBytes: { $sum: '$bytes' },
          videoCount: {
            $sum: { $cond: [{ $eq: ['$type', AssetType.VIDEO] }, 1, 0] }
          },
          audioCount: {
            $sum: { $cond: [{ $eq: ['$type', AssetType.AUDIO] }, 1, 0] }
          },
          templateCount: {
            $sum: { $cond: [{ $eq: ['$origin', AssetOrigin.TEMPLATE] }, 1, 0] }
          },
          uploadCount: {
            $sum: { $cond: [{ $eq: ['$origin', AssetOrigin.UPLOAD] }, 1, 0] }
          },
          generatedCount: {
            $sum: { $cond: [{ $eq: ['$origin', AssetOrigin.GENERATED_VIDEO] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalAssets: 0,
      totalBytes: 0,
      videoCount: 0,
      audioCount: 0,
      templateCount: 0,
      uploadCount: 0,
      generatedCount: 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching assets statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface UploadSignatureRequest {
  projectId: string;
  resourceType: 'video' | 'audio';
}

interface SaveAssetMetadataRequest {
  name: string;
  type: AssetType;
  url: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
  metadata: Record<string, any>;
  projectId: string;
  cloudinaryPublicId: string;
}

// Generate signed upload parameters for Cloudinary
export const generateUploadSignature = async (req: Request<{}, {}, UploadSignatureRequest>, res: Response) => {
  try {
    const { projectId, resourceType } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!['video', 'audio'].includes(resourceType)) {
      return res.status(400).json({ error: 'Resource type must be video or audio' });
    }

    // Generate timestamp for signature
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Define upload parameters
    const uploadParams = {
      timestamp,
      folder: `projects/${projectId}/${resourceType}s`,
      resource_type: resourceType,
      quality: 'auto',
      fetch_format: 'auto',
    };

    // Generate signature
    const signature = cloudinary.utils.api_sign_request(uploadParams, process.env.CLOUDINARY_API_SECRET!);

    // Return upload parameters and signature
    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      uploadParams,
    });
  } catch (error) {
    console.error('Error generating upload signature:', error);
    res.status(500).json({ error: 'Failed to generate upload signature' });
  }
}

// Save asset metadata to MongoDB after successful Cloudinary upload
export const saveAssetMetadata = async (req: Request<{}, {}, SaveAssetMetadataRequest>, res: Response) => {
  try {
    const {
      name,
      type,
      url,
      thumbnail,
      duration,
      width,
      height,
      bytes,
      metadata,
      projectId,
      cloudinaryPublicId,
    } = req.body;

    // Validate required fields
    if (!name || !type || !url || !projectId) {
      return res.status(400).json({
        error: 'Name, type, url, and projectId are required'
      });
    }

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    // Create new asset document
    const asset = new Asset({
      name,
      type,
      origin: AssetOrigin.UPLOAD,
      url,
      thumbnail: thumbnail || '',
      duration,
      width,
      height,
      bytes,
      metadata: {
        ...metadata,
        cloudinaryPublicId,
      },
      projectId: new Types.ObjectId(projectId),
    });

    // Save to database
    const savedAsset = await asset.save();

    res.status(201).json({
      success: true,
      asset: savedAsset,
    });
  } catch (error) {
    console.error('Error saving asset metadata:', error);
    res.status(500).json({ error: 'Failed to save asset metadata' });
  }
}

// Delete asset from both database and Cloudinary
export const deleteAsset = async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;

    if (!Types.ObjectId.isValid(assetId)) {
      return res.status(400).json({ error: 'Invalid asset ID format' });
    }

    // Find asset in database
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete from Cloudinary if it has a public ID
    const cloudinaryPublicId = asset.metadata?.cloudinaryPublicId;
    if (cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId, {
          resource_type: asset.type === AssetType.AUDIO ? 'video' : 'video'
        });
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Delete from database
    await Asset.findByIdAndDelete(assetId);

    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
}