import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, FolderOpen, Check, X, Users, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import api from "@/api";
import { toast } from "sonner";

// Verbose relative time, matching the Recent Projects table above so the two
// read as one continuous list (e.g. "2 days ago").
function timeAgo(date?: string | Date) {
  if (!date) return "";
  const past = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - past.getTime()) / 1000);
  if (seconds < 60) return `${seconds} sec${seconds !== 1 ? "s" : ""} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

export interface ProjectMember {
  username: string;
  profilePhoto?: string;
}

// Overlapping avatar stack of the people in a project. Falls back to a folder
// icon when no members are available.
export const MemberAvatars = ({ members }: { members?: ProjectMember[] }) => {
  if (!members || members.length === 0) {
    return (
      <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
        <FolderOpen className="w-5 h-5 text-zinc-400" />
      </div>
    );
  }
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <div className="flex -space-x-2 flex-shrink-0">
      {shown.map((m, i) => (
        <Avatar key={i} className="h-9 w-9 border-2 border-black">
          <AvatarImage src={m.profilePhoto} alt={m.username} />
          <AvatarFallback className="bg-zinc-800 text-zinc-300 text-xs">
            {m.username?.charAt(0)?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <div className="h-9 w-9 rounded-full border-2 border-black bg-zinc-800 text-zinc-300 text-[10px] font-medium flex items-center justify-center">
          +{extra}
        </div>
      )}
    </div>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingInvite {
  _id: string;
  projectId: string;
  projectName: string;
  invitedByUsername: string;
  role: "editor" | "viewer";
}

interface SharedProject {
  _id: string;
  name: string;
  updatedAt?: string | Date;
  role?: "editor" | "viewer";
  sharedByUsername?: string | null;
  members?: ProjectMember[];
  [key: string]: unknown;
}

interface InvitesResponse {
  success: boolean;
  data: { invites: PendingInvite[] };
}

interface SharedResponse {
  success: boolean;
  data: { projects: SharedProject[] };
}

// ── Invitations section ───────────────────────────────────────────────────────

const InvitationsSection = ({
  onAccepted,
}: {
  onAccepted: () => void;
}) => {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Record<string, boolean>>({});

  const fetchInvites = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<InvitesResponse>("/collab/invites");
      if (res.data.success) {
        setInvites(res.data.data.invites);
      }
    } catch {
      // Silently fail — user may not have any invites
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleAccept = async (inviteId: string, projectName: string) => {
    setActing((prev) => ({ ...prev, [inviteId]: true }));
    try {
      await api.post(`/collab/invites/${inviteId}/accept`);
      toast.success(`Joined "${projectName}"`);
      setInvites((prev) => prev.filter((i) => i._id !== inviteId));
      onAccepted();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to accept invite");
    } finally {
      setActing((prev) => ({ ...prev, [inviteId]: false }));
    }
  };

  const handleDecline = async (inviteId: string, projectName: string) => {
    setActing((prev) => ({ ...prev, [inviteId]: true }));
    try {
      await api.post(`/collab/invites/${inviteId}/decline`);
      toast.success(`Declined invite for "${projectName}"`);
      setInvites((prev) => prev.filter((i) => i._id !== inviteId));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to decline invite");
    } finally {
      setActing((prev) => ({ ...prev, [inviteId]: false }));
    }
  };

  if (loading || invites.length === 0) return null;

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-amber-400" />
        <h2 className="text-base font-semibold text-white">
          Invitations
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-full">
            {invites.length}
          </span>
        </h2>
      </div>

      <div className="space-y-2">
        {invites.map((inv) => (
          <div
            key={inv._id}
            className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {inv.projectName}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                invited by{" "}
                <span className="text-zinc-400">{inv.invitedByUsername}</span>{" "}
                &middot;{" "}
                <span className="capitalize">{inv.role}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleAccept(inv._id, inv.projectName)}
                disabled={acting[inv._id]}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {acting[inv._id] ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Accept
              </button>
              <button
                onClick={() => handleDecline(inv._id, inv.projectName)}
                disabled={acting[inv._id]}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Shared-with-me section ────────────────────────────────────────────────────

const SharedWithMeSection = ({ refreshKey }: { refreshKey: number }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShared = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<SharedResponse>("/project/shared-with-me");
      if (res.data.success) {
        setProjects(res.data.data.projects);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShared();
  }, [fetchShared, refreshKey]);

  if (loading || projects.length === 0) return null;

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-white" />
        <h2 className="text-base font-semibold text-white">
          Shared with me{" "}
          <span className="text-zinc-400 font-normal">({projects.length})</span>
        </h2>
      </div>

      {/* Desktop: header-less table whose columns mirror the Recent Projects
          table above, so the two read as one continuous list. */}
      <div className="hidden md:block bg-black border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full table-fixed">
          <colgroup>
            <col />
            <col className="w-40" />
            <col className="w-32" />
          </colgroup>
          <tbody>
            {projects.map((project) => (
              <tr
                key={project._id}
                onClick={() => navigate(`/dashboard/${project._id}`)}
                className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900/50 transition-colors cursor-pointer"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-3">
                    <MemberAvatars members={project.members} />
                    <span className="text-white text-sm font-medium truncate">
                      {project.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-zinc-400 text-xs">
                  {timeAgo(project.updatedAt)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex justify-center items-center">
                    {project.role && (
                      <span className="text-xs font-medium text-zinc-300 capitalize px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-800/60">
                        {project.role}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards, matching the Recent Projects mobile layout. */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {projects.map((project) => (
          <button
            key={project._id}
            onClick={() => navigate(`/dashboard/${project._id}`)}
            className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center justify-between gap-3 text-left active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3 min-w-0">
              <MemberAvatars members={project.members} />
              <div className="min-w-0">
                <h3 className="text-white text-sm font-medium truncate">
                  {project.name}
                </h3>
                <p className="text-zinc-500 text-xs">
                  {timeAgo(project.updatedAt)}
                </p>
              </div>
            </div>
            {project.role && (
              <span className="text-xs font-medium text-zinc-300 capitalize px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-800/60 flex-shrink-0">
                {project.role}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Exported wrapper ──────────────────────────────────────────────────────────

export default function CollabSections() {
  const [sharedRefreshKey, setSharedRefreshKey] = useState(0);

  // When user accepts an invite, re-fetch shared projects
  const handleAccepted = () => {
    setSharedRefreshKey((k) => k + 1);
  };

  return (
    <>
      <InvitationsSection onAccepted={handleAccepted} />
      <SharedWithMeSection refreshKey={sharedRefreshKey} />
    </>
  );
}
