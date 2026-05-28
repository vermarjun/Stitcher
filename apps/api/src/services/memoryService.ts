/**
 * Long-term user memory — a lightweight, free-form preference store.
 *
 * Memory is a small list of discrete "points" on the User document, each a
 * one-line preference the system has learned about the user (e.g. "prefers a
 * white background"). It is injected verbatim into generation/edit prompts via
 * recall(), and maintained by reflect(): after each user turn we ask a cheap
 * LLM what to learn / update / forget, then apply those actions surgically.
 *
 * No vector DB, no embeddings — the whole memory fits in a prompt, so we store
 * it inline and read it whole.
 *
 * Public surface mirrors the four memory verbs the design asked for:
 *   recall()  — fetch the user's memory (for prompt injection / display)
 *   learn()   — add a new point
 *   update()  — rewrite an existing point by id
 *   forget()  — remove a point by id
 *   reflect() — run the LLM pass that decides + applies learn/update/forget
 */

import crypto from "crypto";
import User, { IMemoryPoint } from "../model/user.model";
import logger from "../util/logger.util";
import { chatCompletion, isLlmConfigured } from "../util/llm.util";

// Hard cap so recall() output (pasted into every prompt) stays small + cheap.
const MAX_POINTS = 30;

function newId(): string {
    return crypto.randomBytes(4).toString("hex");
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** Full memory list (with ids) — for the management API and the reflect prompt. */
export async function getMemory(userId: string): Promise<IMemoryPoint[]> {
    const user = await User.findById(userId).select("memory").lean();
    return user?.memory ?? [];
}

/**
 * Memory formatted for prompt injection. Plain bullet list, no ids.
 * Returns "" when the user has no memory so callers can cheaply skip injection.
 */
export async function recall(userId: string): Promise<string> {
    const points = await getMemory(userId);
    if (points.length === 0) return "";
    return points.map((p) => `- ${p.text}`).join("\n");
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function learn(userId: string, text: string): Promise<void> {
    const clean = text.trim();
    if (!clean) return;
    const point: IMemoryPoint = {
        id: newId(),
        text: clean,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    await User.updateOne({ _id: userId }, { $push: { memory: point } });
}

export async function update(userId: string, id: string, text: string): Promise<void> {
    const clean = text.trim();
    if (!clean) return;
    await User.updateOne(
        { _id: userId, "memory.id": id },
        { $set: { "memory.$.text": clean, "memory.$.updatedAt": new Date() } }
    );
}

export async function forget(userId: string, id: string): Promise<void> {
    await User.updateOne({ _id: userId }, { $pull: { memory: { id } } });
}

/** Keep only the MAX_POINTS most-recently-updated points. */
async function enforceCap(userId: string): Promise<void> {
    const points = await getMemory(userId);
    if (points.length <= MAX_POINTS) return;
    const kept = [...points]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, MAX_POINTS);
    await User.updateOne({ _id: userId }, { $set: { memory: kept } });
}

// ─── reflect() — the LLM-driven maintenance pass ──────────────────────────────

export interface ConversationTurn {
    userMessage: string;
    assistantMessage?: string;
}

type MemoryAction =
    | { action: "learn"; text: string }
    | { action: "update"; id: string; text: string }
    | { action: "forget"; id: string };

const REFLECT_SYSTEM_PROMPT = `You are the long-term memory manager for Stitcher, a tool that generates Manim math/science animation videos from user prompts.

Your job: from the latest conversation turn, decide what DURABLE preferences about THIS user are worth remembering, refining, or removing. These are stable facts about how the user likes their videos or who they are — not one-off content requests.

CAPTURE (durable preferences), e.g.:
- "prefers a white background"
- "likes slow-paced animations"
- "wants minimal on-screen text"
- "teaches high-school physics"
- "prefers a specific intro style with the title fading in"

DO NOT CAPTURE (one-off tasks / transient content):
- "make a video about derivatives"  (that's a task, not a preference)
- "add a circle here"
- anything specific to a single video's subject matter

You are given the user's EXISTING MEMORY (each line tagged with an id) and the latest TURN. Decide on a list of actions. Rules:
- Prefer "update" over "learn" when a similar memory already exists (refine it instead of duplicating).
- Use "forget" when the turn contradicts or obsoletes an existing memory.
- Keep each memory to ONE short sentence.
- If there is nothing durable to do, return an empty array.

Respond with ONLY a JSON array (no prose, no markdown fences). Each element is one of:
{"action":"learn","text":"..."}
{"action":"update","id":"<existing id>","text":"..."}
{"action":"forget","id":"<existing id>"}`;

function buildReflectUserPrompt(points: IMemoryPoint[], turn: ConversationTurn): string {
    const memoryBlock =
        points.length > 0
            ? points.map((p) => `[${p.id}] ${p.text}`).join("\n")
            : "(none)";

    const assistantLine = turn.assistantMessage
        ? `\nAssistant: ${turn.assistantMessage}`
        : "";

    return `EXISTING MEMORY:
${memoryBlock}

TURN:
User: ${turn.userMessage}${assistantLine}

Return the JSON array of actions now.`;
}

/** Tolerant parse: strips markdown fences and extracts the first JSON array. */
function parseActions(raw: string): MemoryAction[] {
    if (!raw) return [];
    let text = raw.trim();
    // Strip ```json ... ``` or ``` ... ``` fences if present
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1]) text = fence[1].trim();

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1 || end < start) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];

    const actions: MemoryAction[] = [];
    for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const a = item as Record<string, unknown>;
        if (a["action"] === "learn" && typeof a["text"] === "string") {
            actions.push({ action: "learn", text: a["text"] });
        } else if (a["action"] === "update" && typeof a["id"] === "string" && typeof a["text"] === "string") {
            actions.push({ action: "update", id: a["id"], text: a["text"] });
        } else if (a["action"] === "forget" && typeof a["id"] === "string") {
            actions.push({ action: "forget", id: a["id"] });
        }
    }
    return actions;
}

/**
 * Look at the latest turn and update the user's long-term memory accordingly.
 * Designed to run off the request path (fire-and-forget from the workers).
 * Never throws — memory maintenance must never break a generation/edit.
 *
 * Returns the actions that were applied (useful for the test endpoint).
 */
export async function reflect(
    userId: string,
    turn: ConversationTurn
): Promise<MemoryAction[]> {
    if (!isLlmConfigured()) {
        logger.warn({ message: "[memory] reflect skipped — OPENCODE_GO_API_KEY not set", userId });
        return [];
    }
    if (!turn.userMessage?.trim()) return [];

    try {
        const points = await getMemory(userId);
        const raw = await chatCompletion({
            messages: [
                { role: "system", content: REFLECT_SYSTEM_PROMPT },
                { role: "user", content: buildReflectUserPrompt(points, turn) },
            ],
            temperature: 0.1,
            maxTokens: 400,
        });

        const actions = parseActions(raw);
        if (actions.length === 0) {
            logger.debug({ message: "[memory] reflect: no actions", userId });
            return [];
        }

        const validIds = new Set(points.map((p) => p.id));
        for (const a of actions) {
            if (a.action === "learn") {
                await learn(userId, a.text);
            } else if (a.action === "update" && validIds.has(a.id)) {
                await update(userId, a.id, a.text);
            } else if (a.action === "forget" && validIds.has(a.id)) {
                await forget(userId, a.id);
            }
        }

        await enforceCap(userId);
        logger.info({ message: "[memory] reflect applied", userId, count: actions.length });
        return actions;
    } catch (err) {
        logger.warn({ message: "[memory] reflect failed (non-fatal)", userId, error: String(err) });
        return [];
    }
}
