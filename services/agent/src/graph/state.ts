/**
 * LangGraph state definition.
 *
 * Uses Annotation-based typed state so every graph node sees the same
 * well-typed object. Reducers are explicit — appending arrays, replacing scalars.
 */

import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { ModelConfig } from "../models/factory.js";

// ── Sub-types ────────────────────────────────────────────────────────────────

export interface StyleManifest {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  accentColor: string;
  fontFamily: string;
  animationPace: "slow" | "medium" | "fast";
  positioningZones: Record<string, string>;
  elementNaming: Record<string, string>;
}

export interface ScenePlan {
  index: number;
  prompt: string;
  durationSec: number;
  manimFeatures: string[];
  requiredSymbols: string[];
}

export interface ValidationReport {
  passed: boolean;
  checks: Record<string, "ok" | { error: string; line?: number; suggestion?: string }>;
  failFast: string | null;
}

export interface SceneAttempt {
  code: string;
  validation: ValidationReport;
  elapsedMs: number;
}

export type SceneStatus =
  | "pending"
  | "generating"
  | "validating"
  | "refining"
  | "done"
  | "failed";

export interface SceneState {
  plan: ScenePlan;
  attempts: SceneAttempt[];
  status: SceneStatus;
  finalCode?: string;
}

export interface LlmCallLog {
  role: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  timestamp: string;
}

export interface AgentEvent {
  type: string;
  jobId: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface RetrievalContext {
  apiExamples?: Array<{ symbol: string; snippet: string }>;
  similarScripts?: Array<{ prompt: string; code: string }>;
  styleRecommendations?: string[];
  pitfalls?: string[];
}

export interface UserPreferences {
  primaryColor?: string;
  backgroundColor?: string;
  animationPace?: "slow" | "medium" | "fast";
  complexityLevel?: "beginner" | "intermediate" | "advanced";
  preferredDomain?: string;
}

export interface GenerationConstraints {
  minScenes?: number;
  maxScenes?: number;
  maxSceneDurationSec?: number;
  targetTotalDurationSec?: number;
  renderQualityHint?: "low" | "medium" | "high";
}

export interface GenerateLimits {
  maxValidationRetries?: number;
  timeoutSec?: number;
}

export interface ModelConfigMap {
  planner?: ModelConfig;
  coder?: ModelConfig;
  debugger?: ModelConfig;
  validator?: ModelConfig;
}

// ── LangGraph Annotation-based state ────────────────────────────────────────

export const GraphStateAnnotation = Annotation.Root({
  // Core identity
  jobId: Annotation<string>({ reducer: (_prev, next) => next }),
  mode: Annotation<"generate" | "debug">({ reducer: (_prev, next) => next }),

  // Input — generate mode
  prompt: Annotation<string | undefined>({ reducer: (_prev, next) => next }),
  constraints: Annotation<GenerationConstraints | undefined>({ reducer: (_prev, next) => next }),
  limits: Annotation<GenerateLimits | undefined>({ reducer: (_prev, next) => next }),
  retrievalContext: Annotation<RetrievalContext | undefined>({ reducer: (_prev, next) => next }),
  userPreferences: Annotation<UserPreferences | undefined>({ reducer: (_prev, next) => next }),
  styleManifestOverride: Annotation<StyleManifest | undefined>({ reducer: (_prev, next) => next }),

  // Input — debug mode
  brokenCode: Annotation<string | undefined>({ reducer: (_prev, next) => next }),
  brokenError: Annotation<{ stderr: string; summary: string; line?: number; category?: string } | undefined>({
    reducer: (_prev, next) => next,
  }),
  originalPrompt: Annotation<string | undefined>({ reducer: (_prev, next) => next }),
  previousAttempts: Annotation<Array<{ code: string; error: string }> | undefined>({
    reducer: (_prev, next) => next,
  }),

  // Shared config
  modelConfig: Annotation<ModelConfigMap>({ reducer: (_prev, next) => next }),

  // Planner outputs
  styleManifest: Annotation<StyleManifest | undefined>({ reducer: (_prev, next) => next }),
  scenes: Annotation<ScenePlan[] | undefined>({ reducer: (_prev, next) => next }),

  // Per-scene working state — keyed by scene index (stored as JSON string for LangGraph compat)
  sceneStates: Annotation<Record<number, SceneState>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
  }),

  // Debugger output
  fixedCode: Annotation<string | undefined>({ reducer: (_prev, next) => next }),
  fixedValidation: Annotation<ValidationReport | undefined>({ reducer: (_prev, next) => next }),
  changeSummary: Annotation<string | undefined>({ reducer: (_prev, next) => next }),
  diff: Annotation<string | undefined>({ reducer: (_prev, next) => next }),

  // Observability
  events: Annotation<AgentEvent[]>({ reducer: (prev, next) => [...prev, ...next], default: () => [] }),
  llmCallLog: Annotation<LlmCallLog[]>({ reducer: (prev, next) => [...prev, ...next], default: () => [] }),

  // LangChain messages — used inside individual agent nodes
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),

  // Error terminal state
  error: Annotation<{ summary: string; details?: string } | undefined>({ reducer: (_prev, next) => next }),
});

export type GraphState = typeof GraphStateAnnotation.State;
