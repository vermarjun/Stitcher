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

/** The effective role a user has on a project. */
export type ProjectRole = 'owner' | 'editor' | 'viewer' | null;

/**
 * Resolve a user's effective role on a project:
 *   - 'owner'   — the project is in the user's `projects` array
 *   - 'editor'  — accepted collaborator with role 'editor'
 *   - 'viewer'  — accepted collaborator with role 'viewer'
 *   - null      — no access
 *
 * Used to gate write access (owner/editor) vs read-only (viewer) consistently
 * across REST middleware and the Yjs websocket layer.
 */
export async function getProjectRole(userId: string, projectId: string): Promise<ProjectRole> {
  const isOwner = await User.exists({
    _id: new Types.ObjectId(userId),
    projects: new Types.ObjectId(projectId),
  });
  if (isOwner) return 'owner';

  const collab = await ProjectCollaborator.findOne({
    projectId: new Types.ObjectId(projectId),
    userId: new Types.ObjectId(userId),
    status: 'accepted',
  })
    .select('role')
    .lean();

  if (!collab) return null;
  return collab.role === 'editor' ? 'editor' : 'viewer';
}

/**
 * True when the user may MUTATE the project (owner or accepted editor).
 * Viewers and non-members return false.
 */
export async function canEditProject(userId: string, projectId: string): Promise<boolean> {
  const role = await getProjectRole(userId, projectId);
  return role === 'owner' || role === 'editor';
}
