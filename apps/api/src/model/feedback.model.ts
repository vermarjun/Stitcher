import { Schema, Document, Types, model } from "mongoose";

export interface IFeedback extends Document {
    userId: Types.ObjectId;
    type: "Bug" | "Idea" | "Other";
    message: string;
    status: "new" | "triaged" | "resolved";
    adminNote?: string;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["Bug", "Idea", "Other"],
            required: true,
        },
        message: {
            type: String,
            required: true,
            maxlength: 5000,
        },
        status: {
            type: String,
            enum: ["new", "triaged", "resolved"],
            default: "new",
            index: true,
        },
        adminNote: {
            type: String,
        },
        resolvedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

FeedbackSchema.index({ status: 1, createdAt: -1 });
FeedbackSchema.index({ type: 1, createdAt: -1 });

const Feedback = model<IFeedback>("Feedback", FeedbackSchema);
export default Feedback;
