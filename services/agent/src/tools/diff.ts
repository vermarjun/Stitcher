import { tool } from "@langchain/core/tools";
import { createPatch } from "diff";

// JSON Schema instead of zod: zod 3.25 + @langchain/core 0.3.80 make tsc blow up (TS2589, multi-GB heap).
export const diffTool = tool(
  async (input): Promise<string> => {
    const { before, after, filename = "scene.py" } = input as { before: string; after: string; filename?: string };
    const patch = createPatch(filename, before, after, "before", "after");
    return patch;
  },
  {
    name: "diff",
    description: "Generate a unified diff between two versions of Python code. Use after producing a fix to show what changed.",
    schema: {
      type: "object",
      properties: {
        before: { type: "string", description: "Original (broken) code" },
        after: { type: "string", description: "Fixed code" },
        filename: { type: "string", description: "Filename for the diff header (default: scene.py)" },
      },
      required: ["before", "after"],
    } as const,
  }
);
