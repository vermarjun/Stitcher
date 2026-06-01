/**
 * Gateway router — mounts at ${API_PREFIX} in index.ts.
 *
 * Admin (JWT + admin role):
 *   GET  /admin/gateway/status              list providers + token status
 *   PUT  /admin/gateway/providers/:name     manual token upsert
 *   POST /admin/gateway/codex/start-auth    begin PKCE OAuth → returns { oauthUrl }
 *   POST /admin/gateway/codex/refresh       manually refresh Codex token
 *
 * Public callback (NO auth — OpenAI redirects here after OAuth):
 *   GET  /gateway/codex/callback            exchange code, save tokens, postMessage popup
 *
 * Internal proxy (GATEWAY_INTERNAL_KEY bearer — for the Agent service):
 *   ANY  /gateway/proxy/:provider/v1/*      forward to actual LLM provider
 */

import { Router, Request, Response, NextFunction } from 'express';
import auth from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import {
    listGatewayStatus,
    upsertGatewayProvider,
    startCodexAuth,
    refreshCodexTokenEndpoint,
    testGatewayModel,
    proxyRequest,
} from '../controller/gateway.controller';
import { config } from '../config';

const router = Router();

// ── Internal-key guard for proxy routes ──────────────────────────────────────

function gatewayKeyAuth(req: Request, res: Response, next: NextFunction): void {
    const key = config.GATEWAY_INTERNAL_KEY;
    if (!key) { next(); return; } // open in dev if key not set
    const provided = (req.headers['authorization'] ?? '').toString().replace(/^Bearer\s+/i, '').trim();
    if (provided !== key) {
        res.status(401).json({ error: 'Invalid or missing gateway key' });
        return;
    }
    next();
}

// ── Admin routes ──────────────────────────────────────────────────────────────

router.get('/admin/gateway/status',           auth, requireAdmin, listGatewayStatus);
router.put('/admin/gateway/providers/:provider', auth, requireAdmin, upsertGatewayProvider);
router.post('/admin/gateway/codex/start-auth', auth, requireAdmin, startCodexAuth);
router.post('/admin/gateway/codex/refresh',   auth, requireAdmin, refreshCodexTokenEndpoint);
router.post('/admin/gateway/test',            auth, requireAdmin, testGatewayModel);

// ── Proxy routes ──────────────────────────────────────────────────────────────

router.all('/gateway/proxy/:provider/v1/*', gatewayKeyAuth, proxyRequest);

export default router;
