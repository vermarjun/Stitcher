import { describe, expect, it, vi } from "vitest";
import { CorpusStore } from "../src/store/mongodb.js";
import { config } from "../src/config.js";

function store(indexes: unknown[]) {
  const coll = { listSearchIndexes: vi.fn(() => ({ toArray: async () => indexes })), createSearchIndex: vi.fn(), createIndex: vi.fn() };
  return { coll, store: new CorpusStore({ collection: () => coll } as any) };
}
describe("search indexes", () => {
  it("skips an existing matching index and requires queryable", async () => {
    const { store: s, coll } = store([{ name: config.VECTOR_INDEX_NAME, queryable: true, latestDefinition: { fields: [{ path: "embedding", numDimensions: config.EMBEDDING_DIM }] } }]);
    await s.ensureIndexes();
    expect(coll.createSearchIndex).not.toHaveBeenCalled();
    expect(coll.createIndex).toHaveBeenCalledWith({ id: 1 }, { unique: true });
  });
  it("rejects an index with the wrong dimensions", async () => {
    const { store: s } = store([{ name: config.VECTOR_INDEX_NAME, latestDefinition: { fields: [{ path: "embedding", numDimensions: 1 }] } }]);
    await expect(s.createVectorIndex()).rejects.toThrow("Re-seed");
  });
  it("fails instead of silently succeeding when readiness times out", async () => {
    const { store: s } = store([]);
    await expect(s.waitForIndexReady("missing", 0)).rejects.toThrow("not queryable");
  });
  it("reports failed index builds", async () => {
    const { store: s } = store([{ name: "broken", status: "FAILED" }]);
    await expect(s.waitForIndexReady("broken")).rejects.toThrow("failed");
  });
});
