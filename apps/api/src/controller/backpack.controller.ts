import { Request, Response } from 'express';
import Backpack, { BackpackItemType, BackpackItemSource, IBackpackItem } from '../model/backpack.model';
import Asset from '../model/asset.model';
import Template from '../model/template.model';
import { Types } from 'mongoose';

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
                select: 'name url thumbnail duration type bytes metadata summary prompt'
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