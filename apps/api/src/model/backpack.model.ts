import { Schema, Document, Types, Model, model } from "mongoose";

// Enum for item types in backpack
export enum BackpackItemType {
  ASSET = 'Asset',
  TEMPLATE = 'Template'
}

// Enum for tracking where the item was added from
export enum BackpackItemSource {
  PROJECT = 'project',
  COMMUNITY_POST = 'community_post',
  TEMPLATE_LIBRARY = 'template_library'
}

// Interface for individual backpack items
export interface IBackpackItem {
  _id: Types.ObjectId;
  itemType: BackpackItemType;
  itemId: Types.ObjectId; // Reference to Asset or Template
  favourite: Boolean;
  
  // Source tracking
  source: BackpackItemSource; 
  sourceId?: Types.ObjectId; // ProjectId or CommunityPostId where it was added from
  
  // Organization
  tags: string[];
  notes?: string; // User's personal notes about the item
  
  addedAt: Date;
}

// Main Backpack interface
export interface IBackpack extends Document {
  userId: Types.ObjectId;
  items: IBackpackItem[];
  
  // Statistics
  totalItems: number;
  totalBytes: number;
}

// Schema for backpack items
const BackpackItemSchema = new Schema({
  itemType: {
    type: String,
    enum: Object.values(BackpackItemType),
    required: true
  },
  itemId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'items.itemType' // Dynamic reference based on itemType
  },
  favourite:{
    type: Boolean,
    required: true,
    default: false
  },
  
  // Source tracking
  source: {
    type: String,
    enum: Object.values(BackpackItemSource),
    required: true
  },
  sourceId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Main Backpack Schema
const BackpackSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Each user has only one backpack
    index: true
  },
  
  items: [BackpackItemSchema],
  
  // Statistics (updated via middleware)
  totalItems: {
    type: Number,
    default: 0
  },
  totalBytes: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Backpack: Model<IBackpack> = model<IBackpack>('Backpack', BackpackSchema);

export default Backpack;