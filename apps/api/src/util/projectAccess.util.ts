/**
 * Shared helper: checks whether a user may access a project.
 * Used by both requireProjectAccess middleware and the Socket.IO join_project handler.
 *
 * Returns true when:
 *   1. The user owns the project (user.projects contains projectId), OR
 *   2. The user is an accepted ProjectCollaborator on the project.
 */
import { Types } from 'mongoose';
import User from '../model/user.model';
import ProjectCollaborator from '../model/projectCollaborator.model';

export async function canAccessProject(userId: string, projectId: string): Promise<boolean> {
  // 1. Ownership check (fast path)
  const isOwner = await User.exists({
    _id: new Types.ObjectId(userId),
    projects: new Types.ObjectId(projectId),
  });
  if (isOwner) return true;

  // 2. Accepted collaborator check
  const isCollaborator = await ProjectCollaborator.exists({
    projectId: new Types.ObjectId(projectId),
    userId: new Types.ObjectId(userId),
    status: 'accepted',
  });
  return !!isCollaborator;
}
