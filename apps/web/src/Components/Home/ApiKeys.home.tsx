import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Save,
  Trash2,
  Key,
  Activity,
  Info,
  Zap,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Alert, AlertDescription } from "@/Components/ui/alert";
import { toast } from "sonner";
import api from "@/api";

interface Agent {
  id: string;
  name: string;
  description: string;
  mandatory: boolean;
  icon: React.ReactNode;
}

interface ApiKeyData {
  keyValue: string;
  baseUrl: string;
  modelName: string;
}

const agents: Agent[] = [
  {
    id: "general",
    name: "General Purpose Agent",
    description:
      "Handles general queries and serves as fallback for other agents when their specific API keys are not provided or fail.",
    mandatory: true,
    icon: <Key className="w-3 h-3 text-neutral-50" />,
  },
  {
    id: "coder",
    name: "Coder",
    description:
      "Provide an API key of model that is proficient in generating, optimizing python code.",
    mandatory: false,
    icon: <Activity className="w-3 h-3 text-neutral-50" />,
  },
  {
    id: "reviewer",
    name: "Code Reviewer",
    description:
      "Analyzes code for manim version match, bugs and optimizations.",
    mandatory: false,
    icon: <Eye className="w-3 h-3 text-neutral-50" />,
  },
  {
    id: "debugger",
    name: "Debugger",
    description:
      "Identifies and helps resolve bugs, errors, and issues in manim code.",
    mandatory: false,
    icon: <Zap className="w-3 h-3 text-neutral-50" />,
  },
  {
    id: "planner",
    name: "Planner",
    description:
      "Creates a roadmap, breaks down complex tasks, and plans the execution details of prompt.",
    mandatory: false,
    icon: <Info className="w-3 h-3 text-neutral-50" />,
  },
];

const AgentCardSkeleton = () => (
  <Card className="bg-zinc-900 border-zinc-800 text-white">
    <CardHeader className="pb-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-zinc-800 rounded w-7 h-7 animate-pulse" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
          <div className="h-2.5 w-full bg-zinc-800 rounded animate-pulse" />
          <div className="h-2.5 w-4/5 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-2">
      <div className="h-7 w-full bg-zinc-800 rounded animate-pulse" />
      <div className="h-7 w-full bg-zinc-800 rounded animate-pulse" />
      <div className="h-7 w-full bg-zinc-800 rounded animate-pulse" />
    </CardContent>
  </Card>
);

export default function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<Record<string, ApiKeyData>>({
    general: { keyValue: "", baseUrl: "", modelName: "" },
    coder: { keyValue: "", baseUrl: "", modelName: "" },
    reviewer: { keyValue: "", baseUrl: "", modelName: "" },
    debugger: { keyValue: "", baseUrl: "", modelName: "" },
    planner: { keyValue: "", baseUrl: "", modelName: "" },
    optimizer: { keyValue: "", baseUrl: "", modelName: "" },
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    general: false,
    coder: false,
    reviewer: false,
    debugger: false,
    planner: false,
    optimizer: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await api.get("/apikeys");

      if (response.data && response.data.apiKeys) {
        setApiKeys((prev) => {
          const updated = { ...prev };
          Object.keys(response.data.apiKeys).forEach((agentId) => {
            updated[agentId] = {
              keyValue: response.data.apiKeys[agentId].keyValue || "",
              baseUrl: response.data.apiKeys[agentId].baseUrl || "",
              modelName: response.data.apiKeys[agentId].modelName || "",
            };
          });
          return updated;
        });
      }
    } catch (error: any) {
      console.error("Error fetching API keys:", error);
      toast.error(error.response?.data?.message || "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (
    agentId: string,
    field: keyof ApiKeyData,
    value: string
  ) => {
    setApiKeys((prev) => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [field]: value,
      },
    }));
  };

  const toggleKeyVisibility = (agentId: string) => {
    setShowKeys((prev) => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

  const clearKey = async (agentId: string) => {
    try {
      setDeletingKey(agentId);

      await api.delete(`/apikeys/${agentId}`);

      setApiKeys((prev) => ({
        ...prev,
        [agentId]: { keyValue: "", baseUrl: "", modelName: "" },
      }));

      toast.success(
        `API key cleared for ${agents.find((a) => a.id === agentId)?.name}`
      );
    } catch (error: any) {
      console.error("Error clearing API key:", error);
      toast.error(error.response?.data?.message || "Failed to clear API key");
    } finally {
      setDeletingKey(null);
    }
  };

  const saveKeys = async () => {
    try {
      setSaving(true);

      await api.post("/apikeys", {
        apiKeys: apiKeys,
      });

      toast.success("API keys saved successfully!");
    } catch (error: any) {
      console.error("Error saving API keys:", error);
      toast.error(error.response?.data?.message || "Failed to save API keys");
    } finally {
      setSaving(false);
    }
  };

  const hasGeneralKey =
    apiKeys.general.keyValue.trim() !== "" &&
    apiKeys.general.baseUrl.trim() !== "" &&
    apiKeys.general.modelName.trim() !== "";
  const canSave = hasGeneralKey && !saving;

  const hasCompleteConfig = (agentId: string) => {
    const config = apiKeys[agentId];
    return (
      config.keyValue.trim() !== "" &&
      config.baseUrl.trim() !== "" &&
      config.modelName.trim() !== ""
    );
  };

  // Separate general agent from others
  const generalAgent = agents.find((agent) => agent.id === "general");
  const otherAgents = agents.filter((agent) => agent.id !== "general");

  const completedAgents = agents.filter(agent => hasCompleteConfig(agent.id)).length;
  const totalAgents = agents.length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between h-16 border-b border-zinc-800 px-4">
          <h1 className="text-xl font-semibold text-white">
            API Key Configuration
          </h1>
        <Button
          onClick={saveKeys}
          disabled={!canSave || loading}
          className={`
            transition-all duration-200 h-7 px-2 text-xs cursor-pointer
            ${canSave && !loading
              ? "bg-white hover:bg-zinc-200 text-black"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }
          `}
        >
          {saving ? (
            <>
              <div className="w-2.5 h-2.5 mr-1.5 border-2 border-zinc-800 border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-3 h-3 mr-1.5" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Information Alerts */}
      <div className="space-y-2 my-4">
        <Alert className="bg-black border-0 flex items-center gap-2">
          <div>
            <AlertTriangle className="w-full h-full bg-neutral-700 p-3 rounded-full text-white border-neutral-50" />
          </div>
          <AlertDescription className="text-zinc-300 text-xs">
            <span className="font-medium text-neutral-100 text-lg">Supported Providers: </span>
            OpenAI API keys or providers with compatible interfaces (OpenRouter, Groq). 
            Models must support 50K+ tokens, tool calling, and structured outputs.
          </AlertDescription>
        </Alert>
      </div>

      {/* Progress Indicator */}
      <div className="mb-4 px-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-lg font-medium text-zinc-300">
            Configuration Progress
          </span>
          <span className="text-xs text-zinc-400">
            {completedAgents}/{totalAgents} agents configured
          </span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5">
          <div 
            className="bg-white h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(completedAgents / totalAgents) * 100}%` }}
          />
        </div>
      </div>

      {/* General Purpose Agent */}
      {generalAgent && (
        <div className="mb-4 px-4">
          {loading ? (
            <AgentCardSkeleton />
          ) : (
            <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-800 rounded border border-zinc-700">
                      {generalAgent.icon}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium text-white flex items-center gap-1.5">
                        {generalAgent.name}
                        {hasCompleteConfig(generalAgent.id) && (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-zinc-400 text-xs mt-0.5">
                        {generalAgent.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleKeyVisibility(generalAgent.id)}
                      className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 h-6 w-6 p-0"
                    >
                      {showKeys[generalAgent.id] ? (
                        <EyeOff className="w-2.5 h-2.5 text-neutral-50" />
                      ) : (
                        <Eye className="w-2.5 h-2.5 text-neutral-50" />
                      )}
                    </Button>
                    {hasCompleteConfig(generalAgent.id) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => clearKey(generalAgent.id)}
                        disabled={deletingKey === generalAgent.id}
                        className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-red-400 hover:text-red-300 h-6 w-6 p-0"
                      >
                        {deletingKey === generalAgent.id ? (
                          <div className="w-2.5 h-2.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-2.5 h-2.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">
                      API Key {generalAgent.mandatory && <span className="text-red-400">*</span>}
                    </label>
                    <Input
                      type={showKeys[generalAgent.id] ? "text" : "password"}
                      value={apiKeys[generalAgent.id].keyValue}
                      onChange={(e) =>
                        handleFieldChange(
                          generalAgent.id,
                          "keyValue",
                          e.target.value
                        )
                      }
                      placeholder="sk-..."
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">
                      Base URL {generalAgent.mandatory && <span className="text-red-400">*</span>}
                    </label>
                    <Input
                      type="text"
                      value={apiKeys[generalAgent.id].baseUrl}
                      onChange={(e) =>
                        handleFieldChange(
                          generalAgent.id,
                          "baseUrl",
                          e.target.value
                        )
                      }
                      placeholder="https://api.openai.com/v1"
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">
                      Model Name {generalAgent.mandatory && <span className="text-red-400">*</span>}
                    </label>
                    <Input
                      type="text"
                      value={apiKeys[generalAgent.id].modelName}
                      onChange={(e) =>
                        handleFieldChange(
                          generalAgent.id,
                          "modelName",
                          e.target.value
                        )
                      }
                      placeholder="gpt-4-turbo"
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-7 text-xs"
                    />
                  </div>
                </div>
                
                {!hasCompleteConfig(generalAgent.id) && generalAgent.mandatory && (
                  <Alert className="bg-red-900/20 border-red-800/50">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                    <AlertDescription className="text-red-300 text-xs">
                      Required! General Purpose Agent is mandatory and serves as fallback for all other agents.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Optional Agents Grid */}
      <div className="mb-4 px-4">
        <h2 className="text-lg font-medium text-white mb-2">Optional Agents</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {loading
            ? otherAgents.map((agent) => <AgentCardSkeleton key={agent.id} />)
            : otherAgents.map((agent) => (
                <Card
                  key={agent.id}
                  className="bg-neutral-900 border-zinc-800 hover:border-zinc-700 transition-all duration-200"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-zinc-800 rounded border border-zinc-700">
                          {agent.icon}
                        </div>
                        <div>
                          <CardTitle className="text-xs font-medium text-white flex items-center gap-1.5">
                            {agent.name}
                            {hasCompleteConfig(agent.id) && (
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            )}
                          </CardTitle>
                          <CardDescription className="text-zinc-400 text-xs mt-0.5">
                            {agent.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400">
                        API Key
                      </label>
                      <div className="flex gap-1">
                        <Input
                          type={showKeys[agent.id] ? "text" : "password"}
                          value={apiKeys[agent.id].keyValue}
                          onChange={(e) =>
                            handleFieldChange(
                              agent.id,
                              "keyValue",
                              e.target.value
                            )
                          }
                          placeholder="Leave empty to use General Agent"
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-6 text-xs flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleKeyVisibility(agent.id)}
                          className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 h-6 w-6 p-0"
                        >
                          {showKeys[agent.id] ? (
                            <EyeOff className="w-2.5 h-2.5 text-neutral-50" />
                          ) : (
                            <Eye className="w-2.5 h-2.5 text-neutral-50" />
                          )}
                        </Button>
                        {hasCompleteConfig(agent.id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => clearKey(agent.id)}
                            disabled={deletingKey === agent.id}
                            className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-red-400 hover:text-red-300 h-6 w-6 p-0"
                          >
                            {deletingKey === agent.id ? (
                              <div className="w-2.5 h-2.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-2.5 h-2.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400">
                          Base URL
                        </label>
                        <Input
                          type="text"
                          value={apiKeys[agent.id].baseUrl}
                          onChange={(e) =>
                            handleFieldChange(agent.id, "baseUrl", e.target.value)
                          }
                          placeholder="Same as General"
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-6 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400">
                          Model Name
                        </label>
                        <Input
                          type="text"
                          value={apiKeys[agent.id].modelName}
                          onChange={(e) =>
                            handleFieldChange(
                              agent.id,
                              "modelName",
                              e.target.value
                            )
                          }
                          placeholder="Same as General"
                          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-6 text-xs"
                        />
                      </div>
                    </div>
                  </CardContent>
                  {!hasCompleteConfig(agent.id) && !agent.mandatory && (
                    <CardFooter className="pt-0">
                      <Alert className="w-full bg-yellow-900/20 border-yellow-800/50 py-1.5">
                        <AlertDescription className="text-yellow-300 text-xs">
                          No configuration set - will use General Purpose Agent
                        </AlertDescription>
                      </Alert>
                    </CardFooter>
                  )}
                </Card>
              ))}
        </div>
      </div>
    </div>
  );
}