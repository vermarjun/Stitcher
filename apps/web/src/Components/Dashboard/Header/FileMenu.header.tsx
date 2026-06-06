import { Button } from "@/Components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from 'react-router-dom';

// File Menu Section Component
export const FileMenuSection = () => {
  const navigate = useNavigate();

  const handleGoHome = (): void => {
    navigate('/home');
  };

  return (
    <div className="flex items-center relative">
      {/* Cursor-style menu bar */}
      <nav className="flex items-center h-9 bg-neutral-950/80 backdrop-blur-sm border-neutral-500/50">
        {/* Back to Home Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-4 text-sm text-neutral-300 hover:bg-neutral-800/70 hover:text-white focus:bg-neutral-800/70 focus:text-white rounded-none border-0 font-medium transition-all duration-200 flex items-center gap-2 group"
          onClick={handleGoHome}
        >
          <ArrowLeft className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
          <span>Back</span>
        </Button>
      </nav>
    </div>
  );
};
