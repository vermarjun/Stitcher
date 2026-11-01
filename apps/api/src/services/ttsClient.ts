/**
 * ttsClient.ts — pluggable text-to-speech for native voiceover.
 *
 * Big picture (see /tmp/vo-contract.md): TTS happens ONLINE in the API worker
 * (network + keys). Rendering happens OFFLINE in the air-gapped render sandbox.
 * They are bridged by a pre-generated audio cache keyed by a sha256 hash of the
 * NORMALIZED narration text. This module owns that bridge:
 *
 *   - normalizeText / cacheKey  — MUST be byte-identical to the render service's
 *     `stitcher_voiceover.cache_key` (Python). The render-side OfflineTTS computes
 *     the SAME key from the `self.voiceover(text=...)` literal and looks up
 *     `<key>.mp3` in the staged cache dir. If the hashes diverge, the render fails.
 *   - synthesize(text, opts)    — provider-pluggable; returns mp3 bytes (Buffer).
 *   - buildAudioBundle(beats)   — hashes each beat with cacheKey and returns the
 *     `{ key, base64 }[]` bundle the render service expects under `voiceover.audio`.
 *
 * Providers:
 *   - "gtts"  — google-tts-api (no key; free; works now). Chunked for long beats.
 *   - "azure" — Azure Cognitive Services TTS REST (needs AZURE_SPEECH_KEY). Built
 *     fully but only activates when the key is configured; NOT live-tested here.
 *
 * Optional best-effort Redis cache keyed by sha256(text + voice + provider) so
 * retries / re-renders don't re-synthesize (and, for Azure, don't re-bill).
 */

import crypto from "crypto";
import * as googleTTS from "google-tts-api";
import axios from "axios";
import { config } from "../config";
import logger from "../util/logger.util";
import { redisConnection } from "../queue/connection";

// ─── Shared hash (MUST match render service `stitcher_voiceover.cache_key`) ────
//
// Python reference (frozen contract):
//   normalize_text(t) = " ".join(unicodedata.normalize("NFC", t).split())
//   cache_key(t)      = sha256(normalize_text(t).encode("utf-8")).hexdigest()
//
// CRITICAL parity note: Python's str.split() (no args) splits on a Unicode
// whitespace set that does NOT equal JavaScript's regex \s:
//   - Python treats U+001C..U+001F (file/group/record/unit separators) and
//     U+0085 (NEL) as whitespace; JS \s does NOT.
//   - JS \s treats U+FEFF (ZWNBSP / BOM) as whitespace; Python str.split() does NOT.
// We therefore replicate Python's exact set rather than relying on \s, so the
// hex is byte-identical for unicode/whitespace edge cases.

// The exact code points Python's str.split() collapses, derived empirically from
// CPython (`('a'+chr(c)+'b').split() == ['a','b']`). Verified against the render venv.
const PY_WHITESPACE = new Set<number>([
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, // \t \n \v \f \r
    0x1c, 0x1d, 0x1e, 0x1f, // FS GS RS US — Python-only
    0x20, // space
    0x85, // NEL — Python-only
    0xa0, // NBSP
    0x1680, // OGHAM SPACE MARK
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
    0x2008, 0x2009, 0x200a, // EN QUAD .. HAIR SPACE
    0x2028, 0x2029, // LINE / PARAGRAPH SEPARATOR
    0x202f, // NARROW NBSP
    0x205f, // MEDIUM MATHEMATICAL SPACE
    0x3000, // IDEOGRAPHIC SPACE
]);

function isPyWhitespace(cp: number): boolean {
    return PY_WHITESPACE.has(cp);
}

/**
 * NFC-normalize, then collapse all runs of Python-whitespace to a single ASCII
 * space and strip leading/trailing. Mirrors `" ".join(text.split())` exactly.
 */
export function normalizeText(text: string): string {
    const nfc = text.normalize("NFC");
    const tokens: string[] = [];
    let current = "";
    // Iterate by code point (handles astral chars correctly via the string iterator).
    for (const ch of nfc) {
        const cp = ch.codePointAt(0)!;
        if (isPyWhitespace(cp)) {
            if (current.length > 0) {
                tokens.push(current);
                current = "";
            }
        } else {
            current += ch;
        }
    }
    if (current.length > 0) tokens.push(current);
    return tokens.join(" ");
}

/** sha256 hex of the normalized text. Audio filename/key = cacheKey(beat). */
export function cacheKey(text: string): string {
    return crypto.createHash("sha256").update(normalizeText(text), "utf8").digest("hex");
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type TtsProvider = "gtts" | "azure";

export interface SynthesizeOptions {
    /** Provider voice id (e.g. Azure "en-US-JennyNeural"). Ignored by gTTS. */
    voice?: string;
    /** BCP-47-ish language code (e.g. "en", "en-US"). */
    lang?: string;
    /** Overrides config default when set. */
    provider?: TtsProvider | string;
    /**
     * Internal: per-call Azure key override (set from the resolved TTS config).
     * Takes precedence over config.AZURE_SPEECH_KEY when non-empty.
     */
    _azureKey?: string;
    /**
     * Internal: per-call Azure region override (set from the resolved TTS config).
     * Takes precedence over config.AZURE_SPEECH_REGION when non-empty.
     */
    _azureRegion?: string;
}

export interface AudioBundleEntry {
    key: string;
    base64: string;
}

/**
 * Resolved TTS config passed from the worker (from providers.config resolveTts()).
 * When provided, it takes precedence over global config/env for provider, key, region, and voice.
 */
export interface ResolvedTtsConfig {
    provider: string;
    apiKey: string;
    /** Unused for TTS (no URL override needed), kept for structural parity. */
    baseURL?: string | null;
    params: {
        region?: string;
        voice?: string;
        [key: string]: unknown;
    };
}

// ─── Provider adapters ────────────────────────────────────────────────────────

interface TtsAdapter {
    synthesize(text: string, opts: SynthesizeOptions): Promise<Buffer>;
}

/**
 * gTTS adapter via google-tts-api. No API key. getAllAudioBase64 splits long
 * text into <=200-char chunks (Google's per-request cap) and we concat the mp3
 * bytes — concatenated MP3 frames are independently decodable, so the result is
 * a single playable stream.
 */
const gttsAdapter: TtsAdapter = {
    async synthesize(text: string, opts: SynthesizeOptions): Promise<Buffer> {
        // google-tts-api wants a short language tag (e.g. "en"); take the primary
        // subtag so "en-US" still works.
        const lang = (opts.lang ?? config.DEFAULT_VOICEOVER_LANG ?? "en").split("-")[0] || "en";
        const results = await googleTTS.getAllAudioBase64(text, {
            lang,
            slow: false,
            host: "https://translate.google.com",
            splitPunct: ",.?!;:",
        });
        if (!results || results.length === 0) {
            throw new Error("gTTS returned no audio");
        }
        const buf = Buffer.concat(results.map((r) => Buffer.from(r.base64, "base64")));
        if (buf.length === 0) {
            throw new Error("gTTS produced empty audio");
        }
        return buf;
    },
};

/**
 * Azure Cognitive Services TTS adapter. REST POST to
 * https://<region>.tts.speech.microsoft.com/cognitiveservices/v1 with SSML and
 * the Ocp-Apim-Subscription-Key header, returning mp3.
 *
 * GUARD: only usable when AZURE_SPEECH_KEY + AZURE_SPEECH_REGION are configured.
 * Not live-tested in this repo (no key available). Activated by selecting
 * provider "azure" AND having the key set.
 */
const azureAdapter: TtsAdapter = {
    async synthesize(text: string, opts: SynthesizeOptions): Promise<Buffer> {
        // Per-call overrides (from the resolved TTS config) take precedence over global config.
        const key = (opts._azureKey && opts._azureKey.trim()) ? opts._azureKey : config.AZURE_SPEECH_KEY;
        const region = (opts._azureRegion && opts._azureRegion.trim()) ? opts._azureRegion : config.AZURE_SPEECH_REGION;
        if (!key || !region) {
            throw new Error(
                "Azure TTS selected but AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are not configured"
            );
        }
        const voice = opts.voice ?? config.DEFAULT_VOICEOVER_VOICE ?? "en-US-JennyNeural";
        const lang = opts.lang ?? config.DEFAULT_VOICEOVER_LANG ?? "en-US";

        // SSML with XML-escaped text. mp3 output: 24kHz mono, comparable to gTTS.
        const escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
        const ssml =
            `<speak version="1.0" xml:lang="${lang}">` +
            `<voice xml:lang="${lang}" name="${voice}">${escaped}</voice>` +
            `</speak>`;

        const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
        const res = await axios.post<ArrayBuffer>(url, ssml, {
            responseType: "arraybuffer",
            timeout: 30_000,
            headers: {
                "Ocp-Apim-Subscription-Key": key,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
                "User-Agent": "stitcher-api",
            },
        });
        const buf = Buffer.from(res.data);
        if (buf.length === 0) {
            throw new Error("Azure TTS produced empty audio");
        }
        return buf;
    },
};

function resolveAdapter(provider: string): TtsAdapter {
    switch (provider) {
        case "azure":
            return azureAdapter;
        case "gtts":
            return gttsAdapter;
        default:
            logger.warn({ message: `[tts] unknown provider '${provider}', falling back to gtts` });
            return gttsAdapter;
    }
}

// ─── Redis best-effort cache ──────────────────────────────────────────────────
// Keyed by sha256(text+voice+provider). Distinct from cacheKey (which is keyed
// ONLY on text, because the render side only sees the text). This avoids
// re-synthesis / re-billing across retries and re-renders. Best-effort: any
// Redis error is swallowed and we just synthesize.

const TTS_CACHE_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

function ttsCacheKey(text: string, voice: string, provider: string): string {
    return (
        "tts:audio:" +
        crypto
            .createHash("sha256")
            .update(`${provider} ${voice} ${normalizeText(text)}`, "utf8")
            .digest("hex")
    );
}

// Cap on how long a cache op may take. ioredis with maxRetriesPerRequest:null
// QUEUES commands while the connection is down rather than rejecting, so a bare
// await would hang forever when Redis is unreachable. We race every cache op
// against this timeout and only attempt it when the socket is actually "ready",
// keeping the cache strictly best-effort and never on the critical TTS path.
const CACHE_OP_TIMEOUT_MS = 1_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([
        p,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
}

function redisReady(): boolean {
    // ioredis exposes `status`; only "ready" means commands will round-trip now.
    return (redisConnection as { status?: string }).status === "ready";
}

async function cacheGet(rk: string): Promise<Buffer | null> {
    if (!redisReady()) return null;
    try {
        const v = await withTimeout(redisConnection.getBuffer(rk), CACHE_OP_TIMEOUT_MS);
        return v && v.length > 0 ? v : null;
    } catch (err) {
        logger.debug({ message: "[tts] cache get failed (non-fatal)", error: String(err) });
        return null;
    }
}

async function cacheSet(rk: string, buf: Buffer): Promise<void> {
    if (!redisReady()) return;
    try {
        await withTimeout(redisConnection.set(rk, buf, "EX", TTS_CACHE_TTL_SEC), CACHE_OP_TIMEOUT_MS);
    } catch (err) {
        logger.debug({ message: "[tts] cache set failed (non-fatal)", error: String(err) });
    }
}

// ─── Retry + concurrency (robust against TTS throttling, e.g. Azure F0 tier) ───
// A multi-scene job synthesizes many beats in parallel; the free Azure tier
// (and gTTS under bursts) can throttle. We cap concurrency and retry transient
// failures with exponential backoff. Auth/not-found errors are NOT retried.

const TTS_MAX_RETRIES = 3;
const TTS_MAX_CONCURRENCY = Math.max(1, Number(process.env["TTS_MAX_CONCURRENCY"] ?? 3) || 3);

async function synthesizeWithRetry(
    adapter: TtsAdapter,
    text: string,
    opts: SynthesizeOptions
): Promise<Buffer> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= TTS_MAX_RETRIES; attempt++) {
        try {
            return await adapter.synthesize(text, opts);
        } catch (err) {
            lastErr = err;
            const status = (err as { response?: { status?: number } })?.response?.status;
            // Permanent failures — don't waste retries.
            if (status === 401 || status === 403 || status === 404) throw err;
            if (attempt === TTS_MAX_RETRIES) break;
            const backoffMs = 500 * 2 ** (attempt - 1); // 500, 1000, 2000
            logger.warn({
                message: `[tts] synth attempt ${attempt}/${TTS_MAX_RETRIES} failed; retrying in ${backoffMs}ms`,
                provider: opts.provider,
                status,
                error: String((err as Error)?.message ?? err),
            });
            await new Promise((r) => setTimeout(r, backoffMs));
        }
    }
    throw lastErr;
}

/** Run `fn` over `items` with a bounded number of concurrent executions. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    async function worker(): Promise<void> {
        while (next < items.length) {
            const idx = next++;
            results[idx] = await fn(items[idx]!);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
    return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Synthesize a single beat to mp3 bytes.
 *
 * Provider precedence (highest wins):
 *   1. resolvedTtsConfig.provider  (from the resolved TTS config)
 *   2. opts.provider               (per-job option from generationOptions.voiceover)
 *   3. config.TTS_PROVIDER / "gtts" (global env default)
 *
 * For Azure, key/region are resolved from resolvedTtsConfig first, then config.
 * Voice is resolved from resolvedTtsConfig.params.voice, then opts.voice, then config.
 */
export async function synthesize(
    text: string,
    opts: SynthesizeOptions = {},
    resolvedTtsConfig?: ResolvedTtsConfig
): Promise<Buffer> {
    // Merge the resolved config into opts so adapters see a unified options object.
    const mergedOpts: SynthesizeOptions = { ...opts };
    if (resolvedTtsConfig) {
        // provider from the resolved config overrides per-job opt (which itself overrides env)
        if (!mergedOpts.provider) mergedOpts.provider = resolvedTtsConfig.provider;
        // voice from the resolved config params fills in when not set by caller
        if (!mergedOpts.voice && resolvedTtsConfig.params.voice) {
            mergedOpts.voice = String(resolvedTtsConfig.params.voice);
        }
        // Pass Azure credentials via internal fields for the azureAdapter
        if (resolvedTtsConfig.apiKey) mergedOpts._azureKey = resolvedTtsConfig.apiKey;
        if (resolvedTtsConfig.params.region) mergedOpts._azureRegion = String(resolvedTtsConfig.params.region);
    }

    const provider = String(mergedOpts.provider ?? config.TTS_PROVIDER ?? "gtts");
    const voice = mergedOpts.voice ?? config.DEFAULT_VOICEOVER_VOICE ?? "";
    const rk = ttsCacheKey(text, voice, provider);

    const cached = await cacheGet(rk);
    if (cached) {
        logger.debug({ message: "[tts] cache hit", provider });
        return cached;
    }

    const adapter = resolveAdapter(provider);
    const buf = await synthesizeWithRetry(adapter, text, { ...mergedOpts, provider, voice });
    void cacheSet(rk, buf);
    return buf;
}

/**
 * Build the render-service voiceover bundle for an ordered list of narration
 * beats. Each entry is keyed by cacheKey(beat) (text-only sha256) so the
 * render-side OfflineTTS finds `<key>.mp3` from the `self.voiceover(text=...)`
 * literal it sees. Duplicate beats are de-duplicated by key (the render side
 * only needs one file per distinct text).
 *
 * Throws if `beats` is empty — the worker guards against sending a half-bundle.
 *
 * @param resolvedTtsConfig — optional resolved TTS config from providers.config.
 *   When provided, the provider/apiKey/region/voice from it take precedence over
 *   global config/env.
 */
export async function buildAudioBundle(
    beats: string[],
    opts: SynthesizeOptions = {},
    resolvedTtsConfig?: ResolvedTtsConfig
): Promise<AudioBundleEntry[]> {
    if (!Array.isArray(beats) || beats.length === 0) {
        throw new Error("buildAudioBundle: no narration beats provided");
    }
    // De-duplicate by cacheKey to avoid re-synthesizing identical text.
    const seen = new Map<string, string>(); // key -> beat (first occurrence)
    for (const beat of beats) {
        if (typeof beat !== "string" || beat.trim().length === 0) {
            throw new Error("buildAudioBundle: empty/invalid narration beat");
        }
        const key = cacheKey(beat);
        if (!seen.has(key)) seen.set(key, beat);
    }

    // Bounded concurrency so a many-beat scene doesn't burst-throttle the TTS
    // provider (notably Azure F0). synthesize() itself retries transient errors.
    const entries = await mapLimit(
        Array.from(seen.entries()),
        TTS_MAX_CONCURRENCY,
        async ([key, beat]) => {
            const buf = await synthesize(beat, opts, resolvedTtsConfig);
            return { key, base64: buf.toString("base64") };
        }
    );
    return entries;
}

// Grouped export for ergonomic importing alongside the other *Client singletons.
export const ttsClient = {
    normalizeText,
    cacheKey,
    synthesize,
    buildAudioBundle,
};

