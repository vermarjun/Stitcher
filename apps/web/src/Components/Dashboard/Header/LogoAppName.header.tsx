import { AuroraText } from "@/Components/magicui/aurora-text";

function LogoSection() {
  return (
    <div className="flex items-center gap-3">
      {/* App Name */}
      <AuroraText className="text-2xl" padding="" colors={["#19E5A1", "#02684D"]}>
        <span className="font-pacifico text-white tracking-tight mr-1">Stitcher</span>
      </AuroraText>
    </div>
  );
}

export default LogoSection;