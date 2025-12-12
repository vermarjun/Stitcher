import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createPatch } from "diff";

export const diffTool = tool(
  async ({ before, after, filename = "scene.py" }: { before: string; after: string; filename?: string }): Promise<string> => {
    const patch = createPatch(filename, before, after, "before", "after");
    return patch;
  },
  {
    name: "diff",
    description: "Generate a unified diff between two versions of Python code. Use after producing a fix to show what changed.",
    schema: z.object({
      before: z.string().describe("Original (broken) code"),
      after: z.string().describe("Fixed code"),
      filename: z.string().optional().describe("Filename for the diff header (default: scene.py)"),
    }),
  }
);
