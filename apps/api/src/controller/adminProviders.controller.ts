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

// ─── GET /admin/providers ─────────────────────────────────────────────────────

export async function listProviders(req: Request, res: Response): Promise<Response> {
    void req; // auth + requireAdmin already ran; req.userId set but not used here
    try {
        const docs = await ServiceConfig.find({}).lean<Array<{
            service: ServiceKey;
            tier: TierKey;
            provider: string;
            apiKey: string;
            baseURL: string | null;
            modelId: string | null;
            params: Record<string, unknown>;
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
            const { masked, hasKey } = maskApiKey(doc.apiKey, doc.provider);
            grouped[doc.service][doc.tier] = {
                provider:  doc.provider,
                maskedKey: masked,
                hasKey,
                baseURL:   doc.baseURL,
                model:     doc.modelId,
                params:    doc.params ?? {},
                enabled:   doc.enabled,
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
        provider?: unknown;
        apiKey?:   unknown;
        baseURL?:  unknown;
        model?:    unknown;
        params?:   unknown;
        enabled?:  unknown;
    };

    // Provider is required on upsert
    if (body.provider !== undefined && typeof body.provider !== "string") {
        return res.status(400).json({ error: { message: "provider must be a string" } });
    }

    // params must be an object if supplied
    if (body.params !== undefined && (typeof body.params !== "object" || Array.isArray(body.params) || body.params === null)) {
        return res.status(400).json({ error: { message: "params must be a plain object" } });
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

        if (body.provider !== undefined) updateFields["provider"] = (body.provider as string).trim();
        if (body.baseURL  !== undefined) updateFields["baseURL"]  = (typeof body.baseURL === "string" && body.baseURL.trim()) ? body.baseURL.trim() : null;
        if (body.model    !== undefined) updateFields["modelId"]  = (typeof body.model === "string" && body.model.trim()) ? body.model.trim() : null;
        if (body.params   !== undefined) updateFields["params"]   = body.params as Record<string, unknown>;
        if (body.enabled  !== undefined) updateFields["enabled"]  = Boolean(body.enabled);

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

        return res.status(200).json({
            ok: true,
            config: {
                service:   doc.service,
                tier:      doc.tier,
                provider:  doc.provider,
                maskedKey: masked,
                hasKey,
                baseURL:   doc.baseURL,
                model:     doc.modelId,
                params:    doc.params,
                enabled:   doc.enabled,
                updatedAt: doc.updatedAt,
            },
        });
    } catch (err) {
        logger.error({ message: "upsertProvider failed", error: String(err), service, tier });
        return res.status(500).json({ error: { message: "Failed to update provider config" } });
    }
}
