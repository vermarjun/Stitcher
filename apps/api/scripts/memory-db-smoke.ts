/**
 * End-to-end smoke test for the memory service against MongoDB.
 *
 * SAFE: creates a single throwaway user, exercises the full memory loop on it,
 * then deletes it in a finally block. Never touches existing users.
 *
 * Run: npx tsx scripts/memory-db-smoke.ts
 */

import mongoose from "mongoose";
import { config } from "../src/config";
import User from "../src/model/user.model";
import { recall, learn, forget, reflect, getMemory } from "../src/services/memoryService";

async function main() {
    await mongoose.connect(config.MONGODB_URL);
    console.log("connected to Mongo");

    const stamp = Date.now();
    const user = await User.create({
        username: `memory_smoke_${stamp}`,
        email: `memory_smoke_${stamp}@local.test`,
        isTestAccount: true,
    });
    const userId = (user._id as mongoose.Types.ObjectId).toString();
    console.log("created throwaway user:", userId);

    try {
        // 1. recall on empty memory
        console.log("\n[1] recall (empty):", JSON.stringify(await recall(userId)));

        // 2. manual learn
        await learn(userId, "prefers minimal on-screen text");
        console.log("[2] after learn:", JSON.stringify(await getMemory(userId)));

        // 3. reflect on a durable-preference turn
        const actions = await reflect(userId, {
            userMessage: "Please use a white background and keep the animations slow, I teach middle-school kids.",
        });
        console.log("\n[3] reflect actions:", JSON.stringify(actions));
        const afterReflect = await getMemory(userId);
        console.log("    memory now:", JSON.stringify(afterReflect, null, 2));

        // 4. recall formatted (what gets injected into prompts)
        console.log("\n[4] recall (formatted for prompt):\n" + (await recall(userId)));

        // 5. forget the first point
        if (afterReflect[0]) {
            await forget(userId, afterReflect[0].id);
            console.log("\n[5] after forget first:", JSON.stringify(await getMemory(userId)));
        }
    } finally {
        await User.deleteOne({ _id: userId });
        console.log("\ncleaned up throwaway user");
        await mongoose.disconnect();
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("smoke failed:", err);
        process.exit(1);
    });
