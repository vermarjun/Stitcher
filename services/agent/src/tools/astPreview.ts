/**
 * astPreview — structural analysis of Python code without executing it.
 *
 * Shells out to a tiny Python helper that runs ast.parse and returns:
 *   - top-level class names
 *   - top-level import names
 *   - functions defined at module level
 *   - any SyntaxError with line number
 */

import { spawn } from "child_process";
import { tool } from "@langchain/core/tools";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("astPreview");

const HELPER_SCRIPT = `
import ast, json, sys

code = sys.stdin.read()
try:
    tree = ast.parse(code)
except SyntaxError as e:
    print(json.dumps({"error": f"SyntaxError at line {e.lineno}: {e.msg}"}))
    sys.exit(0)

classes = [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef) and n.col_offset == 0]
imports = []
for n in ast.walk(tree):
    if isinstance(n, ast.Import):
        imports += [a.name for a in n.names]
    elif isinstance(n, ast.ImportFrom):
        imports.append(n.module or "")
functions = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.col_offset == 0]
print(json.dumps({"classes": classes, "imports": imports, "functions": functions, "error": None}))
`;

export async function astPreviewImpl(code: string): Promise<{
  classes: string[];
  imports: string[];
  functions: string[];
  error: string | null;
}> {
  return new Promise((resolve) => {
    const proc = spawn(config.pythonPath, ["-c", HELPER_SCRIPT], { timeout: 5000 });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", (err) => {
      log.warn({ err: err.message }, "astPreview spawn error");
      resolve({ classes: [], imports: [], functions: [], error: err.message });
    });
    proc.on("close", () => {
      try {
        resolve(JSON.parse(stdout.trim()) as ReturnType<typeof astPreviewImpl> extends Promise<infer T> ? T : never);
      } catch {
        resolve({ classes: [], imports: [], functions: [], error: stderr || "parse error" });
      }
    });

    proc.stdin.write(code);
    proc.stdin.end();
  });
}

// JSON Schema instead of zod: zod 3.25 + @langchain/core 0.3.80 make tsc blow up (TS2589, multi-GB heap).
export const astPreviewTool = tool(
  async (input): Promise<string> => {
    const { code } = input as { code: string };
    const result = await astPreviewImpl(code);
    return JSON.stringify(result);
  },
  {
    name: "ast_preview",
    description:
      "Analyse Python code structure without executing it. " +
      "Returns top-level class names, imports, and functions. " +
      "Use during code drafting to verify the Scene class name and imports are correct.",
    schema: {
      type: "object",
      properties: { code: { type: "string", description: "Python source code to analyse" } },
      required: ["code"],
    } as const,
  }
);
