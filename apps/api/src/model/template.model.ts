import {Schema, Document, Model, model} from "mongoose";

export enum TemplateType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'images',
  GIF = 'gifs'
}

export interface ITemplate extends Document {
    name: string;
    description?: string;
    type: TemplateType; // Fixed: was ITemplate, should be TemplateType
    thumbnail?: string; // Not added in case of images, else always added.
    url: string; 
    duration?: number;
    bytes: number;
    metadata: Record<string, any>;
    tags?: string[];
}

const TemplateSchema = new Schema<ITemplate>({
    name: { 
        type: String, 
        required: true,
        unique: true, // Prevent duplicate template names
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
        required: true 
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
    },
    tags: [{
        type: String,
    }],
}, { 
    timestamps: true,
});

const Template: Model<ITemplate> = model<ITemplate>('Template', TemplateSchema);
export default Template;