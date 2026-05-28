import { Schema, model, Document } from 'mongoose';

export interface IYDoc extends Document {
  projectId: string;
  state: Buffer;
  updatedAt: Date;
}

const ydocSchema = new Schema<IYDoc>(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    state: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: 'updatedAt' } },
);

export const YDocModel = model<IYDoc>('YDoc', ydocSchema, 'ydocs');
