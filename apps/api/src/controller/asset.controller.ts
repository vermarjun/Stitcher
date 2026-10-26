import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Asset, { AssetType, AssetOrigin } from '../model/asset.model';
import User from '../model/user.model';
import { Types } from 'mongoose';
import { spawn } from 'child_process';
import { storage } from '../storage';
import { canAccessProject } from '../util/projectAccess.util';
import { probeMedia } from '../util/probe.util';
import logger from '../util/logger.util';

/** Ids of every project the user owns. Used to scope list queries. */
async function ownedProjectIds(userId: string): Promise<Types.ObjectId[]> {
  const user = await User.findById(userId).select('projects').lean();
  return (user?.projects ?? []) as Types.ObjectId[];
}

/** Add a projectId filter that can only match projects the user owns. */
async function scopeToOwnedProjects(filter: Record<string, any>, userId: string, requested?: unknown): Promise<boolean> {
  const owned = await ownedProjectIds(userId);
  if (requested && Types.ObjectId.isValid(requested as string)) {
    const wanted = new Types.ObjectId(requested as string);
    if (!owned.some((id) => id.equals(wanted))) return false;
    filter.projectId = wanted;
  } else {
    filter.projectId = { $in: owned };
  }
  return true;
}

/**
 * Extract ~200 amplitude peaks from an audio URL using ffmpeg.
 * Returns null if ffmpeg is unavailable or the URL is not reachable.
 */
async function extractWaveformPeaks(audioUrl: string, targetPoints = 200): Promise<number[] | null> {
  return new Promise((resolve) => {
    try {
      // Resample to mono 8 kHz, output raw float32-le on stdout
      const ffmpeg = spawn('ffmpeg', [
        '-i', audioUrl,
        '-ac', '1',
        '-ar', '8000',
        '-map', '0:a',
        '-f', 'f32le',
        '-',
      ], { stdio: ['ignore', 'pipe', 'ignore'] });

      const chunks: Buffer[] = [];

      ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));

      ffmpeg.on('error', () => resolve(null));

      ffmpeg.on('close', (code) => {
        if (code !== 0) { resolve(null); return; }
        try {
          const raw = Buffer.concat(chunks);
          // raw is a sequence of float32le samples
          const totalSamples = Math.floor(raw.length / 4);
          if (totalSamples === 0) { resolve(null); return; }

          const blockSize = Math.max(1, Math.floor(totalSamples / targetPoints));
          const peaks: number[] = [];

          for (let i = 0; i < targetPoints; i++) {
            const start = i * blockSize * 4;
            const end = Math.min(start + blockSize * 4, raw.length);
            let maxAbs = 0;
            for (let j = start; j < end; j += 4) {
              const sample = Math.abs(raw.readFloatLE(j));
              if (sample > maxAbs) maxAbs = sample;
            }
            peaks.push(maxAbs);
          }

          resolve(peaks);
        } catch {
          resolve(null);
        }
      });

      // Safety timeout — don't block asset saving for more than 30 s
      setTimeout(() => { ffmpeg.kill(); resolve(null); }, 30_000);
    } catch {
      resolve(null);
    }
  });
}


const FORBIDDEN_JSON = { success: false, message: 'forbidden' };

// Create a new asset record (for a file that is already hosted somewhere)
export const createAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      type,
      origin,
      url,
      code,
      thumbnail,
      duration,
      width,
      height,
      bytes,
      metadata,
      projectId,
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

    if (!(await canAccessProject(req.userId!, projectId))) {
      res.status(403).json(FORBIDDEN_JSON);
      return;
    }

    const asset = new Asset({
      name,
      type,
      code: code || "",
      origin,
      url,
      thumbnail: thumbnail || '',
      duration,
      width,
      height,
      bytes: bytes || 0,
      metadata: metadata || {},
      projectId,
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

    if (projectId && !Types.ObjectId.isValid(projectId as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid projectId format'
      });
      return;
    }
    if (!(await scopeToOwnedProjects(filter, req.userId!, projectId))) {
      res.status(403).json(FORBIDDEN_JSON);
      return;
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

    // Sorting. Only plain top-level fields are sortable.
    const sortField = /^[A-Za-z_]+$/.test(sortBy as string) ? (sortBy as string) : 'createdAt';
    const sort: any = {};
    sort[sortField] = sortOrder === 'desc' ? -1 : 1;

    const [assets, total] = await Promise.all([
      Asset.find(filter)
        .populate('projectId', 'name')
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

    const asset = await Asset.findById(id).populate('projectId', 'name');

    if (!asset) {
      res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
      return;
    }

    const owningProjectId = String((asset.projectId as any)?._id ?? asset.projectId);
    if (!(await canAccessProject(req.userId!, owningProjectId))) {
      res.status(403).json(FORBIDDEN_JSON);
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

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid asset ID format'
      });
      return;
    }

    const existing = await Asset.findById(id).select('projectId').lean();
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
      return;
    }
    if (!(await canAccessProject(req.userId!, String(existing.projectId)))) {
      res.status(403).json(FORBIDDEN_JSON);
      return;
    }

    // Only these fields can be edited. url, type, origin and projectId are fixed.
    const editable = ['name', 'thumbnail', 'duration', 'width', 'height', 'metadata', 'isOnTimeline', 'waveformPeaks'];
    const validUpdates: Record<string, unknown> = {};
    for (const key of editable) {
      if (req.body?.[key] !== undefined) validUpdates[key] = req.body[key];
    }

    const asset = await Asset.findByIdAndUpdate(
      id,
      validUpdates,
      { new: true, runValidators: true }
    ).populate('projectId', 'name');

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

    if (!(await canAccessProject(req.userId!, projectId))) {
      res.status(403).json(FORBIDDEN_JSON);
      return;
    }

    const filter: any = { projectId: new Types.ObjectId(projectId) };

    if (type && Object.values(AssetType).includes(type as AssetType)) {
      filter.type = type;
    }

    if (origin && Object.values(AssetOrigin).includes(origin as AssetOrigin)) {
      filter.origin = origin;
    }

    const assets = await Asset.find(filter).sort({ createdAt: -1 }).lean();

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
    if (!(await scopeToOwnedProjects(filter, req.userId!, projectId))) {
      res.status(403).json(FORBIDDEN_JSON);
      return;
    }

    const assets = await Asset.find(filter)
      .populate('projectId', 'name')
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
    if (!(await scopeToOwnedProjects(filter, req.userId!, projectId))) {
      res.status(403).json(FORBIDDEN_JSON);
      return;
    }

    const assets = await Asset.find(filter)
      .populate('projectId', 'name')
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
    if (!(await scopeToOwnedProjects(filter, req.userId!, projectId))) {
      res.status(403).json(FORBIDDEN_JSON);
      return;
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

// POST /asset/upload
// multipart/form-data: file (video or audio), projectId, optional name.
// The file is written to a temp file by multer, stored through the storage
// layer, probed with ffprobe (best effort) and saved as an Asset.
export const uploadAsset = async (req: Request, res: Response): Promise<void> => {
  const file = req.file;
  try {
    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded. Send it as multipart field "file".' });
      return;
    }

    const mime = file.mimetype || '';
    let type: AssetType;
    if (mime.startsWith('video/')) type = AssetType.VIDEO;
    else if (mime.startsWith('audio/')) type = AssetType.AUDIO;
    else {
      res.status(415).json({ success: false, message: 'Only video and audio files can be uploaded.' });
      return;
    }

    const projectId = req.body?.projectId;
    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ success: false, message: 'A valid projectId is required.' });
      return;
    }
    if (!(await canAccessProject(req.userId!, projectId))) {
      res.status(403).json(FORBIDDEN_JSON);
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10) || (type === AssetType.VIDEO ? '.mp4' : '.mp3');
    const displayName = (typeof req.body?.name === 'string' && req.body.name.trim())
      || path.basename(file.originalname, path.extname(file.originalname)).slice(0, 120)
      || 'upload';

    const key = `uploads/${projectId}/${crypto.randomUUID()}${ext}`;
    const stored = await storage.putFile(file.path, key, { contentType: mime });

    const info = await probeMedia(file.path);
    const waveformPeaks = type === AssetType.AUDIO ? await extractWaveformPeaks(file.path) : null;

    const asset = await Asset.create({
      name: displayName,
      type,
      origin: AssetOrigin.UPLOAD,
      url: stored.url,
      thumbnail: stored.thumbnailUrl ?? '',
      duration: info?.durationSec ?? stored.durationSec,
      width: info?.width,
      height: info?.height,
      bytes: stored.bytes || file.size,
      metadata: { storageKey: stored.key, originalName: file.originalname, mimeType: mime },
      projectId,
      waveformPeaks,
    });

    res.status(201).json({ asset });
  } catch (error) {
    logger.error({ message: '[asset] upload failed', error: String(error) });
    res.status(500).json({ success: false, message: 'Upload failed' });
  } finally {
    if (file?.path) fs.promises.unlink(file.path).catch(() => undefined);
  }
};

// Delete asset from both database and storage
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
    if (!(await canAccessProject(req.userId!, String(asset.projectId)))) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // Remove the stored file. Fall back to the key encoded in a local URL.
    const key: string | null = asset.metadata?.storageKey ?? storage.keyFromUrl(asset.url);
    if (key) {
      try {
        await storage.remove(key);
      } catch (storageError) {
        console.error('Error deleting stored file:', storageError);
        // Continue with database deletion even if the file could not be removed
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
