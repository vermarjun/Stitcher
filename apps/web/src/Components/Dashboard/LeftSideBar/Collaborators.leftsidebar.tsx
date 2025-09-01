import { Users } from 'lucide-react';

const CollaboratorsComponent = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-neutral-800 flex-shrink-0">
        {/* <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Collaborators</h2> */}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        <Users size={48} className="text-neutral-600 mb-4" />
        <h3 className="text-lg text-neutral-300 mb-2">Coming Soon</h3>
        <p className="text-sm text-neutral-500 max-w-xs">
          Collaborate with your team in real-time, just like Canva. This feature is currently in development.
        </p>
        <div className="mt-6 px-4 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-sm">
          Feature in Development
        </div>
      </div>
    </div>
  );
};

export default CollaboratorsComponent;