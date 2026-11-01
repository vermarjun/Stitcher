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

export interface ModelConfigParams {
  temperature?: number;
  maxTokens?: number;
  enable_thinking?: boolean;
  [key: string]: unknown;
}

export interface ModelConfig {
  provider: string;
  /** API key for this request. Falls back to env vars if omitted. */
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Optional override for an OpenAI-compatible endpoint. */
  baseURL?: string;
  /**
   * Freeform params block — per-request override for temperature, maxTokens,
   * enable_thinking and any other pass-through keys forwarded to modelKwargs.
   * Values here take precedence over the top-level temperature/maxTokens fields.
   */
  params?: ModelConfigParams;
}

const OPENAI_COMPAT_BASE_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  opencodego: "https://opencode.ai/zen/go/v1",
};

export function getModel(cfg: ModelConfig): BaseChatModel {
  const { provider, model } = cfg;
  // params.temperature / params.maxTokens take precedence over the top-level fields
  const temperature = cfg.params?.temperature ?? cfg.temperature ?? 0.2;
  const maxTokens = cfg.params?.maxTokens ?? cfg.maxTokens;

  // ── OpenAI + all OpenAI-compatible providers ──────────────────────────────
  if (
    provider === "openai" ||
    provider === "openrouter" ||
    provider === "groq" ||
    provider === "opencodego" ||
    provider === "ollama"
  ) {
    const providerKeys: Record<string, [string, string | undefined]> = {
      openai: ["OPENAI_API_KEY", config.openaiApiKey],
      openrouter: ["OPENROUTER_API_KEY", config.openrouterApiKey],
      groq: ["GROQ_API_KEY", config.groqApiKey],
      opencodego: ["OPENCODE_GO_API_KEY", config.opencodeGoApiKey],
    };
    const apiKey = cfg.apiKey || (provider === "ollama" ? "ollama" : providerKeys[provider]?.[1]);
    if (!apiKey) {
      throw new Error(
        `No API key for provider "${provider}". Set ${providerKeys[provider]?.[0]} or supply modelConfig.apiKey.`
      );
    }
    const baseURL = cfg.baseURL ?? (provider === "ollama"
      ? config.ollamaBaseUrl : OPENAI_COMPAT_BASE_URLS[provider]);

    const { temperature: _t, maxTokens: _m, enable_thinking, ...passthroughParams } = cfg.params ?? {};
    const modelKwargs: Record<string, unknown> = {
      ...passthroughParams,
      ...(provider === "opencodego" ? { enable_thinking: enable_thinking ?? false } : {}),
    };

    // Typed as unknown: assigning ChatOpenAI to BaseChatModel hits TS2589 (deep generics).
    const chat: unknown = new ChatOpenAI({
      modelName: model,
      temperature,
      // Cap output so a "thinking" model can't burn an unbounded budget; a full
      // single scene fits well under this.
      maxTokens: maxTokens ?? 8000,
      openAIApiKey: apiKey,
      configuration: baseURL ? { baseURL } : undefined,
      modelKwargs,
    });
    return chat as BaseChatModel;
  }

  // ── Anthropic ─────────────────────────────────────────────────────────────
  if (provider === "anthropic") {
    const apiKey = cfg.apiKey ?? config.anthropicApiKey;
    if (!apiKey) throw new Error("No API key for provider 'anthropic'. Set ANTHROPIC_API_KEY or supply modelConfig.apiKey.");
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
    if (!apiKey) throw new Error("No API key for provider 'gemini'. Set GEMINI_API_KEY or supply modelConfig.apiKey.");
    const chat: unknown = new ChatGoogleGenerativeAI({
      modelName: model,
      temperature,
      maxOutputTokens: maxTokens,
      apiKey,
    });
    return chat as BaseChatModel;
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
