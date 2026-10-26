process.env["AGENT_API_KEY"] = "test-key-for-unit-tests";
process.env["MANIM_API_INDEX_PATH"] = require("path").join(
  __dirname,
  "../../src/assets/manim_api_index.json"
);

import { checkSymbolsSync } from "../../src/tools/manimApiCheck";

describe("manimApiCheck", () => {
  it("returns valid=true for known symbols", () => {
    const result = checkSymbolsSync(["Scene", "MathTex", "Text"]);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("returns missing symbols for typos", () => {
    const result = checkSymbolsSync(["Scene", "Squaer", "MathTexX"]);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("Squaer");
  });

  it("handles empty input", () => {
    const result = checkSymbolsSync([]);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});
