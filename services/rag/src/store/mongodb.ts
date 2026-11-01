import type { Collection, Db } from "mongodb";
import { config } from "../config.js";
import { log } from "../logger.js";
import type { CorpusDoc, CorpusDocWithEmbedding, CorpusStats, ScoredDoc } from "../types.js";

// Fields projected back from a vector/text search (everything except `embedding`).
const DOC_PROJECTION = {
  _id: 0,
  id: 1,
  docType: 1,
  embedText: 1,
  title: 1,
  content: 1,
  code: 1,
  signature: 1,
  fullyQualifiedName: 1,
  apisUsed: 1,
  animationTypes: 1,
  category: 1,
  domain: 1,
  level: 1,
  tags: 1,
  complexity: 1,
  quality: 1,
  colorPalette: 1,
  manimVersion: 1,
  source: 1,
  createdAt: 1,
} as const;

function hydrate(d: any): CorpusDoc {
  return {
    id: d.id,
    docType: d.docType ?? "api",
    embedText: d.embedText ?? "",
    title: d.title ?? d.id,
    content: d.content ?? "",
    code: d.code ?? "",
    signature: d.signature,
    fullyQualifiedName: d.fullyQualifiedName,
    apisUsed: d.apisUsed ?? [],
    animationTypes: d.animationTypes ?? [],
    category: d.category ?? "general",
    domain: d.domain ?? "general",
    level: d.level,
    tags: d.tags ?? [],
    complexity: d.complexity ?? "intermediate",
    quality: d.quality ?? 4,
    colorPalette: d.colorPalette ?? [],
    manimVersion: d.manimVersion ?? "0.19.0",
    source: d.source ?? "unknown",
    createdAt: d.createdAt,
  };
}

export class CorpusStore {
  private coll: Collection;

  constructor(private db: Db) {
    this.coll = db.collection(config.COLLECTION_NAME);
  }

  // ─── Writes ──────────────────────────────────────────────────────────────

  async upsert(doc: CorpusDocWithEmbedding): Promise<void> {
    await this.coll.replaceOne({ id: doc.id }, doc, { upsert: true });
  }

  async bulkUpsert(docs: CorpusDocWithEmbedding[]): Promise<number> {
    if (docs.length === 0) return 0;
    const ops = docs.map((doc) => ({
      replaceOne: { filter: { id: doc.id }, replacement: doc, upsert: true },
    }));
    const res = await this.coll.bulkWrite(ops, { ordered: false });
    return (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0) + (res.insertedCount ?? 0);
  }

  async existingIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const docs = await this.coll
      .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1 } })
      .toArray();
    return new Set(docs.map((d) => d.id as string));
  }

  async deleteById(id: string): Promise<boolean> {
    const res = await this.coll.deleteOne({ id });
    return (res.deletedCount ?? 0) > 0;
  }

  async deleteAll(): Promise<number> {
    const res = await this.coll.deleteMany({});
    return res.deletedCount ?? 0;
  }

  // ─── Reads ───────────────────────────────────────────────────────────────

  async count(): Promise<number> {
    return this.coll.countDocuments();
  }

  async stats(): Promise<CorpusStats> {
    const facet = await this.coll
      .aggregate([
        {
          $facet: {
            total: [{ $count: "n" }],
            byDocType: [{ $group: { _id: "$docType", n: { $sum: 1 } } }],
            byCategory: [{ $group: { _id: "$category", n: { $sum: 1 } } }],
            byDomain: [{ $group: { _id: "$domain", n: { $sum: 1 } } }],
          },
        },
      ])
      .toArray();
    const f = facet[0] ?? {};
    const toMap = (arr: any[]): Record<string, number> =>
      Object.fromEntries((arr ?? []).map((x) => [x._id ?? "unknown", x.n]));
    return {
      total: f.total?.[0]?.n ?? 0,
      byDocType: toMap(f.byDocType),
      byCategory: toMap(f.byCategory),
      byDomain: toMap(f.byDomain),
    };
  }

  async vectorSearch(
    queryVector: number[],
    limit: number,
    numCandidates: number
  ): Promise<ScoredDoc[]> {
    const pipeline = [
      {
        $vectorSearch: {
          index: config.VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector,
          numCandidates,
          limit,
        },
      },
      { $project: { ...DOC_PROJECTION, score: { $meta: "vectorSearchScore" } } },
    ];
    const docs = await this.coll.aggregate(pipeline).toArray();
    return docs.map((d) => ({ doc: hydrate(d), similarity: d.score ?? 0 }));
  }

  async textSearch(query: string, limit: number): Promise<ScoredDoc[]> {
    const pipeline = [
      {
        $search: {
          index: config.TEXT_INDEX_NAME,
          text: {
            query,
            path: ["title", "content", "code", "apisUsed", "tags"],
          },
        },
      },
      { $limit: limit },
      { $project: { ...DOC_PROJECTION, score: { $meta: "searchScore" } } },
    ];
    const docs = await this.coll.aggregate(pipeline).toArray();
    return docs.map((d) => ({ doc: hydrate(d), similarity: 0, sparseScore: d.score ?? 0 }));
  }

  // ─── Index management ──────────────────────────────────────────────────────

  private async listSearchIndexes(): Promise<any[]> {
    try {
      return await this.coll.listSearchIndexes().toArray();
    } catch (err: any) {
      if (err.code === 26) return [];
      throw err;
    }
  }

  /** Drop the vector + text search indexes if they exist (used by --reset). */
  async dropSearchIndexes(): Promise<void> {
    const existing = await this.listSearchIndexes();
    for (const idx of existing) {
      if (idx.name === config.VECTOR_INDEX_NAME || idx.name === config.TEXT_INDEX_NAME) {
        try {
          await this.coll.dropSearchIndex(idx.name);
          log.info({ index: idx.name }, "Dropped Atlas search index");
        } catch (err) {
          log.warn({ index: idx.name, err: String(err) }, "Failed to drop search index");
        }
      }
    }
  }

  async createVectorIndex(): Promise<void> {
    const existing = await this.listSearchIndexes();
    const vectorIndex = existing.find((i) => i.name === config.VECTOR_INDEX_NAME);
    if (vectorIndex) {
      const dimension = vectorIndex.latestDefinition?.fields?.find((f: any) => f.path === "embedding")?.numDimensions;
      if (dimension !== undefined && dimension !== config.EMBEDDING_DIM) throw new Error(`Vector index has ${dimension} dimensions; configured ${config.EMBEDDING_DIM}. Re-seed with --reset.`);
      log.info({ index: config.VECTOR_INDEX_NAME }, "Vector index already exists");
      return;
    }
    await this.coll.createSearchIndex({
      name: config.VECTOR_INDEX_NAME,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: config.EMBEDDING_DIM,
            similarity: "cosine",
          },
          { type: "filter", path: "docType" },
          { type: "filter", path: "category" },
          { type: "filter", path: "domain" },
          { type: "filter", path: "complexity" },
        ],
      },
    });
    log.info(
      { index: config.VECTOR_INDEX_NAME, dim: config.EMBEDDING_DIM },
      "Created Atlas Vector Search index"
    );
  }

  async createTextIndex(): Promise<void> {
    const existing = await this.listSearchIndexes();
    if (existing.some((i) => i.name === config.TEXT_INDEX_NAME)) {
      log.info({ index: config.TEXT_INDEX_NAME }, "Text index already exists");
      return;
    }
    await this.coll.createSearchIndex({
      name: config.TEXT_INDEX_NAME,
      type: "search",
      definition: { mappings: { dynamic: true } },
    });
    log.info({ index: config.TEXT_INDEX_NAME }, "Created Atlas Search (BM25) index");
  }

  /** Poll until the named search index reports queryable/READY (or timeout). */
  async waitForIndexReady(name: string, timeoutMs = 180_000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idxs = await this.listSearchIndexes();
      const idx = idxs.find((i) => i.name === name);
      const ready =
        idx?.queryable === true;
      if (idx?.status === "FAILED") throw new Error(`Search index ${name} failed: ${JSON.stringify(idx.statusDetail ?? [])}`);
      if (ready) {
        log.info({ index: name, ms: Date.now() - start }, "Search index is READY");
        return true;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    log.warn({ index: name, timeoutMs }, "Timed out waiting for search index to become READY");
    throw new Error(`Search index ${name} was not queryable after ${timeoutMs}ms`);
  }

  async ensureIndexes(): Promise<void> {
    await this.coll.createIndex({ id: 1 }, { unique: true });
    await this.createVectorIndex();
    if (config.STAGE_SPARSE) await this.createTextIndex();
    await this.waitForIndexReady(config.VECTOR_INDEX_NAME);
    if (config.STAGE_SPARSE) await this.waitForIndexReady(config.TEXT_INDEX_NAME);
  }
}

export function createCorpusStore(db: Db): CorpusStore {
  return new CorpusStore(db);
}
