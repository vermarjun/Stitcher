import { useState } from 'react';
import { Button } from "@/Components/ui/button";
import { Dialog } from "@/Components/ui/dialog";
import { 
  Home,
  Users,
  Key,
} from "lucide-react";
import {
  DialogTrigger,
} from "@/Components/ui/dialog";
import { ApiKeyManagementModal } from './ApiKeysModal.filemenu';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// File Menu Section Component
export const FileMenuSection = () => {
  const [isAPIModalOpen, setIsAPIModalOpen] = useState<boolean>(false);

  const navigate = useNavigate();

  const handleGoHome = (): void => {
    navigate('/home');
  };

  const handleCollaborators = (): void => {
    toast.info("Feature coming soon! You'll be able to add your friends to this project and work live together.");
  };

  return (
    <div className="flex items-center relative">
      {/* Cursor-style menu bar */}
      <nav className="flex items-center h-9 bg-neutral-950/80 backdrop-blur-sm border-neutral-500/50">
        {/* Home Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-4 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white focus:bg-neutral-800/70 focus:text-white rounded-none border-0 font-medium transition-all duration-200 flex items-center gap-2 group"
          onClick={handleGoHome}
        >
          <Home className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
          {/* Home */}
        </Button>

        {/* Separator */}
        <div className="w-px h-5 bg-neutral-400/50 mx-1" />
        
        {/* Collaborators Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-4 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white focus:bg-neutral-800/70 focus:text-white rounded-none border-0 font-medium transition-all duration-200 flex items-center gap-2 group"
          onClick={handleCollaborators}
        >
          <Users className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
          {/* Collaborators */}
        </Button>

        {/* Separator */}
        <div className="w-px h-5 bg-neutral-400/50 mx-1" />
        
        {/* API Key Management Button */}
        <Dialog open={isAPIModalOpen} onOpenChange={setIsAPIModalOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-4 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white focus:bg-neutral-800/70 focus:text-white rounded-none border-0 font-medium transition-all duration-200 flex items-center gap-2 group"
            >
              <Key className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
              {/* API Keys */}
            </Button>
          </DialogTrigger>
          <ApiKeyManagementModal 
            isOpen={isAPIModalOpen} 
            onClose={() => setIsAPIModalOpen(false)} 
          />
        </Dialog>
      </nav>
    </div>
  );
};