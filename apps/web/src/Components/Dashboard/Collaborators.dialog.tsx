import { useState, useEffect, useCallback } from "react";
import { X, UserPlus, Trash2, Mail, Users, Clock } from "lucide-react";
import api from "@/api";
import { toast } from "sonner";
import type { IUser } from "@/State/Types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Collaborator {
  userId: string;
  username: string;
  email: string;
  role: "editor" | "viewer";
  status: string;
}

interface PendingInvite {
  _id: string;
  invitedEmail: string;
  role: "editor" | "viewer";
}

interface CollaboratorsResponse {
  success: boolean;
  data: {
    collaborators: Collaborator[];
    pending: PendingInvite[];
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  projectOwnerId?: string;
  currentUser?: IUser;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CollaboratorsDialog({
  projectId,
  projectOwnerId,
  currentUser,
  onClose,
}: Props) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);

  // Owner check: compare currentUser._id to projectOwnerId if available
  const isOwner =
    !projectOwnerId || !currentUser?._id
      ? true // fallback — let API 403 if wrong
      : currentUser._id === projectOwnerId;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchCollaborators = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<CollaboratorsResponse>(
        `/project/${projectId}/collaborators`
      );
      if (res.data.success) {
        setCollaborators(res.data.data.collaborators);
        setPending(res.data.data.pending);
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to load collaborators"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  // ── Invite ─────────────────────────────────────────────────────────────────

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      setInviting(true);
      await api.post(`/project/${projectId}/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      await fetchCollaborators();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  // ── Remove ─────────────────────────────────────────────────────────────────

  const handleRemove = async (collabUserId: string, label: string) => {
    try {
      await api.delete(
        `/project/${projectId}/collaborators/${collabUserId}`
      );
      toast.success(`Removed ${label}`);
      await fetchCollaborators();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove collaborator");
    }
  };

  // ── Role badge helper ──────────────────────────────────────────────────────

  const roleBadge = (role: "editor" | "viewer") =>
    role === "editor"
      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
      : "bg-zinc-700/40 text-zinc-400 border border-zinc-600/30";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-400" />
            <h3 className="text-lg font-semibold text-zinc-100">
              Collaborators
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invite form — owner only */}
        {isOwner && (
          <form
            onSubmit={handleInvite}
            className="flex gap-2 items-end bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-3"
          >
            <div className="flex-1 space-y-1">
              <label className="text-xs text-zinc-500 font-medium">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="collaborator@email.com"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 font-medium">Role</label>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "editor" | "viewer")
                }
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {inviting ? "Sending…" : "Invite"}
            </button>
          </form>
        )}

        {/* Lists */}
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {/* Active collaborators */}
            {collaborators.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider px-1">
                  Members
                </p>
                {collaborators.map((c) => (
                  <div
                    key={c.userId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/30 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-white">
                        {(c.username || c.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate font-medium">
                        {c.username || c.email}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{c.email}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(
                        c.role
                      )}`}
                    >
                      {c.role}
                    </span>
                    {isOwner && (
                      <button
                        onClick={() =>
                          handleRemove(c.userId, c.username || c.email)
                        }
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove collaborator"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pending invites */}
            {pending.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider px-1">
                  Pending invites
                </p>
                {pending.map((inv) => (
                  <div
                    key={inv._id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/20 border border-zinc-800/40 border-dashed"
                  >
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-400 truncate">
                        {inv.invitedEmail}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(
                        inv.role
                      )}`}
                    >
                      {inv.role}
                    </span>
                    <div className="flex items-center gap-1 text-zinc-600">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {collaborators.length === 0 && pending.length === 0 && (
              <div className="py-8 text-center space-y-2">
                <Users className="w-8 h-8 text-zinc-700 mx-auto" />
                <p className="text-sm text-zinc-500">No collaborators yet.</p>
                {isOwner && (
                  <p className="text-xs text-zinc-600">
                    Invite someone above to start collaborating.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
