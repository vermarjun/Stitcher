import React, { useState } from "react";
import {
  X,
} from "lucide-react";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";

interface IAsset {
  _id: string;
  name: string;
  type: 'video' | 'audio';
  url: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
  metadata: Record<string, any>;
  projectId: string;
  isOnTimeline: boolean;
  originalTemplateId?: string;
  scene_name: string;
  scene_description: string;
}

interface ITemplate {
  _id: string;
  title: string;
  post_description?: string;
  type: "video" | "audio";
  thumbnail: string;
  url: string;
  duration?: number;
  scene_name?: string;
  scene_description?: string;
  code?: string;
  bytes: number;
  metadata: Record<string, any>;
  likesCount?: number;
  isLikedByUser?: boolean;
}

interface IBackpackItem {
  _id: string;
  itemType: 'Asset' | 'Template';
  itemId: IAsset | ITemplate;
  favourite: boolean;
  source: 'project' | 'community_post' | 'template_library';
  sourceId?: string;
  tags: string[];
  notes?: string;
  addedAt: string;
}

// Helper function to get the display name from either Asset or Template
const getItemName = (item: IAsset | ITemplate): string => {
  return 'name' in item ? item.name : item.title;
};

// Create Post Modal Component
interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: IBackpackItem | null;
  onCreatePost: (postData: { title: string; description: string; tags: string[] }) => void;
}

const CreatePostModal = ({ isOpen, onClose, selectedItem, onCreatePost }: CreatePostModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setLoading(true);
    try {
      await onCreatePost({
        title,
        description,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      });
      onClose();
      resetForm();
    } catch (error) {
      console.error("Failed to create post:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTags("");
  };

  if (!isOpen || !selectedItem) return null;

  const itemData = selectedItem.itemId;
  const itemName = getItemName(itemData);

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Create Community Post</h2>
            <Button
              onClick={onClose}
              className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-full"
              size="icon"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex gap-6">
            {/* Preview */}
            <div className="flex-1">
              <div className="aspect-video bg-zinc-800 rounded-lg overflow-hidden mb-4">
                <img
                  src={itemData.thumbnail}
                  alt={itemName}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm text-zinc-400">{itemName}</p>
              <p className="text-xs text-zinc-500 capitalize">
                {selectedItem.itemType.toLowerCase()} • {selectedItem.source.replace('_', ' ')}
              </p>
            </div>

            {/* Form */}
            <div className="flex-1">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-white mb-2 block">
                    Title *
                  </label>
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter post title..."
                    className="bg-zinc-800 border-zinc-700 text-white"
                    required
                    maxLength={200}
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {title.length}/200 characters
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-white mb-2 block">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your post..."
                    className="w-full h-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-500 resize-none"
                    maxLength={5000}
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {description.length}/5000 characters
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-white mb-2 block">
                    Tags
                  </label>
                  <Input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="tag1, tag2, tag3..."
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Separate tags with commas
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={onClose}
                    variant="outline"
                    className="flex-1 bg-transparent border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !title.trim()}
                    className="flex-1 bg-white text-black hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create Post"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal;