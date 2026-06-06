import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, UserPlus, Trash2, Mail, Users, Clock } from "lucide-react";
import api from "@/api";
import { toast } from "sonner";
import type { IUser } from "@/State/Types";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";

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
  projectId: string;
  currentUserRole?: "owner" | "editor" | "viewer" | null;
  currentUser?: IUser;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CollaboratorsDialog({
  projectId,
  currentUserRole,
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

  // Only the owner may invite/remove collaborators. When the role is unknown
  // (older project payloads) fall back to permissive and let the API 403.
  const isOwner = currentUserRole == null ? true : currentUserRole === "owner";

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

  const roleBadge = (role: "owner" | "editor" | "viewer") =>
    role === "owner"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : role === "editor"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
        : "border-zinc-700 bg-zinc-800/70 text-zinc-300";

  // A real avatar when we have a usable photo URL, else the initial fallback.
  const Avatar = ({ c }: { c: Collaborator }) => {
    const hasPhoto =
      !!c.profilePhoto &&
      c.profilePhoto.trim() !== "" &&
      !c.profilePhoto.includes("gravatar.com/avatar/?d=mp");
    if (hasPhoto) {
      return (
        <img
          src={c.profilePhoto}
          alt={c.username || c.email}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      );
    }
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-gradient-to-br from-zinc-700 to-zinc-900">
        <span className="text-xs font-semibold text-white">
          {(c.username || c.email).charAt(0).toUpperCase()}
        </span>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Portal to <body> so the fixed overlay is viewport-relative rather than
  // trapped inside a transformed/animated section ancestor.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300">
                <Users className="h-4 w-4" />
              </span>
              <h3 className="text-base font-semibold text-white">
                Collaborators
              </h3>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Invite teammates and manage project access.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            aria-label="Close collaborators dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Invite form — owner only */}
        {isOwner && (
          <form
            onSubmit={handleInvite}
            className="mb-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-[1fr_112px_auto]"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Email</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="collaborator@email.com"
                required
                className="h-9 rounded-lg border-zinc-700 bg-black text-white placeholder:text-zinc-500 focus-visible:border-zinc-500 focus-visible:ring-zinc-700/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Role</label>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "editor" | "viewer")
                }
                className="h-9 w-full rounded-lg border border-zinc-700 bg-black px-2 text-sm text-white outline-none transition-colors focus:border-zinc-500"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <Button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="h-9 self-end rounded-lg bg-white text-black hover:bg-zinc-200"
            >
              <UserPlus className="w-4 h-4" />
              {inviting ? "Sending…" : "Invite"}
            </Button>
          </form>
        )}

        {/* Lists */}
        {loading ? (
          <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-zinc-700">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
          </div>
        ) : (
          <div className="max-h-[420px] space-y-5 overflow-y-auto pr-1">
            {/* Active collaborators */}
            {collaborators.length > 0 && (
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                  Members
                </p>
                {collaborators.map((c) => (
                  <div
                    key={c.userId}
                    className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-black px-3 py-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    <Avatar c={c} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate font-medium">
                        {c.username || c.email}
                        {c.userId === currentUser?._id && (
                          <span className="text-zinc-400 font-normal"> (you)</span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">{c.email}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadge(
                        c.role
                      )}`}
                    >
                      {c.role}
                    </span>
                    {/* Owner-only, and never on the owner's own row or your own
                        row — you cannot remove the owner or yourself. */}
                    {isOwner &&
                      c.role !== "owner" &&
                      c.userId !== currentUser?._id && (
                        <button
                          onClick={() =>
                            handleRemove(c.userId, c.username || c.email)
                          }
                          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
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
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                  Pending invites
                </p>
                {pending.map((inv) => (
                  <div
                    key={inv._id}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-black/70 px-3 py-2.5"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900">
                      <Mail className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">
                        {inv.invitedEmail}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadge(
                        inv.role
                      )}`}
                    >
                      {inv.role}
                    </span>
                    <div className="flex items-center gap-1 text-zinc-400">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {collaborators.length === 0 && pending.length === 0 && (
              <div className="space-y-2 rounded-lg border border-dashed border-zinc-700 py-10 text-center">
                <Users className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="text-sm text-zinc-300">No collaborators yet.</p>
                {isOwner && (
                  <p className="text-xs text-zinc-400">
                    Invite someone above to start collaborating.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
