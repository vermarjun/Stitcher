import {Schema, Document, Model, model, Types} from "mongoose";

export enum TemplateType {
  VIDEO = 'video',
  AUDIO = 'audio',
}

export interface ITemplate extends Document {
    name: string;
    description?: string;
    type: TemplateType;
    thumbnail?: string; 
    url: string; 
    duration?: number;
    bytes: number;
    metadata: Record<string, any>;
    // Virtual fields for frontend
    likesCount?: number;
    isLikedByUser?: boolean;
    isInProject?: boolean;  // New field to show if template is already in current project
    projectAssetId?: string; // ID of the asset if already in project (for easy removal)
}

const TemplateSchema = new Schema<ITemplate>({
    name: { 
        type: String, 
        required: true,
        unique: true,
    },
    description: { 
        type: String,
    },
    type: { 
        type: String, 
        enum: Object.values(TemplateType), 
        required: true,
    },
    thumbnail: { 
        type: String, 
        required: true,
        default: ""
    },
    url: { 
        type: String, 
        required: true 
    },
    duration: { 
        type: Number,
        min: 0
    },
    bytes: { 
        type: Number, 
        default: 0,
        min: 0
    },
    metadata: { 
        type: Schema.Types.Mixed, 
        default: {} 
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for likes count (will be populated via aggregation)
TemplateSchema.virtual('likesCount', {
    ref: 'TemplateLike',
    localField: '_id',
    foreignField: 'templateId',
    count: true
});

const Template: Model<ITemplate> = model<ITemplate>('Template', TemplateSchema);
export default Template;
