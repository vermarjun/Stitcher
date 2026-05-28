import { useState, useEffect } from "react";
import { Brain, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import api from "@/api";
import { toast } from "sonner";
import { Button } from "@/Components/ui/button";

interface MemoryPoint {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

const textareaClass =
  "w-full bg-zinc-900 border border-zinc-700 rounded-md p-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none";

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
    <div className="h-full flex flex-col">
      {/* Intro / explainer */}
      <div className="px-3 py-2.5 border-b border-zinc-800">
        <p className="text-xs text-zinc-400 leading-relaxed">
          Things your agent remembers about you across projects. It learns these
          from your prompts over time — you can also add, edit, or remove them
          here.
        </p>
        {!llmConfigured && (
          <p className="text-[11px] text-amber-500 mt-1.5">
            Auto-learning is off (LLM not configured). Manual edits still work.
          </p>
        )}
      </div>

      {/* Add new memory */}
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="e.g. I prefer a white background and slow animations"
          rows={2}
          className={textareaClass}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
          }}
        />
        <Button
          size="sm"
          className="w-full"
          onClick={handleAdd}
          disabled={adding || !newText.trim()}
        >
          {adding ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          Add memory
        </Button>
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-zinc-500">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : memory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <Brain size={28} className="text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-400">No memories yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              As you generate and edit videos, your agent will remember your
              preferences here.
            </p>
          </div>
        ) : (
          memory.map((point) => {
            const isEditing = editingId === point.id;
            return (
              <div
                key={point.id}
                className="group bg-zinc-900/60 border border-zinc-800 rounded-md p-2.5 hover:border-zinc-700 transition-colors"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={2}
                      autoFocus
                      className={textareaClass}
                    />
                    <div className="flex gap-1.5 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-zinc-400"
                        onClick={cancelEdit}
                        disabled={savingId === point.id}
                      >
                        <X size={14} />
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleSaveEdit(point.id)}
                        disabled={savingId === point.id || !editText.trim()}
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
                    <p className="flex-1 text-sm text-zinc-200 leading-snug break-words">
                      {point.text}
                    </p>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => startEdit(point)}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(point.id)}
                        disabled={deletingId === point.id}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        {deletingId === point.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MemoryComponent;
