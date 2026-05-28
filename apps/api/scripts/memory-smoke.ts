/**
 * Isolated smoke test for the memory LLM loop — NO database writes.
 *
 * Verifies:
 *   1. OpenCode Go is reachable from Node with the configured key.
 *   2. glm-5.1 returns parseable JSON actions for the reflect prompt.
 *   3. The model distinguishes durable preferences from one-off tasks.
 *
 * Run: npx tsx scripts/memory-smoke.ts
 */

import { chatCompletion, isLlmConfigured } from "../src/util/llm.util";

const SYSTEM = `You are the long-term memory manager for Stitcher, a tool that generates Manim math/science animation videos from user prompts.

Your job: from the latest conversation turn, decide what DURABLE preferences about THIS user are worth remembering, refining, or removing. Capture stable preferences (e.g. "prefers a white background", "likes slow-paced animations"). Do NOT capture one-off content requests (e.g. "make a video about derivatives").

You are given EXISTING MEMORY (each line tagged with an id) and the latest TURN. Prefer "update" over "learn" when a similar memory exists; use "forget" when contradicted. Keep each memory to ONE short sentence. If nothing durable, return [].

Respond with ONLY a JSON array. Each element is one of:
{"action":"learn","text":"..."}
{"action":"update","id":"<id>","text":"..."}
{"action":"forget","id":"<id>"}`;

const CASES: Array<{ name: string; memory: string; turn: string }> = [
    {
        name: "durable preference (should learn)",
        memory: "(none)",
        turn: 'User: Can you use a white background this time? I always find the black one too harsh.',
    },
    {
        name: "one-off task (should be empty [])",
        memory: "(none)",
        turn: "User: Make a 30-second video explaining the Pythagorean theorem.",
    },
    {
        name: "contradiction (should update or forget+learn)",
        memory: "[a1b2] prefers a white background",
        turn: "User: Actually go back to a dark background, white is too bright for my videos.",
    },
];

async function main() {
    if (!isLlmConfigured()) {
        console.error("OPENCODE_GO_API_KEY not set — aborting.");
        process.exit(1);
    }

    for (const c of CASES) {
        const user = `EXISTING MEMORY:\n${c.memory}\n\nTURN:\n${c.turn}\n\nReturn the JSON array of actions now.`;
        let raw = "";
        try {
            raw = await chatCompletion({
                messages: [
                    { role: "system", content: SYSTEM },
                    { role: "user", content: user },
                ],
                temperature: 0.1,
                maxTokens: 400,
            });
        } catch (err) {
            console.error(`\n[${c.name}] LLM call FAILED:`, String(err));
            continue;
        }

        let parsed: unknown = "PARSE_FAILED";
        const s = raw.indexOf("[");
        const e = raw.lastIndexOf("]");
        if (s !== -1 && e !== -1) {
            try {
                parsed = JSON.parse(raw.slice(s, e + 1));
            } catch {
                /* leave as PARSE_FAILED */
            }
        }

        console.log(`\n=== ${c.name} ===`);
        console.log("raw   :", raw.replace(/\s+/g, " ").trim().slice(0, 300));
        console.log("parsed:", JSON.stringify(parsed));
    }
}

main().then(() => process.exit(0));
