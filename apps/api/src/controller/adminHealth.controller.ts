/**
 * Admin health controller — §2c Health+Actions.
 *
 * GET /admin/health  → returns cached health snapshot from adminHealth.service.
 */

import { Request, Response } from "express";
import { getHealthSnapshot } from "../services/adminHealth.service";
import { getLlmHourlyCallCount } from "../util/llm.util";
import logger from "../util/logger.util";

/**
 * GET /admin/health
 * Returns { services, generatedAt, llmUsage }.
 * llmUsage shows how many background LLM calls (memory reflection etc.) have
 * been made in the current hour vs the hourly cap — useful for spotting runaway
 * background processes before they drain API quota.
 */
export async function getHealth(_req: Request, res: Response) {
    try {
        const [snapshot, llmUsage] = await Promise.all([
            getHealthSnapshot(),
            getLlmHourlyCallCount(),
        ]);
        return res.status(200).json({ ...snapshot, llmUsage });
    } catch (err) {
        logger.error({ message: "getHealth failed", error: String(err) });
        return res.status(500).json({ error: { message: "Failed to retrieve health snapshot" } });
    }
}
