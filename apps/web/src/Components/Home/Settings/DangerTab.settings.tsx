import React, { useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/Components/ui/alert-dialog";

interface DangerTabProps {
  loading: boolean;
  handleDeleteAccount: () => void;
}

const CONFIRM_WORD = "DELETE";

const DangerTab: React.FC<DangerTabProps> = ({
  loading,
  handleDeleteAccount,
}) => {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-red-500/15 px-4 py-4 md:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
          <TriangleAlert className="h-[18px] w-[18px]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Danger zone</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Irreversible and destructive actions.
          </p>
        </div>
      </div>

      {/* Delete row */}
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-white">Delete account</p>
          <p className="max-w-md text-xs text-zinc-500">
            Permanently removes your account, projects, and settings. This
            can&apos;t be undone.
          </p>
        </div>

        <AlertDialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setConfirmText("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              disabled={loading}
              className="h-9 w-full md:w-auto shrink-0 gap-1.5 border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-white">
            <AlertDialogHeader>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
                <TriangleAlert className="h-5 w-5 text-red-400" />
              </div>
              <AlertDialogTitle className="text-base text-white">
                Delete your account?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-zinc-400">
                This action is permanent and cannot be undone. All your data,
                projects, and settings will be erased, and any active
                subscription will be cancelled immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-1.5 py-1">
              <label className="text-xs text-zinc-400">
                Type{" "}
                <span className="font-mono font-semibold text-red-300">
                  {CONFIRM_WORD}
                </span>{" "}
                to confirm
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                placeholder={CONFIRM_WORD}
                className="h-9 border-zinc-800 bg-zinc-900 font-mono text-sm text-white focus-visible:border-red-500/50 focus-visible:ring-red-500/20"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel className="border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={!canDelete || loading}
                onClick={(e) => {
                  // keep the dialog logic in our hands; only fire when confirmed
                  if (!canDelete) {
                    e.preventDefault();
                    return;
                  }
                  handleDeleteAccount();
                }}
                className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Deleting...
                  </>
                ) : (
                  "Delete account"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default DangerTab;
