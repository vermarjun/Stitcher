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
    /** Endpoint override; null = provider default. */
    baseURL: string | null;
    /** Model id; null = provider default / not applicable. */
    model: string | null;
    /** Freeform params (temperature, maxTokens, region, voice, …). */
    params: Record<string, unknown>;
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
            model:    config.OPENCODE_GO_DEFAULT_MODEL || "glm-5.1",
            params:   { max_tokens: 4096, temperature: 0.1 },
        },
        embedder: {
            provider: "ollama",
            apiKey:   "",
            baseURL:  (config as unknown as Record<string, string>)["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
            model:    "bge-m3",
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

function rowToResolved(doc: {
    provider: string;
    apiKey: string;
    baseURL: string | null;
    modelId: string | null;
    params: Record<string, unknown>;
}): ResolvedServiceConfig {
    let decrypted = "";
    if (doc.apiKey) {
        try {
            decrypted = decrypt(doc.apiKey);
        } catch {
            decrypted = "";
        }
    }
    return {
        provider: doc.provider,
        apiKey:   decrypted,
        baseURL:  doc.baseURL,
        model:    doc.modelId,
        params:   doc.params ?? {},
    };
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
            baseURL: string | null;
            modelId: string | null;
            params: Record<string, unknown>;
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
 * User.plan values: 'free' | 'basic' | 'plus' | 'max'
 * Mapping:  free → free,  basic → free,  plus → plus,  max → master,  unknown → free
 */
export function tierForUser(
    userOrPlan: Pick<IUser, "plan"> | string | null | undefined
): TierKey {
    const plan =
        typeof userOrPlan === "string"
            ? userOrPlan
            : (userOrPlan as Pick<IUser, "plan"> | null | undefined)?.plan ?? "";

    switch (plan) {
        case "plus":
            return "plus";
        case "max":
        case "master":
            return "master";
        case "free":
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
