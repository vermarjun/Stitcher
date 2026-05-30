/**
 * Admin health controller — §2c Health+Actions.
 *
 * GET /admin/health  → returns cached health snapshot from adminHealth.service.
 */

import { Request, Response } from "express";
import { getHealthSnapshot } from "../services/adminHealth.service";
import logger from "../util/logger.util";

/**
 * GET /admin/health
 * Returns { services: ServiceHealth[], generatedAt }.
 */
export async function getHealth(_req: Request, res: Response) {
    try {
        const snapshot = await getHealthSnapshot();
        return res.status(200).json(snapshot);
    } catch (err) {
        logger.error({ message: "getHealth failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to retrieve health snapshot" } });
    }
}
