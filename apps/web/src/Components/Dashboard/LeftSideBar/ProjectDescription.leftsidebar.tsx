// src/Components/Dashboard/Sidebar/ProjectDescription.tsx
import { useState } from 'react';
import { FileText } from 'lucide-react';

const ProjectDescriptionComponent = () => {
  const [hasDescription, setHasDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    setHasDescription(description.trim().length > 0);
    setIsEditing(false);
    // TODO: Save to backend
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-neutral-800 flex-shrink-0">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Project Description</h2>
      </div>

      <div className="flex-1 p-3 min-h-0">
        {!hasDescription && !isEditing ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText size={48} className="text-neutral-600 mb-4" />
            <h3 className="text-lg text-neutral-300 mb-2">No Description Yet</h3>
            <p className="text-sm text-neutral-500 mb-6 max-w-xs">
              Start chatting with the AI or add a description to help track your project progress.
            </p>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Description
            </button>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {isEditing ? (
              <>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your project..."
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-sm text-white placeholder-neutral-400 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                />
                <div className="flex gap-2 mt-3 flex-shrink-0">
                  <button
                    onClick={handleSave}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-2 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-sm text-neutral-200 overflow-y-auto">
                  {description}
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-3 px-3 py-2 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600 transition-colors self-start flex-shrink-0"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDescriptionComponent;