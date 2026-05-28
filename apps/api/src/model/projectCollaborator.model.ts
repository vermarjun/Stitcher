import { Schema, Document, Types, Model, model } from 'mongoose';

export interface IProjectCollaborator extends Document {
  projectId: Types.ObjectId;
  userId: Types.ObjectId | null;
  invitedEmail: string;
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  invitedBy: Types.ObjectId;
  createdAt: Date;
  respondedAt?: Date;
}

const ProjectCollaboratorSchema = new Schema<IProjectCollaborator>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    invitedEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['editor', 'viewer'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    respondedAt: {
      type: Date,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Prevent duplicate invites for the same project+email
ProjectCollaboratorSchema.index({ projectId: 1, invitedEmail: 1 }, { unique: true });

const ProjectCollaborator: Model<IProjectCollaborator> = model<IProjectCollaborator>(
  'ProjectCollaborator',
  ProjectCollaboratorSchema
);

export default ProjectCollaborator;
