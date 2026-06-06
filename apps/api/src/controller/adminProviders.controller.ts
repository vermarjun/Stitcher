/**
 * Admin providers controller — runtime per-tier provider config.
 *
 * GET  /api/admin/providers
 *   Returns all ServiceConfig docs grouped by service → tier, with apiKey
 *   MASKED (shows provider + "••••" + last4 + hasKey boolean).
 *   Never returns plaintext.
 *
 * PUT  /api/admin/providers/:service/:tier
 *   Upsert {provider, apiKey?, baseURL, model, params, enabled}.
 *   If apiKey is omitted/blank the existing encrypted key is kept.
 *   Encrypts new apiKey, busts the resolver cache, writes audit log.
 *
 * Auth: auth middleware + requireAdmin (same as all other /admin routes).
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import ServiceConfig, { SERVICE_KEYS, TIER_KEYS, ServiceKey, TierKey } from "../model/serviceConfig.model";
import AdminAuditLog from "../model/adminAuditLog.model";
import { encrypt, isEncrypted } from "../util/crypto.util";
import { decrypt } from "../util/crypto.util";
import { bustServiceConfigCache, isValidServiceKey, isValidTierKey } from "../util/serviceConfig.util";
import logger from "../util/logger.util";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function writeAuditLog(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    payload: unknown
): Promise<void> {
    try {
        await AdminAuditLog.create({
            adminId: new mongoose.Types.ObjectId(adminId),
            action,
            targetType,
            targetId,
            payload,
        });
    } catch (err) {
        logger.error({
            message: "adminProviders: auditLog write failed",
            action,
            targetId,
            error: String(err),
        });
    }
}

/**
 * Mask an encrypted (or empty) apiKey for safe UI display.
 * Returns: { masked: "sk-••••abcd", hasKey: true } | { masked: "", hasKey: false }
 */
function maskApiKey(encryptedKey: string, provider: string): { masked: string; hasKey: boolean } {
    if (!encryptedKey) return { masked: "", hasKey: false };

    let plain = "";
    try {
        plain = decrypt(encryptedKey);
    } catch {
        return { masked: "••••", hasKey: true };
    }

    if (!plain) return { masked: "", hasKey: false };

    const last4 = plain.length >= 4 ? plain.slice(-4) : plain;
    const prefix = provider ? `${provider.slice(0, 6)}-` : "";
    return { masked: `${prefix}••••${last4}`, hasKey: true };
}

/** Mask a list of encrypted backup keys for UI display (preserving order/index). */
function maskBackupKeys(
    encryptedKeys: string[] | undefined | null,
    provider: string
): Array<{ masked: string; hasKey: boolean }> {
    if (!Array.isArray(encryptedKeys)) return [];
    return encryptedKeys
        .filter((k) => typeof k === "string" && k)
        .map((k) => maskApiKey(k, provider));
}

/**
 * Resolve an incoming backupApiKeys array (from the admin UI) into the stored
 * encrypted list. Each element is one of:
 *   - "__keep__:<i>"  → preserve the existing encrypted key at original index i
 *   - "" / blank      → dropped
 *   - any other value → a new plaintext key (encrypted), or an already-encrypted
 *                       enc:v1: blob (kept as-is)
 * Order is preserved, so the UI fully controls add / remove / reorder.
 */
function resolveBackupApiKeys(incoming: unknown, existing: string[] | undefined): string[] {
    if (!Array.isArray(incoming)) return existing ?? [];
    const prev = Array.isArray(existing) ? existing : [];
    const out: string[] = [];
    for (const raw of incoming) {
        if (typeof raw !== "string") continue;
        const v = raw.trim();
        if (!v) continue;
        const keep = v.match(/^__keep__:(\d+)$/);
        if (keep) {
            const idx = parseInt(keep[1]!, 10);
            if (prev[idx]) out.push(prev[idx]!);
            continue;
        }
        out.push(isEncrypted(v) ? v : encrypt(v));
    }
    return out;
}

// ─── GET /admin/providers ─────────────────────────────────────────────────────

export async function listProviders(req: Request, res: Response): Promise<Response> {
    void req; // auth + requireAdmin already ran; req.userId set but not used here
    try {
        const docs = await ServiceConfig.find({}).lean<Array<{
            service: ServiceKey;
            tier: TierKey;
            provider: string;
            apiKey: string;
            backupApiKeys?: string[] | null;
            baseURL: string | null;
            modelId: string | null;
            params: Record<string, unknown>;
            fallback?: {
                enabled?: boolean;
                provider?: string;
                apiKey?: string;
                baseURL?: string | null;
                modelId?: string | null;
                params?: Record<string, unknown>;
            } | null;
            enabled: boolean;
            updatedAt: Date;
            updatedBy: mongoose.Types.ObjectId | null;
        }>>();

        // Build grouped response: { [service]: { [tier]: {..., maskedKey, hasKey} } }
        const grouped: Record<string, Record<string, unknown>> = {};

        for (const service of SERVICE_KEYS) {
            grouped[service] = {};
            for (const tier of TIER_KEYS) {
                grouped[service][tier] = null;
            }
        }

        for (const doc of docs) {
            // Skip stray/malformed rows (e.g. a backup doc with undefined service/tier).
            // Without this guard, grouped[undefined][undefined] throws and the ENTIRE
            // providers page fails to load.
            if (!SERVICE_KEYS.includes(doc.service) || !TIER_KEYS.includes(doc.tier)) continue;
            const { masked, hasKey } = maskApiKey(doc.apiKey, doc.provider);
            const fb = doc.fallback;
            const fbMasked = fb ? maskApiKey(fb.apiKey ?? "", fb.provider ?? "") : { masked: "", hasKey: false };
            grouped[doc.service][doc.tier] = {
                provider:  doc.provider,
                maskedKey: masked,
                hasKey,
                backupKeys: maskBackupKeys(doc.backupApiKeys, doc.provider),
                baseURL:   doc.baseURL,
                model:     doc.modelId,
                params:    doc.params ?? {},
                enabled:   doc.enabled,
                fallback: {
                    enabled:   Boolean(fb?.enabled),
                    provider:  fb?.provider ?? "",
                    maskedKey: fbMasked.masked,
                    hasKey:    fbMasked.hasKey,
                    baseURL:   fb?.baseURL ?? null,
                    model:     fb?.modelId ?? null,
                    params:    fb?.params ?? {},
                },
                updatedAt: doc.updatedAt,
                updatedBy: doc.updatedBy,
            };
        }

        return res.status(200).json({ ok: true, providers: grouped });
    } catch (err) {
        logger.error({ message: "listProviders failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to fetch provider configs" } });
    }
}

// ─── PUT /admin/providers/:service/:tier ──────────────────────────────────────

export async function upsertProvider(req: Request, res: Response): Promise<Response> {
    const { service, tier } = req.params as { service: string; tier: string };

    // Validate enums
    if (!isValidServiceKey(service)) {
        return res.status(400).json({
            error: { message: `Invalid service. Must be one of: ${SERVICE_KEYS.join(", ")}` },
        });
    }
    if (!isValidTierKey(tier)) {
        return res.status(400).json({
            error: { message: `Invalid tier. Must be one of: ${TIER_KEYS.join(", ")}` },
        });
    }

    const body = req.body as {
        provider?:      unknown;
        apiKey?:        unknown;
        backupApiKeys?: unknown;
        baseURL?:       unknown;
        model?:         unknown;
        params?:        unknown;
        enabled?:       unknown;
        fallback?:      unknown;
    };

    // Provider is required on upsert
    if (body.provider !== undefined && typeof body.provider !== "string") {
        return res.status(400).json({ error: { message: "provider must be a string" } });
    }

    // params must be an object if supplied
    if (body.params !== undefined && (typeof body.params !== "object" || Array.isArray(body.params) || body.params === null)) {
        return res.status(400).json({ error: { message: "params must be a plain object" } });
    }

    // fallback must be a plain object if supplied
    if (body.fallback !== undefined && (typeof body.fallback !== "object" || Array.isArray(body.fallback) || body.fallback === null)) {
        return res.status(400).json({ error: { message: "fallback must be a plain object" } });
    }

    // backupApiKeys must be an array of strings if supplied
    if (body.backupApiKeys !== undefined && !Array.isArray(body.backupApiKeys)) {
        return res.status(400).json({ error: { message: "backupApiKeys must be an array of strings" } });
    }

    try {
        // Load existing doc (or null) to preserve encrypted key when apiKey blank
        const existing = await ServiceConfig.findOne({ service, tier });

        // Determine new encrypted apiKey
        let newEncryptedKey: string | undefined;
        const rawKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

        if (rawKey) {
            newEncryptedKey = isEncrypted(rawKey) ? rawKey : encrypt(rawKey);
        } else {
            // Blank/omitted → keep existing
            newEncryptedKey = existing?.apiKey ?? "";
        }

        const updateFields: Record<string, unknown> = {
            apiKey:    newEncryptedKey,
            updatedBy: new mongoose.Types.ObjectId(req.userId!),
        };

        // Backup keys — resolve the incoming list (with __keep__:<i> preservation)
        // against the existing stored keys. Omitted → keep existing untouched.
        if (body.backupApiKeys !== undefined) {
            updateFields["backupApiKeys"] = resolveBackupApiKeys(body.backupApiKeys, existing?.backupApiKeys);
        }

        if (body.provider !== undefined) updateFields["provider"] = (body.provider as string).trim();
        if (body.baseURL  !== undefined) updateFields["baseURL"]  = (typeof body.baseURL === "string" && body.baseURL.trim()) ? body.baseURL.trim() : null;
        if (body.model    !== undefined) updateFields["modelId"]  = (typeof body.model === "string" && body.model.trim()) ? body.model.trim() : null;
        if (body.params   !== undefined) updateFields["params"]   = body.params as Record<string, unknown>;
        if (body.enabled  !== undefined) updateFields["enabled"]  = Boolean(body.enabled);

        // ── Fallback provider (optional embedded object) ─────────────────────
        // Same blank-key-preserves-existing semantics as the primary apiKey.
        if (body.fallback !== undefined) {
            const fb = body.fallback as {
                enabled?: unknown; provider?: unknown; apiKey?: unknown;
                baseURL?: unknown; model?: unknown; params?: unknown;
            };
            const fbRawKey = typeof fb.apiKey === "string" ? fb.apiKey.trim() : "";
            let fbEncryptedKey: string;
            if (fbRawKey) {
                fbEncryptedKey = isEncrypted(fbRawKey) ? fbRawKey : encrypt(fbRawKey);
            } else {
                fbEncryptedKey = existing?.fallback?.apiKey ?? "";
            }
            updateFields["fallback"] = {
                enabled:  Boolean(fb.enabled),
                provider: typeof fb.provider === "string" ? fb.provider.trim() : "",
                apiKey:   fbEncryptedKey,
                baseURL:  (typeof fb.baseURL === "string" && fb.baseURL.trim()) ? fb.baseURL.trim() : null,
                modelId:  (typeof fb.model === "string" && fb.model.trim()) ? fb.model.trim() : null,
                params:   (fb.params && typeof fb.params === "object" && !Array.isArray(fb.params)) ? fb.params as Record<string, unknown> : {},
            };
        }

        const doc = await ServiceConfig.findOneAndUpdate(
            { service, tier },
            { $set: updateFields },
            { upsert: true, new: true, runValidators: true }
        );

        // Bust the resolver cache so next request picks up the new values
        bustServiceConfigCache();

        // Audit log — never include the plaintext or encrypted key
        await writeAuditLog(
            req.userId!,
            "upsert_service_config",
            "serviceConfig",
            `${service}:${tier}`,
            {
                service,
                tier,
                provider: doc.provider,
                baseURL:  doc.baseURL,
                model:    doc.modelId,
                params:   doc.params,
                enabled:  doc.enabled,
                keyChanged: Boolean(rawKey),
            }
        );

        // Return masked response
        const { masked, hasKey } = maskApiKey(doc.apiKey, doc.provider);
        const docFb = doc.fallback;
        const fbMask = docFb ? maskApiKey(docFb.apiKey ?? "", docFb.provider ?? "") : { masked: "", hasKey: false };

        return res.status(200).json({
            ok: true,
            config: {
                service:   doc.service,
                tier:      doc.tier,
                provider:  doc.provider,
                maskedKey: masked,
                hasKey,
                backupKeys: maskBackupKeys(doc.backupApiKeys, doc.provider),
                baseURL:   doc.baseURL,
                model:     doc.modelId,
                params:    doc.params,
                enabled:   doc.enabled,
                fallback: {
                    enabled:   Boolean(docFb?.enabled),
                    provider:  docFb?.provider ?? "",
                    maskedKey: fbMask.masked,
                    hasKey:    fbMask.hasKey,
                    baseURL:   docFb?.baseURL ?? null,
                    model:     docFb?.modelId ?? null,
                    params:    docFb?.params ?? {},
                },
                updatedAt: doc.updatedAt,
            },
        });
    } catch (err) {
        logger.error({ message: "upsertProvider failed", error: String(err), service, tier });
        return res.status(500).json({ error: { message: "Failed to update provider config" } });
    }
}

// ─── POST /admin/providers/:service/test ──────────────────────────────────────

interface EmbedTestResult {
    success: boolean;
    provider: string;
    model: string;
    httpStatus?: number;
    latencyMs?: number;
    /** Embedding dimensions returned (must match your index numDimensions). */
    dims?: number | null;
    error?: string;
}

/**
 * Test an embedder provider key by making a REAL embedding call. Currently
 * supports gemini (embedContent), ollama (/api/embed) and OpenAI-compatible
 * (/embeddings) providers.
 *
 * Always responds HTTP 200 — the probe result lives in the body so the admin
 * panel's 401 interceptor never logs the user out on a bad/expired key.
 *
 * Body: { provider?, apiKey?, model?, baseURL?, tier?, dim? }
 *   - apiKey: plaintext key to test. If omitted and `tier` is supplied, the
 *     stored embedder PRIMARY key for that tier is decrypted and tested.
 */
export async function testEmbedderKey(req: Request, res: Response): Promise<Response> {
    const { service } = req.params as { service: string };
    if (service !== "embedder") {
        return res.status(400).json({ success: false, error: "Key testing is only available for the embedder service" });
    }

    const body = req.body as {
        provider?: string; apiKey?: string; model?: string; baseURL?: string; tier?: string; dim?: number;
    };
    const provider = (body.provider || "gemini").toLowerCase();
    const model = (typeof body.model === "string" && body.model.trim()) || "gemini-embedding-001";
    const dim = typeof body.dim === "number" && body.dim > 0 ? Math.floor(body.dim) : 3072;

    // Resolve the key: explicit plaintext, else the stored primary key for the tier.
    let key = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!key && body.tier && isValidTierKey(body.tier)) {
        const existing = await ServiceConfig.findOne({ service: "embedder", tier: body.tier }).lean<{ apiKey?: string } | null>();
        if (existing?.apiKey) { try { key = decrypt(existing.apiKey); } catch { key = ""; } }
    }

    const TEXT = "stitcher embedder key test";
    const started = Date.now();
    try {
        if (provider === "gemini") {
            if (!key) return res.status(200).json({ success: false, provider, model, error: "No API key to test (enter a key or pick a tier with a stored key)" });
            const base = (typeof body.baseURL === "string" && body.baseURL.trim()) || "https://generativelanguage.googleapis.com/v1beta";
            const resp = await fetch(`${base}/models/${model}:embedContent?key=${encodeURIComponent(key)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text: TEXT }] }, taskType: "RETRIEVAL_QUERY", outputDimensionality: dim }),
            });
            const text = await resp.text();
            const latencyMs = Date.now() - started;
            let dims: number | null = null, errMsg: string | undefined;
            try {
                const j = JSON.parse(text);
                dims = Array.isArray(j?.embedding?.values) ? j.embedding.values.length : null;
                if (!resp.ok) errMsg = j?.error?.message || `HTTP ${resp.status}`;
            } catch { if (!resp.ok) errMsg = `HTTP ${resp.status}: ${text.slice(0, 200)}`; }
            const success = resp.ok && dims != null;
            const result: EmbedTestResult = { success, provider, model, httpStatus: resp.status, latencyMs, dims, error: success ? undefined : (errMsg || "embedding failed") };
            return res.status(200).json(result);
        }

        if (provider === "ollama") {
            const base = (typeof body.baseURL === "string" && body.baseURL.trim()) || "http://localhost:11434";
            const resp = await fetch(`${base}/api/embed`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model, input: [TEXT] }),
            });
            const text = await resp.text();
            const latencyMs = Date.now() - started;
            let dims: number | null = null;
            try { const j = JSON.parse(text); dims = Array.isArray(j?.embeddings?.[0]) ? j.embeddings[0].length : null; } catch { /* noop */ }
            const success = resp.ok && dims != null;
            return res.status(200).json({ success, provider, model, httpStatus: resp.status, latencyMs, dims, error: success ? undefined : `HTTP ${resp.status}: ${text.slice(0, 200)}` } as EmbedTestResult);
        }

        // OpenAI-compatible (/embeddings)
        const base = typeof body.baseURL === "string" ? body.baseURL.trim() : "";
        if (!base) return res.status(200).json({ success: false, provider, model, error: `baseURL is required to test provider "${provider}"` });
        const resp = await fetch(`${base}/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
            body: JSON.stringify({ model, input: TEXT }),
        });
        const text = await resp.text();
        const latencyMs = Date.now() - started;
        let dims: number | null = null;
        try { const j = JSON.parse(text); dims = Array.isArray(j?.data?.[0]?.embedding) ? j.data[0].embedding.length : null; } catch { /* noop */ }
        const success = resp.ok && dims != null;
        return res.status(200).json({ success, provider, model, httpStatus: resp.status, latencyMs, dims, error: success ? undefined : `HTTP ${resp.status}: ${text.slice(0, 200)}` } as EmbedTestResult);
    } catch (err) {
        return res.status(200).json({ success: false, provider, model, latencyMs: Date.now() - started, error: String(err) } as EmbedTestResult);
    }
}
