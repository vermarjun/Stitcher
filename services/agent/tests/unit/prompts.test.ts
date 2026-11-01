process.env["AGENT_API_KEY"] = "test-key-for-unit-tests";
import { getPrompt } from "../../src/prompts/registry";

describe("prompt registry", () => {
  it.each(["planner", "coder", "coder_voiceover", "debugger", "refiner"] as const)("loads the %s prompt", (role) => {
    expect(getPrompt(role).systemPrompt.length).toBeGreaterThan(100);
  });
});
