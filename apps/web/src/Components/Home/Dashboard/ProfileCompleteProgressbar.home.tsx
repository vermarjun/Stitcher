import React from "react";
import { CheckCircle2 } from "lucide-react";

interface Props {
  progress: number; // 0 - 100
  missingFields: string[];
  onContinue: () => void;
}

const ProfileProgress: React.FC<Props> = ({ progress, missingFields, onContinue }) => {
  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-[#0D0F11] p-5 shadow-[0_0_10px_rgba(16,185,129,0.06)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Complete Your Profile</h2>
        <span className="text-emerald-400 font-medium">{progress}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-500"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Missing fields */}
      {missingFields.length > 0 && (
        <div className="mt-4 space-y-1">
          {missingFields.map((field, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-sm text-zinc-400"
            >
              <CheckCircle2 size={16} className="text-zinc-600" />
              <span>{field}</span>
            </div>
          ))}
        </div>
      )}

      {/* Button */}
      <button
        onClick={onContinue}
        className="mt-5 w-full py-2.5 rounded-lg bg-emerald-600/20 border border-emerald-600/30
        text-emerald-300 font-medium hover:bg-emerald-600/30
        transition-all shadow-[0_0_6px_rgba(16,185,129,0.25)] active:scale-95"
      >
        Continue Profile
      </button>
    </div>
  );
};

export default ProfileProgress;
