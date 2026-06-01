import { useState, useEffect, useCallback } from "react";
import { UserPlus, Trash2, Mail, Users, Clock, Loader2 } from "lucide-react";
import api from "@/api";
import { toast } from "sonner";
import { useCollabAwareness } from "@/Components/Dashboard/context";
import { usePresence } from "@/collab/usePresence";
import type { Project, IUser } from "@/State/Types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Collaborator {
  userId: string;
  username: string;
  email: string;
  profilePhoto?: string;
  role: "owner" | "editor" | "viewer";
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
  currentProject?: Project;
  user?: IUser;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const roleBadge = (role: "owner" | "editor" | "viewer") =>
  role === "owner"
    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
    : role === "editor"
      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
      : "bg-zinc-700/40 text-zinc-400 border border-zinc-600/30";

const inputClass =
  "w-full bg-zinc-900 border border-zinc-700 rounded-md px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors";

const Avatar = ({ c, online }: { c: Collaborator; online: boolean }) => {
  const hasPhoto =
    !!c.profilePhoto &&
    c.profilePhoto.trim() !== "" &&
    !c.profilePhoto.includes("gravatar.com/avatar/?d=mp");
  return (
    <div className="relative flex-shrink-0">
      {hasPhoto ? (
        <img
          src={c.profilePhoto}
          alt={c.username || c.email}
          className="w-7 h-7 rounded-full object-cover"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
          <span className="text-xs font-semibold text-white">
            {(c.username || c.email).charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-black" />
      )}
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const CollaboratorsComponent = ({ currentProject, user }: Props) => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);

  const projectId = currentProject?._id;
  const isOwner =
    currentProject?.myRole == null ? true : currentProject.myRole === "owner";

  // Live presence
  const { awareness } = useCollabAwareness();
  const others = usePresence(awareness);

  // Build a set of online userIds from presence others
  // PresenceUser.user.id maps to Collaborator.userId
  const onlineUserIds = new Set(
    others.flatMap((o) => (o.user?.id ? [o.user.id] : []))
  );

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchCollaborators = useCallback(async () => {
    if (!projectId) return;
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

  // ── Invite ───────────────────────────────────────────────────────────────────

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !projectId) return;
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

  // ── Remove ───────────────────────────────────────────────────────────────────

  const handleRemove = async (collabUserId: string, label: string) => {
    if (!projectId) return;
    try {
      await api.delete(`/project/${projectId}/collaborators/${collabUserId}`);
      toast.success(`Removed ${label}`);
      await fetchCollaborators();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to remove collaborator"
      );
    }
  };

  // ── No project open ──────────────────────────────────────────────────────────

  if (!projectId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center gap-3">
        <Users size={32} className="text-zinc-700" />
        <p className="text-sm text-zinc-500">
          Open a project to manage collaborators.
        </p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Online count hint */}
      {onlineUserIds.size > 0 && (
        <div className="px-3 py-1.5 border-b border-zinc-800 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span className="text-xs text-zinc-400">
            {onlineUserIds.size} online now
          </span>
        </div>
      )}

      {/* Invite form — owner only */}
      {isOwner && (
        <form
          onSubmit={handleInvite}
          className="p-3 border-b border-zinc-800 space-y-2"
        >
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="collaborator@email.com"
            required
            className={inputClass}
          />
          <div className="flex gap-2">
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "editor" | "viewer")
              }
              className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              {inviting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UserPlus size={13} />
              )}
              {inviting ? "Sending…" : "Invite"}
            </button>
          </div>
        </form>
      )}

      {/* Lists */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-zinc-500">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <>
            {/* Active members */}
            {collaborators.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider px-1 mb-1.5">
                  Members
                </p>
                {collaborators.map((c) => {
                  const isOnline = onlineUserIds.has(c.userId);
                  return (
                    <div
                      key={c.userId}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors"
                    >
                      <Avatar c={c} online={isOnline} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate font-medium leading-tight">
                          {c.username || c.email}
                          {c.userId === user?._id && (
                            <span className="text-zinc-500 font-normal">
                              {" "}
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {c.email}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${roleBadge(
                          c.role
                        )}`}
                      >
                        {c.role}
                      </span>
                      {isOwner &&
                        c.role !== "owner" &&
                        c.userId !== user?._id && (
                          <button
                            onClick={() =>
                              handleRemove(c.userId, c.username || c.email)
                            }
                            className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                            title="Remove collaborator"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pending invites */}
            {pending.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider px-1 mb-1.5">
                  Pending invites
                </p>
                {pending.map((inv) => (
                  <div
                    key={inv._id}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/40 border-dashed"
                  >
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                      <Mail size={13} className="text-zinc-500" />
                    </div>
                    <p className="flex-1 text-xs text-zinc-400 truncate">
                      {inv.invitedEmail}
                    </p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${roleBadge(
                        inv.role
                      )}`}
                    >
                      {inv.role}
                    </span>
                    <Clock size={13} className="text-zinc-600 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {collaborators.length === 0 && pending.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
                <Users size={28} className="text-zinc-700" />
                <p className="text-sm text-zinc-500">No collaborators yet.</p>
                {isOwner && (
                  <p className="text-xs text-zinc-600">
                    Invite someone above to start collaborating.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CollaboratorsComponent;
