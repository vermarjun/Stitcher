import { Request, Response } from 'express';
import Template, { TemplateType } from '../model/template.model';
import Asset, { AssetType } from '../model/asset.model';
import { Types } from 'mongoose';

// GET /templates - Fetch all templates with optional filtering
const fetchAllTemplates = async (req: Request, res: Response) => {
  try {
    const { 
      type, 
      page = 1, 
      limit = 20, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = {};
    
    if (type && Object.values(TemplateType).includes(type as TemplateType)) {
      filter.type = type;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [templates, total] = await Promise.all([
      Template.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Template.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        templates,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// GET /templates/:id - Get single template by ID
const getTemplateById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID'
      });
    }

    const template = await Template.findById(id).lean();

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// POST /templates/:id/add-to-project - Add template to project as asset
const addTemplateToProject =  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId, customName } = req.body;

    // Validate template ID
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID'
      });
    }

    // Validate project ID
    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid project ID is required'
      });
    }

    // Find the template
    const template = await Template.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Map template type to asset type
    const assetTypeMapping: Record<TemplateType, AssetType> = {
      [TemplateType.VIDEO]: AssetType.VIDEO,
      [TemplateType.AUDIO]: AssetType.AUDIO,
      [TemplateType.IMAGE]: AssetType.IMAGE,
      [TemplateType.GIF]: AssetType.IMAGE, // GIFs are treated as images
    };

    // Check if template is already added to this project
    const existingAsset = await Asset.findOne({
      projectId: new Types.ObjectId(projectId),
      'metadata.templateId': template._id
    });

    if (existingAsset) {
      return res.status(409).json({
        success: false,
        message: 'Template already added to this project',
        data: { asset: existingAsset }
      });
    }

    // Create new asset from template
    const newAsset = new Asset({
      name: customName || template.name,
      type: assetTypeMapping[template.type],
      url: template.url,
      duration: template.duration,
      bytes: template.bytes,
      projectId: new Types.ObjectId(projectId),
      metadata: {
        ...template.metadata,
        templateId: template._id,
        isFromTemplate: true,
        originalTemplateName: template.name
      }
    });

    await newAsset.save();

    res.status(201).json({
      success: true,
      message: 'Template successfully added to project',
      data: { asset: newAsset }
    });
  } catch (error) {
    console.error('Error adding template to project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add template to project',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// POST /templates - Create new template (Admin only)
const createNewTemplate = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      type,
      thumbnail,
      url,
      duration,
      bytes,
      metadata = {}
    } = req.body;

    // Validation
    if (!name || !type || !thumbnail || !url) {
      return res.status(400).json({
        success: false,
        message: 'Name, type, thumbnail, and URL are required'
      });
    }

    if (!Object.values(TemplateType).includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template type'
      });
    }

    // Check for duplicate template names
    const existingTemplate = await Template.findOne({ name });
    if (existingTemplate) {
      return res.status(409).json({
        success: false,
        message: 'Template with this name already exists'
      });
    }

    const newTemplate = new Template({
      name,
      description,
      type,
      thumbnail,
      url,
      duration,
      bytes: bytes || 0,
      metadata
    });

    await newTemplate.save();

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: { template: newTemplate }
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// PUT /templates/:id - Update template (Admin only)
const updateTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID'
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Validate type if provided
    if (updateData.type && !Object.values(TemplateType).includes(updateData.type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template type'
      });
    }

    const updatedTemplate = await Template.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: { template: updatedTemplate }
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update template',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// DELETE /templates/:id - Delete template (Admin only)
const deleteTemplate =  async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID'
      });
    }

    const deletedTemplate = await Template.findByIdAndDelete(id);

    if (!deletedTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Optionally, you might want to handle assets that were created from this template
    // For now, we'll just delete the template and leave the assets as they are
    // since they're now part of user projects

    res.json({
      success: true,
      message: 'Template deleted successfully',
      data: { template: deletedTemplate }
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export {deleteTemplate, updateTemplate, createNewTemplate, getTemplateById, addTemplateToProject, fetchAllTemplates}