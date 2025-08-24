import {Schema, Document, Types, Model, model} from "mongoose";

export interface ITemplateLike extends Document {
    userId: Types.ObjectId;
    templateId: Types.ObjectId;
    createdAt: Date;
}

const TemplateLikeSchema = new Schema<ITemplateLike>({
    userId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    templateId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Template', 
        required: true 
    }
}, { 
    timestamps: true 
});

// Compound index to ensure one like per user per template
TemplateLikeSchema.index({ userId: 1, templateId: 1 }, { unique: true });

// Index for efficient querying
TemplateLikeSchema.index({ templateId: 1 });

const TemplateLike: Model<ITemplateLike> = model<ITemplateLike>('TemplateLike', TemplateLikeSchema);
export { TemplateLike };