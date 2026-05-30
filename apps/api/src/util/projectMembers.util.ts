import { Types } from 'mongoose';
import User from '../model/user.model';
import ProjectCollaborator from '../model/projectCollaborator.model';

export type ProjectMember = { username: string; profilePhoto: string };

/**
 * Build a map of projectId -> members (owner + accepted collaborators, each with
 * username + profilePhoto) for the given projects. Used to render member avatars
 * in project lists. Non-fatal: returns whatever it can resolve.
 */
export async function getMembersByProject(
  projectIds: Types.ObjectId[]
): Promise<Map<string, ProjectMember[]>> {
  const map = new Map<string, ProjectMember[]>();
  if (!projectIds.length) return map;

  const idStrs = projectIds.map((id) => id.toString());
  const push = (pid: string, u?: { username?: string; profilePhoto?: string } | null) => {
    if (!u?.username) return;
    const arr = map.get(pid) ?? [];
    if (!arr.some((m) => m.username === u.username)) {
      arr.push({ username: u.username, profilePhoto: u.profilePhoto ?? '' });
    }
    map.set(pid, arr);
  };

  // Owners — a user "owns" a project if it's in their `projects` array.
  const owners = await User.find(
    { projects: { $in: projectIds } },
    'username profilePhoto projects'
  ).lean();
  for (const owner of owners) {
    for (const pid of (owner.projects ?? []) as Types.ObjectId[]) {
      const pidStr = pid.toString();
      if (idStrs.includes(pidStr)) push(pidStr, owner as any);
    }
  }

  // Accepted collaborators on those projects.
  const collabs = await ProjectCollaborator.find({
    projectId: { $in: projectIds },
    status: 'accepted',
    userId: { $ne: null },
  })
    .populate<{ userId: { username: string; profilePhoto: string } }>('userId', 'username profilePhoto')
    .lean();
  for (const c of collabs) {
    push((c.projectId as any).toString(), c.userId as any);
  }

  return map;
}
