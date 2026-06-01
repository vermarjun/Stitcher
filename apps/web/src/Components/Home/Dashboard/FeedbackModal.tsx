// TODO(backend): POST /feedback endpoint to be implemented; feedback will surface
// in an admin page later. For now this component posts optimistically and handles
// the 404/500 gracefully so the UI is production-ready the moment the route lands.

import { useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquarePlus, X, Loader2 } from "lucide-react";
import api from "@/api";
import { toast } from "sonner";

type FeedbackType = "Bug" | "Idea" | "Other";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>("Idea");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setType("Idea");
    setMessage("");
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.post("/feedback", { type, message: message.trim() });
      toast.success("Thanks for the feedback!");
      reset();
      onClose();
    } catch {
      toast.error("Couldn't send feedback right now — please try again later.");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // Portal to <body> so the fixed overlay is positioned relative to the
  // viewport, not a transformed/animated ancestor (which would trap it inside
  // the section it's rendered in).
  return createPortal(
    /* Fixed overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Dialog panel */}
      <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 ring-1 ring-white/10">
              <MessageSquarePlus size={16} />
            </div>
            <h2 className="text-sm font-semibold text-white">Give Feedback</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              Type{" "}
              <span className="text-zinc-600 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              {(["Bug", "Idea", "Other"] as FeedbackType[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setType(opt)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    type === opt
                      ? "border-zinc-600 bg-zinc-800 text-white"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Message textarea */}
          <div className="space-y-1.5">
            <label
              htmlFor="feedback-message"
              className="text-xs font-medium text-zinc-400"
            >
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the bug, share an idea, or just say hi…"
              rows={4}
              required
              disabled={submitting}
              className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-md border border-zinc-800 bg-transparent px-4 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-700 hover:text-white transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!message.trim() || submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Sending…
                </>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
