/**
 * True when the user owns the project (the project id is in user.projects).
 * Used by the ownership middleware and the Socket.IO join_project handler.
 * Each project belongs to exactly one user.
 */
import { Types } from 'mongoose';
import User from '../model/user.model';

export async function canAccessProject(userId: string, projectId: string): Promise<boolean> {
  const isOwner = await User.exists({
    _id: new Types.ObjectId(userId),
    projects: new Types.ObjectId(projectId),
  });
  return !!isOwner;
}
