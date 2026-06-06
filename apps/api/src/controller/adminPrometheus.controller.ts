/**
 * Admin Prometheus Proxy Controller — §2b of ADMIN_PORTAL_SPEC.md
 *
 * Thin proxy that forwards PromQL queries to the Prometheus HTTP API.
 * On any network/HTTP error from Prometheus, returns 200 { status: "unreachable", data: null }
 * so the dashboard never 500s when Prometheus is down.
 *
 * Env:
 *   PROMETHEUS_URL — default http://localhost:9090
 */

import { Request, Response } from "express";
import axios from "axios";
import logger from "../util/logger.util";

const PROMETHEUS_URL =
    process.env.PROMETHEUS_URL ?? "http://localhost:9090";

/**
 * GET /admin/prometheus/query?query=<promql>[&time=<rfc3339|unix>]
 * Proxies to Prometheus /api/v1/query (instant query).
 */
export async function proxyQuery(req: Request, res: Response) {
    try {
        const params: Record<string, string | string[]> = {};
        if (req.query.query) params.query = req.query.query as string;
        if (req.query.time) params.time = req.query.time as string;

        const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
            params,
            timeout: 8000,
        });

        return res.status(200).json(response.data);
    } catch (err) {
        logger.error({ message: "Prometheus /query proxy failed", error: String(err) });
        return res.status(200).json({ status: "unreachable", data: null });
    }
}

/**
 * GET /admin/prometheus/query_range?query=<promql>&start=<>&end=<>&step=<>
 * Proxies to Prometheus /api/v1/query_range (range query).
 */
export async function proxyQueryRange(req: Request, res: Response) {
    try {
        const params: Record<string, string | string[]> = {};
        if (req.query.query) params.query = req.query.query as string;
        if (req.query.start) params.start = req.query.start as string;
        if (req.query.end) params.end = req.query.end as string;
        if (req.query.step) params.step = req.query.step as string;

        const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
            params,
            timeout: 8000,
        });

        return res.status(200).json(response.data);
    } catch (err) {
        logger.error({ message: "Prometheus /query_range proxy failed", error: String(err) });
        return res.status(200).json({ status: "unreachable", data: null });
    }
}
