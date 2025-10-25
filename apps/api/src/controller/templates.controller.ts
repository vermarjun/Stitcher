import { Request, Response } from 'express';
import Template, { TemplateType } from '../model/template.model';
import Asset, { AssetType, AssetOrigin } from '../model/asset.model';
import { TemplateLike } from '../model/templateLike.model';
import { Types } from 'mongoose';
import Backpack from '../model/backpack.model';

// GET /templates - Fetch all templates with optional filtering, likes, and project status
const fetchAllTemplates = async (req: Request, res: Response) => {
  try {
    const { 
      type, 
      page = 1, 
      limit = 20, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      projectId, // To check if templates are already in project
      isAddedToBackpackAttach, // To tell backend to attach isAddedToBackpack field to templates that are already in backpack
    } = req.query;
    const userId = req.userId;
    
    // Build filter object
    const filter: any = {};
    
    if (type && Object.values(TemplateType).includes(type as TemplateType)) {
      filter.type = type;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { post_description: { $regex: search, $options: 'i' } },
        { scene_name: { $regex: search, $options: 'i' } },
        { scene_description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;
    
    // Sort options
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;
    
    // Aggregation pipeline to get templates with likes count and user interaction data
    const aggregationPipeline: any[] = [
      { $match: filter },
      // Join with TemplateLike to get likes count
      {
        $lookup: {
          from: 'templatelikes',
          localField: '_id',
          foreignField: 'templateId',
          as: 'likes'
        }
      },
      // Add likesCount field
      {
        $addFields: {
          likesCount: { $size: '$likes' }
        }
      }
    ];
    
    // If userId provided, check if user has liked each template
    if (userId && Types.ObjectId.isValid(userId as string)) {
      aggregationPipeline.push({
        $addFields: {
          isLikedByUser: {
            $in: [new Types.ObjectId(userId as string), '$likes.userId']
          }
        }
      });
    } else {
      aggregationPipeline.push({
        $addFields: {
          isLikedByUser: false
        }
      });
    }
    
    // If projectId provided, check if templates are already in project
    if (projectId && Types.ObjectId.isValid(projectId as string)) {
      aggregationPipeline.push(
        {
          $lookup: {
            from: 'assets',
            let: { templateId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$projectId', new Types.ObjectId(projectId as string)] },
                      { $eq: ['$originalTemplateId', '$$templateId'] },
                      { $eq: ['$origin', AssetOrigin.TEMPLATE] }
                    ]
                  }
                }
              }
            ],
            as: 'projectAssets'
          }
        },
        {
          $addFields: {
            isInProject: { $gt: [{ $size: '$projectAssets' }, 0] },
            projectAssetId: { $arrayElemAt: ['$projectAssets._id', 0] }
          }
        }
      );
    } else {
      aggregationPipeline.push({
        $addFields: {
          isInProject: false,
          projectAssetId: null
        }
      });
    }
    
    // If backpackId provided, check if templates are already in backpack
    let backpackId = "";
    if (isAddedToBackpackAttach){
      const backpack = await Backpack.findOne({ userId });
      if (backpack != null){
        backpackId = backpack._id as string;
      }
    }
    if (isAddedToBackpackAttach && Types.ObjectId.isValid(backpackId as string)) {
      aggregationPipeline.push(
        {
          $lookup: {
            from: 'backpacks',
            let: { templateId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$_id', new Types.ObjectId(backpackId as string)]
                  }
                }
              },
              {
                $project: {
                  items: {
                    $filter: {
                      input: '$items',
                      as: 'item',
                      cond: {
                        $and: [
                          { $eq: ['$$item.itemType', 'Template'] },
                          { $eq: ['$$item.itemId', '$$templateId'] }
                        ]
                      }
                    }
                  }
                }
              }
            ],
            as: 'backpackItems'
          }
        },
        {
          $addFields: {
            isAddedToBackpack: {
              $gt: [
                { 
                  $size: { 
                    $arrayElemAt: ['$backpackItems.items', 0] 
                  } 
                },
                0
              ]
            }
          }
        }
      );
    } else {
      aggregationPipeline.push({
        $addFields: {
          isAddedToBackpack: false
        }
      });
    }
    
    // Remove the likes array and backpackItems as we only need the computed fields
    aggregationPipeline.push({
      $project: {
        likes: 0,
        projectAssets: 0,
        backpackItems: 0
      }
    });
    
    // Add sorting and pagination
    aggregationPipeline.push(
      { $sort: sortOptions },
      { $skip: skip },
      { $limit: limitNum }
    );
    
    // Execute aggregation and count query
    const [templates, total] = await Promise.all([
      Template.aggregate(aggregationPipeline),
      Template.countDocuments(filter)
    ]);
    
    res.status(201).json({
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

// GET /templates/:id - Get single template by ID with likes and project status
const getTemplateById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;
    const userId = req.userId;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID'
      });
    }

    const aggregationPipeline: any[] = [
      { $match: { _id: new Types.ObjectId(id) } },
      // Join with TemplateLike to get likes count
      {
        $lookup: {
          from: 'templatelikes',
          localField: '_id',
          foreignField: 'templateId',
          as: 'likes'
        }
      },
      // Add likesCount field
      {
        $addFields: {
          likesCount: { $size: '$likes' }
        }
      }
    ];

    // Check if user has liked this template
    if (userId && Types.ObjectId.isValid(userId as string)) {
      aggregationPipeline.push({
        $addFields: {
          isLikedByUser: {
            $in: [new Types.ObjectId(userId as string), '$likes.userId']
          }
        }
      });
    } else {
      aggregationPipeline.push({
        $addFields: {
          isLikedByUser: false
        }
      });
    }

    // Check if template is in project
    if (projectId && Types.ObjectId.isValid(projectId as string)) {
      aggregationPipeline.push(
        {
          $lookup: {
            from: 'assets',
            let: { templateId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$projectId', new Types.ObjectId(projectId as string)] },
                      { $eq: ['$originalTemplateId', '$$templateId'] },
                      { $eq: ['$origin', AssetOrigin.TEMPLATE] }
                    ]
                  }
                }
              }
            ],
            as: 'projectAssets'
          }
        },
        {
          $addFields: {
            isInProject: { $gt: [{ $size: '$projectAssets' }, 0] },
            projectAssetId: { $arrayElemAt: ['$projectAssets._id', 0] }
          }
        }
      );
    } else {
      aggregationPipeline.push({
        $addFields: {
          isInProject: false,
          projectAssetId: null
        }
      });
    }

    // Remove unnecessary fields
    aggregationPipeline.push({
      $project: {
        likes: 0,
        projectAssets: 0
      }
    });

    const result = await Template.aggregate(aggregationPipeline);
    const template = result[0];

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
const addTemplateToProject = async (req: Request, res: Response) => {
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
    };

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

    // Create new asset from template
    const newAsset = new Asset({
      name: customName || template.title, // Changed from template.name to template.title
      type: assetTypeMapping[template.type],
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
        originalTemplateName: template.title, // Changed from template.name to template.title
      },
      scene_name: template.scene_name,
      scene_description: template.scene_description,
      code: template.code
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

// POST /templates/:id/like - Toggle like for template
const toggleTemplateLike = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Validate template ID
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID'
      });
    }

    // Validate user ID
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid user ID is required'
      });
    }

    // Check if template exists
    const template = await Template.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const userObjectId = new Types.ObjectId(userId);
    const templateObjectId = new Types.ObjectId(id);

    // Check if like already exists
    const existingLike = await TemplateLike.findOne({
      userId: userObjectId,
      templateId: templateObjectId
    });

    if (existingLike) {
      // Unlike - remove the like
      await TemplateLike.deleteOne({
        userId: userObjectId,
        templateId: templateObjectId
      });

      // Get updated likes count
      const likesCount = await TemplateLike.countDocuments({
        templateId: templateObjectId
      });

      res.json({
        success: true,
        message: 'Template unliked successfully',
        data: {
          isLiked: false,
          likesCount
        }
      });
    } else {
      // Like - create new like
      const newLike = new TemplateLike({
        userId: userObjectId,
        templateId: templateObjectId
      });

      await newLike.save();

      // Get updated likes count
      const likesCount = await TemplateLike.countDocuments({
        templateId: templateObjectId
      });

      res.json({
        success: true,
        message: 'Template liked successfully',
        data: {
          isLiked: true,
          likesCount
        }
      });
    }
  } catch (error) {
    console.error('Error toggling template like:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle template like',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// POST /templates - Create new template (Admin only)
const createNewTemplate = async (req: Request, res: Response) => {
  try {
    const {
      title, // Changed from name to title
      post_description, // Changed from description to post_description
      type,
      thumbnail,
      url,
      duration,
      bytes,
      metadata = {},
      scene_name, // New field
      scene_description, // New field
      code // New field
    } = req.body;
    
    // Validation
    if (!title || !type || !thumbnail || !url) { // Changed from name to title
      return res.status(400).json({
        success: false,
        message: 'Title, type, thumbnail, and URL are required' // Changed from Name to Title
      });
    }

    if (!Object.values(TemplateType).includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template type'
      });
    }

    // Check for duplicate template titles (was names)
    const existingTemplate = await Template.findOne({ title }); // Changed from name to title
    if (existingTemplate) {
      return res.status(409).json({
        success: false,
        message: 'Template with this title already exists' // Changed from name to title
      });
    }

    const newTemplate = new Template({
      title, // Changed from name to title
      post_description, // Changed from description to post_description
      type,
      thumbnail,
      url,
      duration,
      bytes: bytes || 0,
      metadata,
      scene_name: scene_name || "", // New field
      scene_description: scene_description || "", // New field
      code: code || "" // New field
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
const deleteTemplate = async (req: Request, res: Response) => {
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

    // Clean up associated likes
    await TemplateLike.deleteMany({ templateId: new Types.ObjectId(id) });

    // Note: We don't delete assets created from this template as they are now
    // independent resources in user projects

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

export {
  deleteTemplate,
  updateTemplate,
  createNewTemplate,
  getTemplateById,
  addTemplateToProject,
  fetchAllTemplates,
  toggleTemplateLike,
};