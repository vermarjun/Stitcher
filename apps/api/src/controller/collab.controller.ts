import { Request, Response } from 'express';
import { Types } from 'mongoose';
import User from '../model/user.model';
import ProjectCollaborator from '../model/projectCollaborator.model';

// ─── POST /api/project/:projectId/invite ──────────────────────────────────────
// Owner-only (guarded by requireProjectOwnership upstream)
export const inviteCollaborator = async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const invitedBy = req.userId!;
  const { email, role } = req.body as { email: string; role: 'editor' | 'viewer' };

  if (!email || !['editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: { message: 'email and role (editor|viewer) are required', code: 'bad_request' } });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Don't allow inviting yourself (the owner)
  const owner = await User.findById(invitedBy).select('email').lean();
  if (owner?.email === normalizedEmail) {
    return res.status(409).json({ error: { message: 'cannot invite the project owner', code: 'conflict' } });
  }

  // Check for existing (non-declined) collaborator
  const existing = await ProjectCollaborator.findOne({
    projectId: new Types.ObjectId(projectId),
    invitedEmail: normalizedEmail,
  }).lean();

  if (existing && existing.status !== 'declined') {
    return res.status(409).json({ error: { message: 'already invited or collaborating', code: 'conflict' } });
  }

  // Resolve userId if a matching user exists
  const invitedUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();

  let invite;
  if (existing && existing.status === 'declined') {
    // Re-invite a previously declined collaborator (upsert)
    invite = await ProjectCollaborator.findByIdAndUpdate(
      existing._id,
      {
        role,
        status: 'pending',
        invitedBy: new Types.ObjectId(invitedBy),
        userId: invitedUser ? invitedUser._id : null,
        respondedAt: undefined,
      },
      { new: true }
    );
  } else {
    invite = await ProjectCollaborator.create({
      projectId: new Types.ObjectId(projectId),
      userId: invitedUser ? invitedUser._id : null,
      invitedEmail: normalizedEmail,
      role,
      status: 'pending',
      invitedBy: new Types.ObjectId(invitedBy),
    });
  }

  return res.status(201).json({ success: true, data: { invite } });
};

// ─── GET /api/project/:projectId/collaborators ────────────────────────────────
// Owner or accepted collaborator (guarded by requireProjectAccess upstream)
export const listCollaborators = async (req: Request, res: Response) => {
  const { projectId } = req.params;

  const all = await ProjectCollaborator.find({
    projectId: new Types.ObjectId(projectId),
  })
    .populate<{ userId: { _id: Types.ObjectId; username: string; email: string } | null }>(
      'userId',
      'username email'
    )
    .lean();

  const collaborators = all
    .filter((c) => c.status === 'accepted')
    .map((c) => ({
      userId: c.userId ? (c.userId as any)._id : null,
      username: c.userId ? (c.userId as any).username : null,
      email: c.userId ? (c.userId as any).email : c.invitedEmail,
      role: c.role,
      status: c.status,
    }));

  const pending = all
    .filter((c) => c.status === 'pending')
    .map((c) => ({
      _id: c._id,
      invitedEmail: c.invitedEmail,
      role: c.role,
    }));

  return res.json({ success: true, data: { collaborators, pending } });
};

// ─── DELETE /api/project/:projectId/collaborators/:collabUserId ───────────────
// Owner-only (guarded by requireProjectOwnership upstream)
export const removeCollaborator = async (req: Request, res: Response) => {
  const { projectId, collabUserId } = req.params;

  await ProjectCollaborator.deleteOne({
    projectId: new Types.ObjectId(projectId),
    userId: new Types.ObjectId(collabUserId),
  });

  return res.json({ success: true });
};

// ─── GET /api/collab/invites ──────────────────────────────────────────────────
export const listMyInvites = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const me = await User.findById(userId).select('email').lean();
  if (!me) {
    return res.status(404).json({ error: { message: 'user not found', code: 'not_found' } });
  }

  const invites = await ProjectCollaborator.find({
    status: 'pending',
    $or: [
      { invitedEmail: me.email },
      { userId: new Types.ObjectId(userId) },
    ],
  })
    .populate<{ projectId: { _id: Types.ObjectId; name: string } }>('projectId', 'name')
    .populate<{ invitedBy: { _id: Types.ObjectId; username: string } }>('invitedBy', 'username')
    .lean();

  const result = invites.map((inv) => ({
    _id: inv._id,
    projectId: inv.projectId ? (inv.projectId as any)._id : null,
    projectName: inv.projectId ? (inv.projectId as any).name : null,
    invitedByUsername: inv.invitedBy ? (inv.invitedBy as any).username : null,
    role: inv.role,
  }));

  return res.json({ success: true, data: { invites: result } });
};

// ─── POST /api/collab/invites/:inviteId/accept ────────────────────────────────
export const acceptInvite = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { inviteId } = req.params;

  if (!Types.ObjectId.isValid(inviteId)) {
    return res.status(400).json({ error: { message: 'invalid invite id', code: 'bad_request' } });
  }

  const me = await User.findById(userId).select('email').lean();
  if (!me) {
    return res.status(404).json({ error: { message: 'user not found', code: 'not_found' } });
  }

  const invite = await ProjectCollaborator.findOne({
    _id: new Types.ObjectId(inviteId),
    status: 'pending',
    $or: [
      { invitedEmail: me.email },
      { userId: new Types.ObjectId(userId) },
    ],
  });

  if (!invite) {
    return res.status(404).json({ error: { message: 'invite not found or not yours', code: 'not_found' } });
  }

  invite.status = 'accepted';
  invite.userId = new Types.ObjectId(userId);
  invite.respondedAt = new Date();
  await invite.save();

  // NOTE: deliberately NOT adding projectId to User.projects — collaborators
  // access projects via ProjectCollaborator, not via ownership.

  return res.json({ success: true, data: { projectId: invite.projectId } });
};

// ─── POST /api/collab/invites/:inviteId/decline ───────────────────────────────
export const declineInvite = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { inviteId } = req.params;

  if (!Types.ObjectId.isValid(inviteId)) {
    return res.status(400).json({ error: { message: 'invalid invite id', code: 'bad_request' } });
  }

  const me = await User.findById(userId).select('email').lean();
  if (!me) {
    return res.status(404).json({ error: { message: 'user not found', code: 'not_found' } });
  }

  const invite = await ProjectCollaborator.findOne({
    _id: new Types.ObjectId(inviteId),
    status: 'pending',
    $or: [
      { invitedEmail: me.email },
      { userId: new Types.ObjectId(userId) },
    ],
  });

  if (!invite) {
    return res.status(404).json({ error: { message: 'invite not found or not yours', code: 'not_found' } });
  }

  invite.status = 'declined';
  invite.respondedAt = new Date();
  await invite.save();

  return res.json({ success: true });
};

// ─── GET /api/project/shared-with-me ─────────────────────────────────────────
export const sharedWithMe = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const collabs = await ProjectCollaborator.find({
    userId: new Types.ObjectId(userId),
    status: 'accepted',
  })
    .populate<{ projectId: { _id: Types.ObjectId; name: string; playback_url: string; updatedAt: Date } }>(
      'projectId',
      'name playback_url updatedAt'
    )
    .lean();

  const projects = collabs
    .filter((c) => c.projectId != null)
    .map((c) => ({
      ...(c.projectId as any),
      role: c.role,
    }));

  return res.json({ success: true, data: { projects } });
};
