import { Request, Response } from 'express';
import Backpack, { BackpackItemType, BackpackItemSource, IBackpackItem } from '../model/backpack.model';
import Asset, { AssetType, AssetOrigin }from '../model/asset.model';
import Template, {TemplateType} from '../model/template.model';
import { Types } from 'mongoose';
import Project from '../model/project.model';

// POST /backpack/items/:itemId/add-to-project - Add backpack item to project
export const addBackPackItemToProject = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { projectId, customName } = req.body;
    const userId = req.userId;

    // Validate item ID
    if (!Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backpack item ID'
      });
    }

    // Validate project ID
    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid project ID is required'
      });
    }

    // Validate user ID
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Find the user's backpack
    const backpack = await Backpack.findOne({ userId: new Types.ObjectId(userId) });
    if (!backpack) {
      return res.status(404).json({
        success: false,
        message: 'Backpack not found'
      });
    }

    // Find the specific backpack item
    const backpackItem = backpack.items.find(
      item => item._id.toString() === itemId
    );

    if (!backpackItem) {
      return res.status(404).json({
        success: false,
        message: 'Backpack item not found'
      });
    }

    // Verify project exists and belongs to user
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    let newAsset;

    // Handle based on item type
    if (backpackItem.itemType === BackpackItemType.TEMPLATE) {
      // Find the template
      const template = await Template.findById(backpackItem.itemId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      // Check if template is already added to this project
      const existingAsset = await Asset.findOne({
        projectId: new Types.ObjectId(projectId),
        originalTemplateId: template._id,
        origin: AssetOrigin.TEMPLATE
      });

      if (existingAsset) {
        return res.status(409).json({
          success: false,
          message: 'Template already added to this project',
          data: { asset: existingAsset }
        });
      }

      // Map template type to asset type
      const templateAssetTypeMapping: Record<TemplateType, AssetType> = {
        [TemplateType.VIDEO]: AssetType.VIDEO,
        [TemplateType.AUDIO]: AssetType.AUDIO,
      };

      // Create new asset from template
      newAsset = new Asset({
        name: customName || template.title,
        type: templateAssetTypeMapping[template.type],
        code: template.code,
        scene_name: template.scene_name,
        scene_description: template.scene_description,
        origin: AssetOrigin.TEMPLATE,
        url: template.url,
        thumbnail: template.thumbnail || '',
        duration: template.duration,
        bytes: template.bytes,
        projectId: new Types.ObjectId(projectId),
        originalTemplateId: template._id,
        metadata: {
          ...template.metadata,
          isFromTemplate: true,
          isFromBackpack: true,
          originalTemplateName: template.title,
          backpackNotes: backpackItem.notes
        }
      });

    } else  {
    // if (backpackItem.itemType === BackpackItemType.ASSET)
      // Find the original asset
      const originalAsset = await Asset.findById(backpackItem.itemId);
      if (!originalAsset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      // Check if asset is already in this project
      const existingAsset = await Asset.findOne({
        projectId: new Types.ObjectId(projectId),
        url: originalAsset.url,
        name: originalAsset.name
      });

      if (existingAsset) {
        return res.status(409).json({
          success: false,
          message: 'Asset already exists in this project',
          data: { asset: existingAsset }
        });
      }

      // Create new asset (duplicate from backpack)
      newAsset = new Asset({
        name: customName || originalAsset.name,
        type: originalAsset.type,
        code: originalAsset.code,
        scene_name: originalAsset.scene_name,
        scene_description: originalAsset.scene_description,
        origin: originalAsset.origin,
        url: originalAsset.url,
        thumbnail: originalAsset.thumbnail,
        duration: originalAsset.duration,
        width: originalAsset.width,
        height: originalAsset.height,
        bytes: originalAsset.bytes,
        projectId: new Types.ObjectId(projectId),
        originalTemplateId: originalAsset._id,
        metadata: {
          ...originalAsset.metadata,
          isFromBackpack: true,
          originalAssetId: originalAsset._id,
          backpackNotes: backpackItem.notes
        }
      });
    }

    await newAsset.save();

    res.status(201).json({
      success: true,
      message: 'Backpack item successfully added to project',
      data: { asset: newAsset }
    });

  } catch (error) {
    console.error('Error adding backpack item to project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add backpack item to project',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};


// Get backpack by user ID
export const getBackpackByUserId = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Valid User ID is required' });
        }

        let backpack = await Backpack.findOne({ userId })
            .populate({
                path: 'items.itemId',
                select: 'name url thumbnail duration type bytes metadata scene_name scene_description title post_description'
            })
            .exec();

        // Create backpack if it doesn't exist
        if (!backpack) {
            backpack = await Backpack.create({ userId, items: [] });
        }

        res.status(200).json({
            "success": true,
            "backpack": backpack
        });
    } catch (error) {
        console.error('Error fetching backpack:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get backpack by user ID
export const getBackpackByUserIdDashboard = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Valid User ID is required' });
        }

        // Validate projectId if provided
        if (projectId && !Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }

        let backpack = await Backpack.findOne({ userId })
            .populate({
                path: 'items.itemId',
                select: 'name url thumbnail duration type bytes metadata scene_name scene_description title post_description'
            })
            .exec();

        // Create backpack if it doesn't exist
        if (!backpack) {
            backpack = await Backpack.create({ userId, items: [] });
        }

        // If projectId is provided, check which items are already in the project
        if (projectId && backpack.items.length > 0) {
            // Separate template IDs and asset URLs for efficient querying
            const templateIds: Types.ObjectId[] = [];
            const assetUrls: string[] = [];
            const assetNames: string[] = [];

            backpack.items.forEach(item => {
                if (item.itemType === BackpackItemType.TEMPLATE) {
                    templateIds.push(item.itemId as Types.ObjectId);
                } else if (item.itemType === BackpackItemType.ASSET && item.itemId) {
                    const populatedAsset = item.itemId as any;
                    if (populatedAsset.url) assetUrls.push(populatedAsset.url);
                    if (populatedAsset.name) assetNames.push(populatedAsset.name);
                }
            });

            // Query assets in the project that match backpack items
            const existingAssets = await Asset.find({
                projectId: new Types.ObjectId(projectId),
                $or: [
                    // Check for templates added to project
                    {
                        origin: AssetOrigin.TEMPLATE,
                        originalTemplateId: { $in: templateIds }
                    },
                    // Check for assets added to project (match by URL and name)
                    {
                        url: { $in: assetUrls },
                        name: { $in: assetNames }
                    }
                ]
            }).select('originalTemplateId url name');

            // Create lookup maps for O(1) checking
            const templateInProjectMap = new Set(
                existingAssets
                    .filter(asset => asset.originalTemplateId)
                    .map(asset => asset.originalTemplateId!.toString())
            );

            const assetInProjectMap = new Set(
                existingAssets
                    .filter(asset => !asset.originalTemplateId)
                    .map(asset => `${asset.url}:${asset.name}`)
            );

            // Add isAddedToProject field to each item
            const itemsWithProjectStatus = backpack.items.map(item => {
                let isAddedToProject = false;

                if (item.itemType === BackpackItemType.TEMPLATE) {
                    const itemIdStr = (item.itemId as Types.ObjectId).toString();
                    isAddedToProject = templateInProjectMap.has(itemIdStr);
                } else if (item.itemType === BackpackItemType.ASSET) {
                    const populatedAsset = item.itemId as any;
                    if (populatedAsset?.url && populatedAsset?.name) {
                        isAddedToProject = assetInProjectMap.has(
                            `${populatedAsset.url}:${populatedAsset.name}`
                        );
                    }
                }

                return {
                    ...JSON.parse(JSON.stringify(item)),
                    isAddedToProject
                };
            });

            return res.status(200).json({
                success: true,
                backpack: {
                    ...backpack.toObject(),
                    items: itemsWithProjectStatus
                }
            });
        }

        // If no projectId provided, return backpack as-is
        res.status(200).json({
            success: true,
            backpack: backpack
        });
    } catch (error) {
        console.error('Error fetching backpack:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Add item to backpack
export const addItemToBackpack = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { itemType, itemId, source, sourceId, favourite = false } = req.body;

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Valid User ID is required' });
        }

        if (!itemType || !Object.values(BackpackItemType).includes(itemType)) {
            return res.status(400).json({ error: 'Valid itemType is required' });
        }

        if (!itemId || !Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ error: 'Valid itemId is required' });
        }

        if (!source || !Object.values(BackpackItemSource).includes(source)) {
            return res.status(400).json({ error: 'Valid source is required' });
        }

        if (!sourceId || !Types.ObjectId.isValid(sourceId)) {
            return res.status(400).json({ error: 'Valid sourceId is required' });
        }

        let item;

        if (itemType === BackpackItemType.ASSET) {
            item = await Asset.findById(itemId);
        } else {
            item = await Template.findById(itemId);
        }

        if (!item) {
            return res.status(404).json({ error: `${itemType} not found` });
        }

        if (!item) {
            return res.status(404).json({ error: `${itemType} not found` });
        }

        let backpack = await Backpack.findOne({ userId });

        // Create backpack if it doesn't exist
        if (!backpack) {
            backpack = await Backpack.create({ userId, items: [] });
        }

        // Check if item already exists in backpack
        const existingItem = backpack.items.find(
            (i) => i.itemId.toString() === itemId && i.itemType === itemType
        );

        if (existingItem) {
            return res.status(400).json({ error: 'Item already exists in backpack' });
        }

        // Add new item
        const newItem: Partial<IBackpackItem> = {
            _id: new Types.ObjectId(),
            itemType,
            itemId: new Types.ObjectId(itemId),
            favourite,
            source,
            sourceId: new Types.ObjectId(sourceId),
            tags: [],
            addedAt: new Date()
        };

        backpack.items.push(newItem as IBackpackItem);
        backpack.totalItems = backpack.items.length;
        backpack.totalBytes += item.bytes || 0;

        await backpack.save();

        const updatedBackpack = await Backpack.findOne({ userId })
            .populate({
                path: 'items.itemId',
                select: 'name url thumbnail duration type bytes metadata'
            });

        res.status(201).json({
            success: true,
            message: 'Item added to backpack',
            backpack: updatedBackpack
        });
    } catch (error) {
        console.error('Error adding item to backpack:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Remove item from backpack
export const removeItemFromBackpack = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { itemId } = req.params;

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Valid User ID is required' });
        }

        if (!itemId || !Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ error: 'Valid item ID is required' });
        }

        const backpack = await Backpack.findOne({ userId });

        if (!backpack) {
            return res.status(404).json({ error: 'Backpack not found' });
        }

        const itemIndex = backpack.items.findIndex(
            (i) => i._id.toString() === itemId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not found in backpack' });
        }

        const removedItem = backpack.items[itemIndex];

        // Get item bytes before removing
        let itemBytes = 0;
        if (removedItem.itemType === BackpackItemType.ASSET) {
            const asset = await Asset.findById(removedItem.itemId);
            itemBytes = asset?.bytes || 0;
        } else {
            const template = await Template.findById(removedItem.itemId);
            itemBytes = template?.bytes || 0;
        }

        backpack.items.splice(itemIndex, 1);
        backpack.totalItems = backpack.items.length;
        backpack.totalBytes = Math.max(0, backpack.totalBytes - itemBytes);

        await backpack.save();

        const updatedBackpack = await Backpack.findOne({ userId })
            .populate({
                path: 'items.itemId',
                select: 'name url thumbnail duration type bytes metadata'
            });

        res.status(200).json({
            success: true,
            message: 'Item removed from backpack',
            backpack: updatedBackpack
        });
    } catch (error) {
        console.error('Error removing item from backpack:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Toggle favourite status
export const toggleFavourite = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { itemId } = req.params;

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Valid User ID is required' });
        }

        if (!itemId || !Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ error: 'Valid item ID is required' });
        }

        const backpack = await Backpack.findOne({ userId });

        if (!backpack) {
            return res.status(404).json({ error: 'Backpack not found' });
        }

        const item = backpack.items.find((i) => i._id.toString() === itemId);

        if (!item) {
            return res.status(404).json({ error: 'Item not found in backpack' });
        }

        item.favourite = !item.favourite;
        await backpack.save();

        const updatedBackpack = await Backpack.findOne({ userId })
            .populate({
                path: 'items.itemId',
                select: 'name url thumbnail duration type bytes metadata'
            });

        res.status(200).json({
            success: true,
            message: 'Favourite status updated',
            backpack: updatedBackpack
        });
    } catch (error) {
        console.error('Error toggling favourite:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update item notes
export const updateItemNotes = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { itemId } = req.params;
        const { notes } = req.body;

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Valid User ID is required' });
        }

        if (!itemId || !Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ error: 'Valid item ID is required' });
        }

        const backpack = await Backpack.findOne({ userId });

        if (!backpack) {
            return res.status(404).json({ error: 'Backpack not found' });
        }

        const item = backpack.items.find((i) => i._id.toString() === itemId);

        if (!item) {
            return res.status(404).json({ error: 'Item not found in backpack' });
        }

        item.notes = notes;
        await backpack.save();

        const updatedBackpack = await Backpack.findOne({ userId })
            .populate({
                path: 'items.itemId',
                select: 'name url thumbnail duration type bytes metadata'
            });

        res.status(200).json({
            success: true,
            message: 'Notes updated',
            backpack: updatedBackpack
        });
    } catch (error) {
        console.error('Error updating notes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get backpack statistics
export const getBackpackStats = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Valid User ID is required' });
        }

        const backpack = await Backpack.findOne({ userId });

        if (!backpack) {
            return res.status(404).json({
                totalItems: 0,
                totalBytes: 0,
                assetCount: 0,
                templateCount: 0,
                favouriteCount: 0
            });
        }

        const stats = {
            totalItems: backpack.totalItems,
            totalBytes: backpack.totalBytes,
            assetCount: backpack.items.filter(i => i.itemType === BackpackItemType.ASSET).length,
            templateCount: backpack.items.filter(i => i.itemType === BackpackItemType.TEMPLATE).length,
            favouriteCount: backpack.items.filter(i => i.favourite).length
        };

        res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching backpack stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get filtered backpack items
export const getFilteredBackpackItems = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { itemType, favourite, source } = req.query;

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Valid User ID is required' });
        }

        const backpack = await Backpack.findOne({ userId })
            .populate({
                path: 'items.itemId',
                select: 'name url thumbnail duration type bytes metadata'
            });

        if (!backpack) {
            return res.status(404).json({ error: 'Backpack not found' });
        }

        let filteredItems = backpack.items;

        if (itemType) {
            filteredItems = filteredItems.filter(i => i.itemType === itemType);
        }

        if (favourite !== undefined) {
            const isFavourite = favourite === 'true';
            filteredItems = filteredItems.filter(i => i.favourite === isFavourite);
        }

        if (source) {
            filteredItems = filteredItems.filter(i => i.source === source);
        }

        res.status(200).json({
            items: filteredItems,
            count: filteredItems.length
        });
    } catch (error) {
        console.error('Error fetching filtered backpack items:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};