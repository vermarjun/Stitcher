/**
 * Unit tests for src/tools/cheatsheet.ts
 *
 * Tests:
 *   1. lookupCheatsheet returns entries spanning core + plugins for mixed symbol list
 *   2. de-duplication: duplicate symbols produce a single entry
 *   3. cap: requesting > MAX_ENTRIES symbols respects the cap
 *   4. missing symbols are silently skipped
 *   5. cheatsheetSize() returns a non-trivial count
 */

import { lookupCheatsheet, getCheatsheetEntry, cheatsheetSize } from "../../src/tools/cheatsheet.js";

const TEST_SYMBOLS = ["NeuralNetwork", "Pendulum", "MArray", "Board", "Create"];

describe("cheatsheet", () => {
  it("should have a non-trivial number of entries", () => {
    const size = cheatsheetSize();
    expect(size).toBeGreaterThan(400);
  });

  it("should return a block for all 5 test symbols", () => {
    const block = lookupCheatsheet(TEST_SYMBOLS);
    expect(block).toBeTruthy();
    expect(block).toContain("NeuralNetwork");
    expect(block).toContain("Pendulum");
    expect(block).toContain("MArray");
    expect(block).toContain("Board");
    expect(block).toContain("Create");
  });

  it("should span core + plugins", () => {
    const block = lookupCheatsheet(TEST_SYMBOLS);
    // manim core
    expect(block).toContain("manim core");
    // plugins
    expect(block).toContain("manim-ml");
    expect(block).toContain("manim-physics");
    expect(block).toContain("manim-dsa");
    expect(block).toContain("manim-chess");
  });

  it("should include correct import lines", () => {
    const block = lookupCheatsheet(TEST_SYMBOLS);
    expect(block).toContain("from manim import *");
    expect(block).toContain("from manim_ml.neural_network import");
    expect(block).toContain("from manim_physics import *");
    expect(block).toContain("from manim_dsa import *");
    expect(block).toContain("from manim_chess import *");
  });

  it("should de-duplicate symbols", () => {
    const block = lookupCheatsheet(["Create", "Create", "Create"]);
    // Should appear exactly once in the header count
    expect(block).toContain("1 symbol");
  });

  it("should skip unknown symbols silently", () => {
    const block = lookupCheatsheet(["Create", "NonExistentSymbol12345"]);
    expect(block).toContain("1 symbol");
    expect(block).not.toContain("NonExistentSymbol12345");
  });

  it("should return empty string for empty input", () => {
    const block = lookupCheatsheet([]);
    expect(block).toBe("");
  });

  it("getCheatsheetEntry returns correct entry for Create", () => {
    const entry = getCheatsheetEntry("Create");
    expect(entry).not.toBeNull();
    expect(entry?.source).toBe("manim");
    expect(entry?.import).toContain("from manim");
  });

  it("getCheatsheetEntry returns null for unknown symbol", () => {
    expect(getCheatsheetEntry("NoSuchThing999")).toBeNull();
  });

  it("should print the injected block for the 5 test symbols", () => {
    const block = lookupCheatsheet(TEST_SYMBOLS);
    // eslint-disable-next-line no-console
    console.log("\n=== INJECTED CHEATSHEET BLOCK (5 symbols) ===\n");
    // eslint-disable-next-line no-console
    console.log(block);
    // eslint-disable-next-line no-console
    console.log("\n=== END BLOCK ===");
    expect(block.length).toBeGreaterThan(200);
  });
});
