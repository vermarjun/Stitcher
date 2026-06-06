import { useState, useEffect } from "react";
import {
  Brain,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import api from "@/api";
import { toast } from "sonner";
import { Button } from "@/Components/ui/button";
import { Textarea } from "@/Components/ui/textarea";

interface MemoryPoint {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

const textareaClass =
  "min-h-[78px] resize-none rounded-lg border-zinc-700 bg-zinc-900 text-sm text-white placeholder:text-zinc-500 shadow-none focus-visible:border-zinc-500 focus-visible:ring-zinc-700/40";

const MemoryComponent = () => {
  const [memory, setMemory] = useState<MemoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [llmConfigured, setLlmConfigured] = useState(true);

  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchMemory() {
    try {
      setIsLoading(true);
      const res = await api.get<{ memory: MemoryPoint[]; llmConfigured: boolean }>(
        "/memory"
      );
      if (res.status === 200) {
        setMemory(res.data.memory ?? []);
        setLlmConfigured(res.data.llmConfigured);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load memory");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchMemory();
  }, []);

  async function handleAdd() {
    const text = newText.trim();
    if (!text) return;
    try {
      setAdding(true);
      const res = await api.post<{ memory: MemoryPoint[] }>("/memory", { text });
      setMemory(res.data.memory ?? []);
      setNewText("");
      toast.success("Memory added");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add memory");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(point: MemoryPoint) {
    setEditingId(point.id);
    setEditText(point.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  async function handleSaveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    try {
      setSavingId(id);
      const res = await api.patch<{ memory: MemoryPoint[] }>(`/memory/${id}`, {
        text,
      });
      setMemory(res.data.memory ?? []);
      cancelEdit();
      toast.success("Memory updated");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update memory");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      setDeletingId(id);
      const res = await api.delete<{ memory: MemoryPoint[] }>(`/memory/${id}`);
      setMemory(res.data.memory ?? []);
      toast.success("Memory removed");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove memory");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col bg-black text-zinc-100">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
          <p className="text-xs font-semibold text-white">Saved notes</p>
          <span className="text-xs font-medium text-zinc-400">
            {memory.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-zinc-400">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : memory.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 px-5 text-center">
              <Brain size={18} className="mb-2 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-200">
                No memories saved
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
              <div className="border-b border-zinc-800 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Notes
                </p>
              </div>
              <ul className="divide-y divide-zinc-800">
              {memory.map((point) => {
                const isEditing = editingId === point.id;
                const busy = savingId === point.id || deletingId === point.id;

                return (
                  <li
                    key={point.id}
                    className="group flex gap-2 px-3 py-2.5 transition-colors hover:bg-zinc-900/70"
                  >
                    <span className="mt-[0.65rem] h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                    <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          autoFocus
                          className={textareaClass}
                          aria-label="Edit memory"
                        />
                        <div className="flex justify-end gap-1.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white"
                              onClick={cancelEdit}
                              disabled={savingId === point.id}
                              aria-label="Cancel edit"
                            >
                              <X size={14} />
                            </Button>
                            <Button
                              size="icon"
                              className="size-8 rounded-lg bg-white text-black hover:bg-zinc-200"
                              onClick={() => handleSaveEdit(point.id)}
                              disabled={savingId === point.id || !editText.trim()}
                              aria-label="Save edit"
                            >
                              {savingId === point.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                            </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm leading-relaxed text-zinc-100">
                            {point.text}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(point)}
                            className="size-7 rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white"
                            aria-label="Edit memory"
                            disabled={busy}
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(point.id)}
                            disabled={busy}
                            className="size-7 rounded-md text-zinc-400 hover:bg-red-500/10 hover:text-red-300"
                            aria-label="Remove memory"
                          >
                            {deletingId === point.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                    </div>
                  </li>
                );
              })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 bg-black p-3">
        <div className="space-y-2">
          <Textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add a preference or recurring instruction..."
            rows={3}
            className={textareaClass}
            aria-label="New memory"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-zinc-400">
              {llmConfigured ? "Agent can learn automatically" : "Manual only"}
            </span>
            <Button
              size="sm"
              className="h-8 rounded-lg bg-white text-black hover:bg-zinc-200"
              onClick={handleAdd}
              disabled={adding || !newText.trim()}
            >
              {adding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryComponent;
