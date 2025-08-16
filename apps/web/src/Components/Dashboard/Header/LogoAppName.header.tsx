import { Video } from "lucide-react";

function LogoSection() {
  return (
    <div className="flex items-center gap-3">
      {/* Logo */}
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-300 to-blue-600 flex items-center justify-center">
        <Video className="h-4 w-4 text-white" />
      </div>
      
      {/* App Name */}
      <span className="font-bold text-xl text-white tracking-tight">Stitcher</span>
    </div>
  );
}

export default LogoSection;