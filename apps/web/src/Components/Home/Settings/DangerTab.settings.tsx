import React from "react";
import { Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";

interface DangerTabProps {
  loading: boolean;
  handleDeleteAccount: () => void;
}

const DangerTab: React.FC<DangerTabProps> = ({
  loading,
  handleDeleteAccount,
}) => {
  return (
    <Card className="bg-zinc-900 border-red-800">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-red-400 flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription className="text-red-300">
          Irreversible and destructive actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <h3 className="text-lg font-semibold text-red-400 mb-2">
            Delete Account
          </h3>
          <p className="text-red-300 text-sm leading-relaxed mb-4">
            Once you delete your account, there is no going back. Please be
            certain. All your data will be permanently removed and cannot be
            recovered.
          </p>
          <Button
            onClick={handleDeleteAccount}
            disabled={loading}
            className="bg-red-800 text-white hover:bg-red-700 transition-colors h-10 px-6"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {loading ? "Deleting..." : "Delete Account"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DangerTab;