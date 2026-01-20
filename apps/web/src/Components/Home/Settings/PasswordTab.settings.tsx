import React from "react";
import { Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
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

const PasswordTab: React.FC<PasswordTabProps> = ({
  passwordData,
  setPasswordData,
  loading,
  showPasswords,
  togglePasswordVisibility,
  handlePasswordChange,
}) => {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-3">
            {/* <div className="p-2 bg-blue-500/10 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-blue-400" />
            </div> */}
            <div>
              <CardTitle className="text-xl font-semibold text-white">
                Password & Security
              </CardTitle>
              <CardDescription className="text-zinc-400 mt-1">
                Manage your password and security preferences
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handlePasswordChange} className="space-y-6 max-w-xl">
            {(["current", "new", "confirm"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Label className="text-sm font-medium text-zinc-300">
                  {field === "current"
                    ? "Current Password"
                    : field === "new"
                    ? "New Password"
                    : "Confirm New Password"}
                </Label>
                <div className="relative group">
                  <Input
                    type={showPasswords[field] ? "text" : "password"}
                    value={
                      passwordData[
                        field === "current"
                          ? "currentPassword"
                          : field === "new"
                          ? "newPassword"
                          : "confirmPassword"
                      ]
                    }
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        [field === "current"
                          ? "currentPassword"
                          : field === "new"
                          ? "newPassword"
                          : "confirmPassword"]: e.target.value,
                      })
                    }
                    className="bg-zinc-950 border-zinc-800 text-white focus:border-blue-500/50 focus:ring-blue-500/20 h-11 pr-10 transition-all font-mono text-sm"
                    required
                    minLength={field !== "current" ? 6 : undefined}
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                    onClick={() => togglePasswordVisibility(field)}
                  >
                    {showPasswords[field] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}

            <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
               <div className="text-xs text-zinc-500 order-2 md:order-1">
                  Password must be at least 6 characters long
               </div>
               <Button
                type="submit"
                disabled={loading}
                className="bg-white text-black hover:bg-zinc-200 transition-colors h-10 px-8 font-medium w-full md:w-auto order-1 md:order-2"
              >
                {loading ? (
                    <div className="flex items-center gap-2 justify-center">
                        <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Updating...
                    </div>
                ) : (
                    <div className="flex items-center gap-2 justify-center">
                        <KeyRound className="h-4 w-4" />
                        Update Password
                    </div>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Optional: Add 2FA placeholder or login sessions later */}
    </div>
  );
};

export default PasswordTab;