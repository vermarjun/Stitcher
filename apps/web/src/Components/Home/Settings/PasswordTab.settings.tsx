import React from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
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
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Secure your account with a new password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          {(["current", "new", "confirm"] as const).map((field) => (
            <div key={field} className="space-y-2">
              <Label className="text-sm font-medium text-white">
                {field === "current"
                  ? "Current Password"
                  : field === "new"
                  ? "New Password"
                  : "Confirm New Password"}
              </Label>
              <div className="relative">
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
                  className="bg-zinc-800 border-zinc-700 text-white focus:border-white h-10 pr-10"
                  required
                  minLength={field !== "current" ? 6 : undefined}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-zinc-700 text-zinc-400 hover:text-white"
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
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-white text-black hover:bg-zinc-200 transition-colors h-10 px-6"
            >
              <Lock className="h-4 w-4 mr-2" />
              {loading ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PasswordTab;