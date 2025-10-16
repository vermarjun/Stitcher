// import { Video } from "lucide-react";
import { AuroraText } from "@/Components/magicui/aurora-text";

function LogoSection() {
  return (
    <div className="flex items-center gap-3">
      {/* Logo */}
      {/* <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-300 to-blue-600 flex items-center justify-center">
        <Video className="h-4 w-4 text-white" />
      </div> */}
      
      {/* App Name */}
      <AuroraText className="text-2xl" padding="" colors={["#19E5A1", "#02684D"]}>
        <span className="font-pacifico text-white tracking-tight mr-1">Stitcher</span>
      </AuroraText>
    </div>
  );
}

export default LogoSection;