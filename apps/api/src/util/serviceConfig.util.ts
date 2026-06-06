/**
 * serviceConfig.util.ts — runtime per-tier provider config resolver.
 *
 * resolveServiceConfig(service, tier)
 *   Priority:
 *     1. ServiceConfig[service][tier] (if enabled)  → Mongo row for that pair
 *     2. ServiceConfig[service]['free']              → free-tier fallback row
 *     3. ENV defaults                                → hard-coded from current env
 *   Never throws — always returns a usable config object.
 *
 * In-memory TTL cache (~15 s) keyed by "service:tier".
 * bustServiceConfigCache() — called by the admin PUT handler after a write.
 *
 * tierForUser(user) — maps User.plan → TierKey (unknown/basic/max → free).
 *
 * Exports for the worker-wiring agent:
 *   resolveServiceConfig, bustServiceConfigCache, tierForUser
 */

import { config } from "../config";
import logger from "./logger.util";
import ServiceConfig, {
    ServiceKey,
    TierKey,
    TIER_KEYS,
} from "../model/serviceConfig.model";
import { decrypt } from "./crypto.util";
import type { IUser } from "../model/user.model";

// ─── Public resolved shape ────────────────────────────────────────────────────

export interface ResolvedServiceConfig {
    provider: string;
    /** Decrypted plaintext API key; empty string when none configured. */
    apiKey: string;
    /**
     * Decrypted ordered backup API keys. Tried after `apiKey`, before any
     * service-side env-default key. Empty/absent when none configured.
     */
    backupApiKeys?: string[];
    /** Endpoint override; null = provider default. */
    baseURL: string | null;
    /** Model id; null = provider default / not applicable. */
    model: string | null;
    /** Freeform params (temperature, maxTokens, region, voice, …). */
    params: Record<string, unknown>;
    /**
     * Resolved fallback provider (decrypted). Present only when the admin
     * configured a fallback for this (service, tier) AND marked it enabled.
     * The worker retries the call with this config when the primary errors or
     * returns empty output. Never has its own nested fallback.
     */
    fallback?: Omit<ResolvedServiceConfig, "fallback">;
}

// ─── ENV defaults (read once at module load) ──────────────────────────────────
// These are the last-resort values when no Mongo row exists for a pair.

function envDefaults(): Record<ServiceKey, ResolvedServiceConfig> {
    return {
        coder: {
            provider: "opencodego",
            apiKey:   config.OPENCODE_GO_API_KEY ?? "",
            baseURL:  "https://opencode.ai/zen/go/v1",
            model:    config.OPENCODE_GO_DEFAULT_MODEL || "glm-5.1",
            params:   { max_tokens: 8000, enable_thinking: false, temperature: 0.2 },
        },
        debugger: {
            provider: "opencodego",
            apiKey:   config.OPENCODE_GO_API_KEY ?? "",
            baseURL:  "https://opencode.ai/zen/go/v1",
            model:    config.OPENCODE_GO_DEFAULT_MODEL || "glm-5.1",
            params:   { max_tokens: 8000, enable_thinking: false, temperature: 0.2 },
        },
        query_transform: {
            provider: "opencodego",
            apiKey:   config.OPENCODE_GO_API_KEY ?? "",
            baseURL:  "https://opencode.ai/zen/go/v1",
            model:    config.OPENCODE_GO_DEFAULT_MODEL || "deepseek-v4-flash",
            // query_transform is latency-critical: if thinking is on it times out under
            // load → empty requiredPlugins → coder falls back to raw Manim. Disable it.
            // The flag is model-family-specific (verified 2026-06-03): deepseek/kimi/qwen/mimo
            // → thinking:{type:"disabled"}; glm/minimax-m2.7 → reasoning:{enabled:false}.
            // Default model here is deepseek-v4-flash (best: ~2.4s, 0 reasoning).
            params:   { max_tokens: 4096, temperature: 0.1, thinking: { type: "disabled" } },
        },
        embedder: {
            provider: (config as unknown as Record<string, string>)["EMBEDDER_PROVIDER"] ?? "gemini",
            apiKey:   (config as unknown as Record<string, string>)["EMBEDDER_API_KEY"]  ?? "",
            baseURL:  "",
            model:    (config as unknown as Record<string, string>)["EMBEDDER_MODEL"]    ?? "gemini-embedding-001",
            params:   {},
        },
        tts: {
            provider: config.TTS_PROVIDER || "gtts",
            apiKey:   config.AZURE_SPEECH_KEY  ?? "",
            baseURL:  null,
            model:    null,
            params:   {
                region: config.AZURE_SPEECH_REGION ?? "eastus",
                voice:  config.DEFAULT_VOICEOVER_VOICE ?? "en-US-AvaNeural",
            },
        },
    };
}

// ─── Gateway baseURL normalisation ────────────────────────────────────────────
//
// Subscription-gateway proxy URLs (…/api/gateway/proxy/<provider>/v1) must be
// reachable from the AGENT container, which calls them. The admin UI auto-fills
// the PUBLIC app URL (e.g. http://localhost:3000 in dev) — but inside docker the
// agent cannot reach `localhost:3000` (that's the agent's own container) or a
// public domain reliably. Force every gateway-proxy URL to the internal docker
// origin so codegen never silently fails with a connection error.
//
// Override with env GATEWAY_INTERNAL_URL (default http://api:3000 — the compose
// service name). Non-gateway URLs (opencode.ai, openai.com, …) pass through.

const GATEWAY_INTERNAL_ORIGIN = process.env.GATEWAY_INTERNAL_URL || "http://api:3000";

export function normalizeGatewayBaseURL(baseURL: string | null | undefined): string | null {
    if (!baseURL) return baseURL ?? null;
    if (!baseURL.includes("/api/gateway/proxy/")) return baseURL;
    try {
        const u = new URL(baseURL);
        const internal = new URL(GATEWAY_INTERNAL_ORIGIN);
        u.protocol = internal.protocol;
        u.host = internal.host; // host includes port
        return u.toString();
    } catch {
        return baseURL;
    }
}

// ─── In-memory TTL cache ──────────────────────────────────────────────────────

const CACHE_TTL_MS = 15_000; // 15 seconds

interface CacheEntry {
    value: ResolvedServiceConfig;
    expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

function cacheKey(service: ServiceKey, tier: TierKey): string {
    return `${service}:${tier}`;
}

function cacheGet(service: ServiceKey, tier: TierKey): ResolvedServiceConfig | undefined {
    const entry = _cache.get(cacheKey(service, tier));
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        _cache.delete(cacheKey(service, tier));
        return undefined;
    }
    return entry.value;
}

function cacheSet(service: ServiceKey, tier: TierKey, value: ResolvedServiceConfig): void {
    _cache.set(cacheKey(service, tier), {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
}

/**
 * Bust all cached entries (call after any admin write so the next request
 * fetches fresh data within the ~15 s window).
 */
export function bustServiceConfigCache(): void {
    _cache.clear();
    logger.debug({ message: "[serviceConfig] cache busted" });
}

// ─── Row → ResolvedServiceConfig ─────────────────────────────────────────────

interface RawFallback {
    enabled?: boolean;
    provider?: string;
    apiKey?: string;
    baseURL?: string | null;
    modelId?: string | null;
    params?: Record<string, unknown>;
}

function safeDecrypt(enc: string | undefined | null): string {
    if (!enc) return "";
    try {
        return decrypt(enc);
    } catch {
        return "";
    }
}

function rowToResolved(doc: {
    provider: string;
    apiKey: string;
    backupApiKeys?: string[] | null;
    baseURL: string | null;
    modelId: string | null;
    params: Record<string, unknown>;
    fallback?: RawFallback | null;
}): ResolvedServiceConfig {
    const resolved: ResolvedServiceConfig = {
        provider: doc.provider,
        apiKey:   safeDecrypt(doc.apiKey),
        backupApiKeys: Array.isArray(doc.backupApiKeys)
            ? doc.backupApiKeys.map(safeDecrypt).filter(Boolean)
            : [],
        baseURL:  doc.baseURL,
        model:    doc.modelId,
        params:   doc.params ?? {},
    };

    // Attach the fallback only when it's enabled and has a provider.
    const fb = doc.fallback;
    if (fb && fb.enabled && typeof fb.provider === "string" && fb.provider.trim()) {
        resolved.fallback = {
            provider: fb.provider,
            apiKey:   safeDecrypt(fb.apiKey),
            baseURL:  fb.baseURL ?? null,
            model:    fb.modelId ?? null,
            params:   fb.params ?? {},
        };
    }

    return resolved;
}

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * Resolve the active provider config for a (service, tier) pair.
 *
 * Priority:
 *   1. DB row [service][tier]  — if exists AND enabled
 *   2. DB row [service][free]  — fallback within service
 *   3. ENV defaults            — last resort; never throws
 */
export async function resolveServiceConfig(
    service: ServiceKey,
    tier: TierKey
): Promise<ResolvedServiceConfig> {
    // 1. Cache hit
    const cached = cacheGet(service, tier);
    if (cached) return cached;

    const defaults = envDefaults();

    try {
        // Fetch both the requested tier and the free-tier in one query
        const docs = await ServiceConfig.find({
            service,
            tier: tier === "free" ? { $in: ["free"] } : { $in: [tier, "free"] },
        }).lean<Array<{
            tier: TierKey;
            provider: string;
            apiKey: string;
            backupApiKeys?: string[] | null;
            baseURL: string | null;
            modelId: string | null;
            params: Record<string, unknown>;
            fallback?: RawFallback | null;
            enabled: boolean;
        }>>();

        const byTier = new Map(docs.map((d) => [d.tier, d]));

        // Priority 1: exact tier row (if enabled)
        const exact = byTier.get(tier);
        if (exact && exact.enabled) {
            const resolved = rowToResolved(exact);
            cacheSet(service, tier, resolved);
            return resolved;
        }

        // Priority 2: free-tier fallback (if enabled and not already the exact tier)
        if (tier !== "free") {
            const free = byTier.get("free");
            if (free && free.enabled) {
                const resolved = rowToResolved(free);
                cacheSet(service, tier, resolved);
                return resolved;
            }
        }
    } catch (err) {
        logger.warn({
            message: "[serviceConfig] DB lookup failed, using env defaults",
            service,
            tier,
            error: String(err),
        });
    }

    // Priority 3: ENV default
    const fallback = defaults[service];
    cacheSet(service, tier, fallback);
    return fallback;
}

// ─── tierForUser ──────────────────────────────────────────────────────────────

/**
 * Map a User doc (or its plan string) to a canonical TierKey.
 * User.plan values: 'free' | 'starter' | 'creator' | 'pro'
 * Mapping:  free/starter → free,  creator → plus,  pro → master,  unknown → free
 */
export function tierForUser(
    userOrPlan: Pick<IUser, "plan"> | string | null | undefined
): TierKey {
    const plan =
        typeof userOrPlan === "string"
            ? userOrPlan
            : (userOrPlan as Pick<IUser, "plan"> | null | undefined)?.plan ?? "";

    switch (plan) {
        case "creator":
        case "plus":
            return "plus";
        case "pro":
        case "max":
        case "master":
            return "master";
        case "free":
        case "starter":
        case "basic":
        default:
            return "free";
    }
}

// ─── Validate helpers (exported for use in the admin controller) ──────────────

export function isValidServiceKey(v: unknown): v is ServiceKey {
    return typeof v === "string" && (["coder", "debugger", "query_transform", "embedder", "tts"] as string[]).includes(v);
}

export function isValidTierKey(v: unknown): v is TierKey {
    return typeof v === "string" && (TIER_KEYS as readonly string[]).includes(v);
}
