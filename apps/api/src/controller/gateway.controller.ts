/**
 * Gateway controller — subscription token manager + OpenAI-compatible proxy.
 *
 * Admin endpoints (JWT + admin role):
 *   GET  /admin/gateway/status                  — list configured providers
 *   PUT  /admin/gateway/providers/:name         — manual token upsert
 *   POST /admin/gateway/codex/start-auth        — begin OAuth PKCE flow → returns oauthUrl
 *   POST /admin/gateway/codex/refresh           — manually refresh Codex token
 *
 * Public callback (no auth — OpenAI redirects here):
 *   GET  /gateway/codex/callback                — exchange code, save tokens, close popup
 *
 * Proxy endpoint (GATEWAY_INTERNAL_KEY bearer):
 *   ANY  /gateway/proxy/:provider/v1/*          — forward to actual LLM provider
 *
 * Supported providers:
 *   opencode-go → https://opencode.ai/zen/go/v1
 *   codex       → https://api.openai.com/v1  (with PKCE OAuth + auto-refresh)
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import axios from 'axios';
import GatewayConfig, { GATEWAY_PROVIDERS } from '../model/gatewayConfig.model';
import { encrypt, decrypt } from '../util/crypto.util';
import { config } from '../config';
import logger from '../util/logger.util';
import type { IUser } from '../model/user.model';

// ── Provider catalogue ────────────────────────────────────────────────────────

export const GATEWAY_BASE_URLS: Record<string, string> = {
    'opencode-go': 'https://opencode.ai/zen/go/v1',
    'codex': 'https://api.openai.com/v1',
};

export const GATEWAY_MODELS: Record<string, string[]> = {
    'opencode-go': [
        'glm-5.1', 'glm-5',
        'kimi-k2.5', 'kimi-k2.6',
        'deepseek-v4-flash', 'deepseek-v4-pro',
        'mimo-v2-omni', 'mimo-v2-pro', 'mimo-v2.5', 'mimo-v2.5-pro',
        'minimax-m2.5', 'minimax-m2.7',
        'qwen3.5-plus', 'qwen3.6-plus',
    ],
    'codex': [
        'o3', 'o4-mini', 'o3-mini',
        'gpt-4.1', 'gpt-4.1-mini',
        'gpt-4o', 'gpt-4o-mini',
        'gpt-4-turbo', 'gpt-4',
    ],
};

// ── Codex OAuth constants ─────────────────────────────────────────────────────
// Extracted from the official openai/codex Rust source (codex-rs/login/src/).
// The redirect_uri and scope are hardcoded in OpenAI's Hydra allowlist —
// they MUST match exactly or the authorize request returns invalid_request.

const CODEX_CLIENT_ID   = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CODEX_AUTH_URL    = 'https://auth.openai.com/oauth/authorize';
const CODEX_TOKEN_URL   = 'https://auth.openai.com/oauth/token';
// Port 1455 is what OpenAI's Hydra allowlist expects.  1457 is the official fallback.
const CODEX_OAUTH_PORT  = 1455;
const CODEX_REDIRECT_URI = `http://localhost:${CODEX_OAUTH_PORT}/auth/callback`;
const CODEX_SCOPE = 'openid profile email offline_access api.connectors.read api.connectors.invoke';

// In-memory PKCE state store (TTL 10 minutes). Fine for a single-admin app.
const pkceStore = new Map<string, { verifier: string; userId: string; createdAt: number }>();

// Prune expired entries every 5 minutes
setInterval(() => {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [k, v] of pkceStore) {
        if (v.createdAt < cutoff) pkceStore.delete(k);
    }
}, 5 * 60_000).unref();

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskToken(token: string): string {
    if (!token || token.length <= 8) return '••••';
    return token.slice(0, 4) + '••••' + token.slice(-4);
}

function codexCallbackURL(): string {
    return CODEX_REDIRECT_URI;
}

// ── Admin: list status ────────────────────────────────────────────────────────

export async function listGatewayStatus(_req: Request, res: Response): Promise<void> {
    const docs = await GatewayConfig.find().lean();

    const providers = GATEWAY_PROVIDERS.map((provider) => {
        const doc = docs.find((d) => d.provider === provider);
        let maskedToken: string | null = null;
        if (doc?.encryptedToken) {
            try { maskedToken = maskToken(decrypt(doc.encryptedToken)); } catch { /* */ }
        }
        return {
            provider,
            baseURL: GATEWAY_BASE_URLS[provider],
            configured: !!doc,
            maskedToken,
            hasRefreshToken: doc ? !!doc.encryptedRefreshToken : false,
            expiresAt: doc?.expiresAt ?? null,
            updatedAt: (doc as unknown as { updatedAt?: Date })?.updatedAt ?? null,
            updatedBy: doc?.updatedBy ?? null,
            models: GATEWAY_MODELS[provider] ?? [],
        };
    });

    const internalKeySet = !!config.GATEWAY_INTERNAL_KEY;
    const proxyBase = `${config.PUBLIC_APP_URL ?? 'http://localhost:3000'}${config.API_PREFIX ?? ''}/gateway/proxy`;

    res.json({ providers, internalKeySet, proxyBase });
}

// ── Admin: manual token upsert ────────────────────────────────────────────────

export async function upsertGatewayProvider(req: Request, res: Response): Promise<void> {
    const { provider } = req.params as { provider: string };

    if (!GATEWAY_BASE_URLS[provider]) {
        res.status(400).json({ message: `Unknown gateway provider: ${provider}` });
        return;
    }

    const { token, refreshToken, expiresAt } = req.body as {
        token?: string;
        refreshToken?: string;
        expiresAt?: string;
    };

    if (!token?.trim()) {
        res.status(400).json({ message: 'token is required' });
        return;
    }

    const userId = (req as Request & { user?: Pick<IUser, '_id'> }).user?._id?.toString() ?? null;
    const update: Record<string, unknown> = {
        encryptedToken: encrypt(token.trim()),
        updatedBy: userId,
    };
    if (refreshToken?.trim()) update.encryptedRefreshToken = encrypt(refreshToken.trim());
    if (expiresAt) update.expiresAt = new Date(expiresAt);

    await GatewayConfig.findOneAndUpdate({ provider }, { $set: update }, { upsert: true, new: true });
    logger.info({ message: '[gateway] token upserted', provider, updatedBy: userId });
    res.json({ success: true, provider });
}

// ── Codex OAuth: start flow ───────────────────────────────────────────────────

export async function startCodexAuth(req: Request, res: Response): Promise<void> {
    // Generate PKCE verifier + challenge
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    const userId = (req as Request & { user?: Pick<IUser, '_id'> }).user?._id?.toString() ?? 'admin';
    pkceStore.set(state, { verifier, userId, createdAt: Date.now() });

    const callbackURL = codexCallbackURL();
    const authURL = new URL(CODEX_AUTH_URL);
    authURL.searchParams.set('client_id', CODEX_CLIENT_ID);
    authURL.searchParams.set('response_type', 'code');
    authURL.searchParams.set('redirect_uri', callbackURL);
    authURL.searchParams.set('scope', CODEX_SCOPE);
    authURL.searchParams.set('code_challenge', challenge);
    authURL.searchParams.set('code_challenge_method', 'S256');
    authURL.searchParams.set('state', state);

    logger.info({ message: '[gateway] codex OAuth flow started', callbackURL });
    res.json({ oauthUrl: authURL.toString() });
}

// ── Codex OAuth: callback (public — OpenAI redirects here) ───────────────────

const CALLBACK_SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>Codex Connected</title>
<style>*{margin:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}</style>
</head>
<body>
<div style="text-align:center;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:2.5rem 3rem;max-width:380px">
  <div style="font-size:3rem;margin-bottom:1rem">✓</div>
  <h2 style="color:#4ade80;font-size:1.25rem;margin-bottom:0.5rem">Codex Connected!</h2>
  <p style="color:#94a3b8;font-size:0.9rem">Tokens saved. You can close this window.</p>
  <p style="color:#475569;font-size:0.75rem;margin-top:1.5rem">Closing automatically…</p>
</div>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'codex_connected' }, '*');
  }
  setTimeout(() => window.close(), 2000);
</script>
</body>
</html>`;

function callbackErrorHTML(msg: string): string {
    return `<!DOCTYPE html>
<html>
<head><title>Auth Error</title>
<style>*{margin:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}</style>
</head>
<body>
<div style="text-align:center;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:2.5rem 3rem;max-width:380px">
  <div style="font-size:3rem;margin-bottom:1rem">✗</div>
  <h2 style="color:#f87171;font-size:1.25rem;margin-bottom:0.5rem">Auth Failed</h2>
  <p style="color:#94a3b8;font-size:0.9rem">${msg}</p>
  <p style="color:#475569;font-size:0.75rem;margin-top:1.5rem">Close this window and try again.</p>
</div>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'codex_error', error: ${JSON.stringify(msg)} }, '*');
  }
</script>
</body>
</html>`;
}

export async function codexAuthCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query as Record<string, string>;

    if (error || !code || !state) {
        res.send(callbackErrorHTML(error ?? 'Auth was cancelled or no code returned.'));
        return;
    }

    const pkce = pkceStore.get(state);
    if (!pkce) {
        res.send(callbackErrorHTML('Auth session expired or invalid state. Please try connecting again.'));
        return;
    }
    pkceStore.delete(state);

    try {
        const tokenRes = await axios.post<{
            access_token: string;
            refresh_token?: string;
            expires_in?: number;
            token_type?: string;
        }>(
            CODEX_TOKEN_URL,
            {
                grant_type: 'authorization_code',
                code,
                client_id: CODEX_CLIENT_ID,
                redirect_uri: codexCallbackURL(),
                code_verifier: pkce.verifier,
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const { access_token, refresh_token, expires_in } = tokenRes.data;

        if (!access_token) {
            res.send(callbackErrorHTML('No access token in OAuth response.'));
            return;
        }

        const update: Record<string, unknown> = {
            encryptedToken: encrypt(access_token),
            updatedBy: pkce.userId,
        };
        if (refresh_token) update.encryptedRefreshToken = encrypt(refresh_token);
        if (expires_in) update.expiresAt = new Date(Date.now() + expires_in * 1000);

        await GatewayConfig.findOneAndUpdate(
            { provider: 'codex' },
            { $set: update },
            { upsert: true, new: true }
        );

        logger.info({ message: '[gateway] Codex OAuth complete — tokens saved', userId: pkce.userId });
        res.send(CALLBACK_SUCCESS_HTML);
    } catch (err) {
        const detail = axios.isAxiosError(err)
            ? JSON.stringify(err.response?.data ?? err.message)
            : String(err);
        logger.error({ message: '[gateway] Codex token exchange failed', error: detail });
        res.send(callbackErrorHTML(`Token exchange failed: ${detail}`));
    }
}

// ── Codex token refresh (shared by admin endpoint + auto-refresh) ─────────────

async function refreshCodexTokens(): Promise<string> {
    const doc = await GatewayConfig.findOne({ provider: 'codex' }).lean();
    if (!doc?.encryptedRefreshToken) {
        throw new Error('No refresh token stored for codex. Re-connect via OAuth.');
    }

    const refreshToken = decrypt(doc.encryptedRefreshToken);

    const res = await axios.post<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
    }>(
        CODEX_TOKEN_URL,
        {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: CODEX_CLIENT_ID,
        },
        { headers: { 'Content-Type': 'application/json' } }
    );

    const { access_token, refresh_token: newRefreshToken, expires_in } = res.data;
    if (!access_token) throw new Error('No access_token in refresh response');

    const update: Record<string, unknown> = { encryptedToken: encrypt(access_token) };
    // Some providers rotate the refresh token — save the new one if issued
    if (newRefreshToken) update.encryptedRefreshToken = encrypt(newRefreshToken);
    if (expires_in) update.expiresAt = new Date(Date.now() + expires_in * 1000);

    await GatewayConfig.findOneAndUpdate({ provider: 'codex' }, { $set: update });
    logger.info({ message: '[gateway] Codex token refreshed' });
    return access_token;
}

export async function refreshCodexTokenEndpoint(_req: Request, res: Response): Promise<void> {
    try {
        const newToken = await refreshCodexTokens();
        res.json({ success: true, maskedToken: maskToken(newToken) });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ message: '[gateway] manual Codex refresh failed', error: msg });
        res.status(400).json({ success: false, error: msg });
    }
}

// ── Proxy handler ─────────────────────────────────────────────────────────────

async function doProxy(
    req: Request,
    res: Response,
    targetURL: string,
    providerToken: string,
    provider: string
): Promise<void> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': req.headers['content-type'] ?? 'application/json',
    };
    if (req.headers['accept'])      headers['Accept']      = req.headers['accept'] as string;
    if (req.headers['openai-beta']) headers['OpenAI-Beta'] = req.headers['openai-beta'] as string;

    const upstreamRes = await axios({
        method: req.method,
        url: targetURL,
        headers,
        data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
        responseType: 'stream',
        timeout: 300_000,
        validateStatus: () => true,
    });

    return new Promise<void>((resolve, reject) => {
        if (upstreamRes.status === 401 && !res.headersSent) {
            // Drain the body before the caller handles the 401
            (upstreamRes.data as NodeJS.ReadableStream).resume();
            (upstreamRes.data as NodeJS.ReadableStream).on('end', () => reject({ is401: true, provider }));
            return;
        }

        res.status(upstreamRes.status);
        const pass = ['content-type', 'x-request-id', 'openai-version', 'openai-processing-ms', 'transfer-encoding'];
        for (const h of pass) { const v = upstreamRes.headers[h]; if (v) res.setHeader(h, v as string); }
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = upstreamRes.data as NodeJS.ReadableStream;
        stream.pipe(res);
        stream.on('end', resolve);
        stream.on('error', reject);
    });
}

export async function proxyRequest(req: Request, res: Response): Promise<void> {
    const { provider } = req.params as { provider: string };
    const targetBase = GATEWAY_BASE_URLS[provider];

    if (!targetBase) {
        res.status(400).json({ error: `Unknown gateway provider: ${provider}` });
        return;
    }

    const gatewayDoc = await GatewayConfig.findOne({ provider }).lean();
    if (!gatewayDoc) {
        res.status(503).json({ error: `Provider "${provider}" not configured in gateway.` });
        return;
    }

    let providerToken: string;
    try { providerToken = decrypt(gatewayDoc.encryptedToken); }
    catch { res.status(500).json({ error: 'Failed to decrypt gateway token' }); return; }

    const urlSuffix = (req.params as Record<string, string>)['0'] ?? '';
    const targetURL = `${targetBase}/${urlSuffix}`;
    logger.debug({ message: '[gateway] proxy', provider, targetURL });

    try {
        await doProxy(req, res, targetURL, providerToken, provider);
    } catch (err) {
        // ── Auto-refresh for Codex on 401 ────────────────────────────────────
        if ((err as { is401?: boolean }).is401 && provider === 'codex' && !res.headersSent) {
            logger.info({ message: '[gateway] codex 401 — attempting token refresh' });
            try {
                const freshToken = await refreshCodexTokens();
                await doProxy(req, res, targetURL, freshToken, provider);
                return;
            } catch (refreshErr) {
                const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
                logger.warn({ message: '[gateway] codex auto-refresh failed', error: msg });
                if (!res.headersSent) {
                    res.status(401).json({ error: 'Codex token expired. Auto-refresh failed: ' + msg });
                }
                return;
            }
        }

        logger.error({ message: '[gateway] proxy error', provider, error: String(err) });
        if (!res.headersSent) {
            res.status(502).json({ error: 'Gateway proxy error', detail: String(err) });
        }
    }
}

// ── Admin: test a model ───────────────────────────────────────────────────────

export async function testGatewayModel(req: Request, res: Response): Promise<void> {
    const { provider, model, params } = req.body as {
        provider?: string;
        model?: string;
        params?: Record<string, unknown>;
    };

    if (!provider || !GATEWAY_BASE_URLS[provider]) {
        res.status(400).json({ error: 'provider is required and must be opencode-go or codex' });
        return;
    }
    if (!model?.trim()) {
        res.status(400).json({ error: 'model is required' });
        return;
    }

    const gatewayDoc = await GatewayConfig.findOne({ provider }).lean();
    if (!gatewayDoc) {
        res.status(503).json({ error: `No token configured for "${provider}". Add it in the Gateway panel first.` });
        return;
    }

    let token: string;
    try { token = decrypt(gatewayDoc.encryptedToken); }
    catch { res.status(500).json({ error: 'Failed to decrypt token' }); return; }

    const baseURL = GATEWAY_BASE_URLS[provider];
    const startMs = Date.now();

    // Sanitise params — strip stream so we always get a JSON response
    const { stream: _stream, ...safeParams } = (params ?? {}) as Record<string, unknown> & { stream?: unknown };

    try {
        const upstream = await axios.post<{
            choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            error?: { message?: string; type?: string };
        }>(
            `${baseURL}/chat/completions`,
            {
                model: model.trim(),
                messages: [{ role: 'user', content: 'Hi! Just say "API OK" and nothing else.' }],
                max_tokens: 32,          // keep test cheap
                ...safeParams,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30_000,
                validateStatus: () => true,
            }
        );

        const latencyMs = Date.now() - startMs;
        const data = upstream.data;

        if (upstream.status >= 400) {
            const errMsg = data?.error?.message ?? JSON.stringify(data).slice(0, 300);
            res.status(upstream.status).json({
                success: false,
                provider,
                model,
                latencyMs,
                httpStatus: upstream.status,
                error: errMsg,
                raw: data,
            });
            return;
        }

        const reply = data.choices?.[0]?.message?.content ?? '(no content)';
        const finish = data.choices?.[0]?.finish_reason;
        res.json({
            success: true,
            provider,
            model,
            latencyMs,
            httpStatus: upstream.status,
            reply,
            finishReason: finish,
            usage: data.usage ?? null,
        });
    } catch (err) {
        const latencyMs = Date.now() - startMs;
        const msg = axios.isAxiosError(err) ? (err.message + (err.code ? ` (${err.code})` : '')) : String(err);
        logger.warn({ message: '[gateway] test failed', provider, model, error: msg });
        res.status(502).json({ success: false, provider, model, latencyMs, error: msg });
    }
}
