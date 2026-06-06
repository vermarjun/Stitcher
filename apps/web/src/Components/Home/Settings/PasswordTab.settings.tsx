import React from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import type { PasswordData, ShowPasswords } from "./types.settings";

interface PasswordTabProps {
  passwordData: PasswordData;
  setPasswordData: (data: PasswordData) => void;
  loading: boolean;
  showPasswords: ShowPasswords;
  togglePasswordVisibility: (field: "current" | "new" | "confirm") => void;
  handlePasswordChange: (e: React.FormEvent) => void;
}

const FIELDS = [
  { key: "current" as const, prop: "currentPassword" as const, label: "Current password" },
  { key: "new" as const, prop: "newPassword" as const, label: "New password" },
  { key: "confirm" as const, prop: "confirmPassword" as const, label: "Confirm new password" },
];

const PasswordTab: React.FC<PasswordTabProps> = ({
  passwordData,
  setPasswordData,
  loading,
  showPasswords,
  togglePasswordVisibility,
  handlePasswordChange,
}) => {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4 md:px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 ring-1 ring-white/10">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Password &amp; security
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Update the password used to sign in.
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handlePasswordChange}
          className="space-y-4 px-4 py-5 md:px-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, prop, label }) => (
              <div
                key={key}
                className={`space-y-1.5 ${key === "current" ? "sm:col-span-2" : ""}`}
              >
                <Label className="text-xs text-zinc-400">{label}</Label>
                <div className="relative">
                  <Input
                    type={showPasswords[key] ? "text" : "password"}
                    value={passwordData[prop]}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        [prop]: e.target.value,
                      })
                    }
                    className="h-9 border-zinc-800 bg-zinc-950 pr-9 font-mono text-sm text-white focus-visible:border-[#19E5A1]/50 focus-visible:ring-[#19E5A1]/20"
                    required
                    minLength={key !== "current" ? 6 : undefined}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    onClick={() => togglePasswordVisibility(key)}
                    aria-label={showPasswords[key] ? "Hide password" : "Show password"}
                  >
                    {showPasswords[key] ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-stretch justify-between gap-3 pt-1 sm:flex-row sm:items-center sm:gap-0">
            <p className="order-2 text-xs text-zinc-500 sm:order-1">
              Must be at least 6 characters long.
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="order-1 h-9 w-full sm:w-auto sm:min-w-[150px] bg-white text-black hover:bg-zinc-200 sm:order-2"
            >
              {loading ? (
                <>
                  <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Updating...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-3.5 w-3.5" />
                  Update password
                </>
              )}
            </Button>
          </div>
        </form>
    </div>
  );
};

export default PasswordTab;
