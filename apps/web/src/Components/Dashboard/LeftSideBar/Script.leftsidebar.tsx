import React, { useState, useRef, useEffect } from "react";
import { Edit3, X, Check, Eye } from "lucide-react";
import api from "@/api";
import type { Project } from "@/State/Types";
import { toast } from "sonner";

interface ScriptSidebarProps {
  projectScript?: string;
  currentProject?: Project;
  onScriptUpdate?: (script: string) => void;
}

const fetchProjectScript = async (currentProject?: Project): Promise<string> => {
  try {
    const response = await api.get(`/script/${currentProject?._id}`)
    return (response.data as any).project_script
  } catch(error){
    toast.error("Error fetching project description.");
    return ""
  }
};

const saveProjectScript = async (script: string, currentProject?: Project | null): Promise<void> => {
  try {
    await api.put(`/script/${currentProject?._id}`, {
      project_script: script
    })
  } catch(error){
    toast.error("Error updating script.");
  }
};

const ScriptSidebar: React.FC<ScriptSidebarProps> = ({
  projectScript = "",
  currentProject,
  onScriptUpdate,
}) => {
  const [script, setScript] = useState(projectScript);
  const [isEditing, setIsEditing] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadProjectScript = async () => {
      try {
        setIsLoading(true);
        const fetchedScript = await fetchProjectScript(currentProject);
        setScript(fetchedScript);
        if (onScriptUpdate) {
          onScriptUpdate(fetchedScript);
        }
      } catch (error) {
        console.error("Failed to fetch project script:", error);
        // Fallback to empty script if fetch fails
        setScript("");
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectScript();
  }, [onScriptUpdate]);

  // Update word count when script changes
  useEffect(() => {
    const words = script
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    setWordCount(words.length);
  }, [script]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProjectScript(script, currentProject);
      if (onScriptUpdate) {
        onScriptUpdate(script);
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save script:", error);
      // Handle save error (could show toast notification here)
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleCancel = () => {
    setScript(projectScript);
    setIsEditing(false);
  };

  const handleClickToEdit = () => {
    if (!isEditing && !isLoading) {
      handleStartEditing();
    }
  };

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="bg-black border-r border-zinc-800 h-screen flex flex-col">
        {/* Header Skeleton */}
        <div className="p-3 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse"></div>
            </div>
            <div className="h-7 w-16 bg-zinc-800 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Editor Area Skeleton */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-zinc-700 rounded-full"></div>
                  <div className="w-2 h-2 bg-zinc-700 rounded-full"></div>
                  <div className="w-2 h-2 bg-zinc-700 rounded-full"></div>
                </div>
                <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse ml-2"></div>
              </div>
              <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse"></div>
            </div>
          </div>

          <div className="flex-1 relative bg-zinc-950 overflow-hidden">
            {/* Paper lines effect */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="w-full h-full opacity-5"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(transparent, transparent 19px, #525252 20px)",
                  backgroundSize: "100% 20px",
                }}
              />
              <div className="absolute left-12 top-0 bottom-0 w-px bg-zinc-700 opacity-20" />
            </div>

            {/* Text area skeleton */}
            <div className="w-full h-full p-4 pl-16 pr-4">
              <div className="space-y-3">
                <div className="h-4 w-full bg-zinc-800 rounded animate-pulse"></div>
                <div className="h-4 w-3/4 bg-zinc-800 rounded animate-pulse"></div>
                <div className="h-4 w-5/6 bg-zinc-800 rounded animate-pulse"></div>
                <div className="h-4 w-2/3 bg-zinc-800 rounded animate-pulse"></div>
                <div className="pt-4 space-y-2">
                  <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse"></div>
                  <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse"></div>
                  <div className="h-3 w-20 bg-zinc-800 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black border-r border-zinc-800 h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
            <span>{wordCount} words</span>
            <span>{script.length} characters</span>
            {!isEditing && (
              <span className="text-zinc-500 text-[10px] flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Read-only
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="h-7 px-2 text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-3 h-3" />
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button
                onClick={handleStartEditing}
                className="h-7 px-2 text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-zinc-800 border-b border-zinc-800 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
              <span className="text-xs text-zinc-400 ml-2">
                Notes & Mind Map
              </span>
            </div>

            {!isEditing && (
              <div className="text-xs text-zinc-500">
                Click anywhere to edit
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative bg-zinc-950 overflow-hidden">
          {/* Paper lines effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="w-full h-full opacity-5"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 19px, #525252 20px)",
                backgroundSize: "100% 20px",
              }}
            />
            <div className="absolute left-12 top-0 bottom-0 w-px bg-zinc-700 opacity-20" />
          </div>

          {/* Click overlay for read-only mode */}
          {!isEditing && (
            <div
              onClick={handleClickToEdit}
              className="absolute inset-0 cursor-pointer z-10 group"
            >
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white px-2 py-1 rounded text-xs flex items-center gap-1 bg-zinc-800">
                <Edit3 className="w-3 h-3" />
                Click to edit
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={
              isEditing
                ? "Plan your actions, create mind maps, or write scripts...\n\n• Use bullet points for ideas\n• Create hierarchies with indentation\n• Map out your video sequences\n• Note down key scenes and transitions"
                : "Click anywhere to start planning your actions and scripts..."
            }
            readOnly={!isEditing}
            className={`w-full h-full resize-none bg-transparent text-white text-sm leading-5 p-4 pl-16 pr-4 border-none outline-none font-mono placeholder-zinc-600 ${
              !isEditing
                ? "pointer-events-none"
                : "cursor-text focus:ring-2 focus:ring-blue-500/20"
            }`}
            style={{
              lineHeight: "20px",
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
              zIndex: isEditing ? 20 : 1,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ScriptSidebar;