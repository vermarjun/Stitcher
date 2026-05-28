import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, FolderOpen, Check, X, Users, Loader2 } from "lucide-react";
import api from "@/api";
import { toast } from "sonner";

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
  status?: string;
  updatedAt?: string | Date;
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
        <Users className="w-4 h-4 text-blue-400" />
        <h2 className="text-base font-semibold text-white">Shared with me</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {projects.map((project) => (
          <button
            key={project._id}
            onClick={() => navigate(`/dashboard/${project._id}`)}
            className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 hover:bg-zinc-800/60 transition-all text-left active:scale-[0.98]"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {project.name}
              </p>
              {project.status && (
                <span
                  className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium border ${
                    project.status === "completed"
                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                      : project.status === "processing"
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      : project.status === "error"
                      ? "bg-red-500/10 text-red-500 border-red-500/20"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}
                >
                  {project.status}
                </span>
              )}
            </div>
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
