import React from "react";
import { Trash2, AlertTriangle, AlertOctagon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";

interface DangerTabProps {
  loading: boolean;
  handleDeleteAccount: () => void;
}

const DangerTab: React.FC<DangerTabProps> = ({
  loading,
  handleDeleteAccount,
}) => {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-red-900/50 overflow-hidden">
        <CardHeader className="border-b border-red-900/30 bg-red-950/10 pb-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-red-900/20 rounded-lg">
                <AlertOctagon className="h-6 w-6 text-red-500" />
             </div>
             <div>
                <CardTitle className="text-xl font-semibold text-red-400">
                    Danger Zone
                </CardTitle>
                <CardDescription className="text-red-300/70 mt-1">
                    Irreversible and destructive actions
                </CardDescription>
             </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-4 rounded-xl border border-red-900/30 bg-red-950/5">
            <div className="space-y-1">
                <h3 className="font-medium text-red-200 flex items-center gap-2">
                    Delete Account
                </h3>
                <p className="text-sm text-red-300/60 max-w-lg">
                    Once you delete your account, there is no going back. Please be certain. 
                    All your data, projects, and settings will be permanently removed.
                </p>
            </div>
            <Button
              onClick={handleDeleteAccount}
              disabled={loading}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white border-red-500 whitespace-nowrap"
            >
              {loading ? (
                 <>
                   <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                   Deleting...
                 </>
              ) : (
                 <>
                   <Trash2 className="h-4 w-4 mr-2" />
                   Delete Account
                 </>
              )}
            </Button>
          </div>
          
          <Alert className="bg-yellow-950/20 border-yellow-900/50 text-yellow-200">
             <AlertTriangle className="h-4 w-4 text-yellow-500" />
             <AlertTitle className="text-yellow-500 mb-1">Warning</AlertTitle>
             <AlertDescription className="text-yellow-200/70 text-xs">
                Deleting your account will also cancel any active subscriptions immediately. You will not be able to recover any unused credits.
             </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default DangerTab;