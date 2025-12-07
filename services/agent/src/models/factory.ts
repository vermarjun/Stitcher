/**
 * Provider factory.
 *
 * Returns a LangChain BaseChatModel bound to the requested provider.
 * Everything downstream (agents, tools, graph nodes) consumes only the
 * BaseChatModel interface — zero provider-specific code outside this file.
 *
 * Supported providers:
 *   openai      — OpenAI API (gpt-4o, gpt-4o-mini, o1, etc.)
 *   anthropic   — Anthropic API (claude-*, claude-opus-4-7, etc.)
 *   gemini      — Google Gemini (gemini-2.0-flash, gemini-1.5-pro, etc.)
 *   openrouter  — OpenRouter (OpenAI-compat, baseURL override)
 *   groq        — Groq (OpenAI-compat, baseURL override)
 *   ollama      — Local Ollama (OpenAI-compat, caller-supplied baseURL)
 *   opencodego  — OpenCodeGo (OpenAI-compat, base: https://opencode.ai/zen/go/v1)
 *                 Models: kimi-k2.5, minimax-m2.5, glm-5, glm-5.1, mimo-v2-pro, mimo-v2-omni
 *   bedrock     — AWS Bedrock (via @langchain/community)
 */

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config } from "../config.js";

export interface ModelConfig {
  provider: string;
  /** API key for this request. Falls back to env vars if omitted. */
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Required for ollama or any self-hosted OpenAI-compat endpoint. */
  baseURL?: string;
}

const OPENAI_COMPAT_BASE_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  opencodego: "https://opencode.ai/zen/go/v1",
};

export function getModel(cfg: ModelConfig): BaseChatModel {
  const { provider, model, temperature = 0.2, maxTokens } = cfg;

  // ── OpenAI + all OpenAI-compatible providers ──────────────────────────────
  if (
    provider === "openai" ||
    provider === "openrouter" ||
    provider === "groq" ||
    provider === "opencodego" ||
    provider === "ollama"
  ) {
    const apiKey =
      cfg.apiKey ??
      (provider === "openai" ? config.openaiApiKey : undefined) ??
      (provider === "openrouter" ? config.openrouterApiKey : undefined) ??
      (provider === "groq" ? config.groqApiKey : undefined) ??
      (provider === "opencodego" ? config.opencodeGoApiKey : undefined) ??
      "ollama"; // Ollama doesn't need a real key

    const baseURL =
      cfg.baseURL ?? OPENAI_COMPAT_BASE_URLS[provider] ?? undefined;

    if (!apiKey && provider !== "ollama") {
      throw new Error(
        `No API key for provider "${provider}". Supply apiKey in modelConfig or set the env var.`
      );
    }

    return new ChatOpenAI({
      modelName: model,
      temperature,
      maxTokens,
      openAIApiKey: apiKey,
      configuration: baseURL ? { baseURL } : undefined,
    });
  }

  // ── Anthropic ─────────────────────────────────────────────────────────────
  if (provider === "anthropic") {
    const apiKey = cfg.apiKey ?? config.anthropicApiKey;
    if (!apiKey) throw new Error("No API key for provider 'anthropic'.");
    return new ChatAnthropic({
      modelName: model,
      temperature,
      maxTokens,
      anthropicApiKey: apiKey,
    });
  }

  // ── Google Gemini ─────────────────────────────────────────────────────────
  if (provider === "gemini") {
    const apiKey = cfg.apiKey ?? config.geminiApiKey;
    if (!apiKey) throw new Error("No API key for provider 'gemini'.");
    return new ChatGoogleGenerativeAI({
      modelName: model,
      temperature,
      maxOutputTokens: maxTokens,
      apiKey,
    });
  }

  // ── AWS Bedrock ───────────────────────────────────────────────────────────
  if (provider === "bedrock") {
    // Lazy import — only needed if caller uses Bedrock
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BedrockChat } = require("@langchain/community/chat_models/bedrock");
    return new BedrockChat({ model, region: process.env["AWS_REGION"] ?? "us-east-1" });
  }

  throw new Error(
    `Unsupported provider: "${provider}". ` +
      `Supported: openai, anthropic, gemini, openrouter, groq, ollama, opencodego, bedrock`
  );
}

/** All providers this service knows about — returned by GET /capabilities. */
export const SUPPORTED_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "groq",
  "ollama",
  "opencodego",
  "bedrock",
] as const;
