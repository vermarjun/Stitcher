/**
 * webSearch — optional topic grounding for the planner agent.
 *
 * Off by default (ENABLE_WEB_SEARCH=false). When enabled, backed by Tavily,
 * Serper, or Brave. Rate-limited to WEB_SEARCH_MAX_CALLS_PER_JOB per job.
 *
 * Useful for niche topics where the model's knowledge may be incomplete:
 * algorithm proofs, domain-specific math, obscure CS concepts.
 */

import { tool } from "@langchain/core/tools";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("webSearch");

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function tavilySearch(query: string, maxResults: number): Promise<SearchResult[]> {
  if (!config.tavilyApiKey) throw new Error("TAVILY_API_KEY not set");
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.tavilyApiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
    }),
  });
  if (!resp.ok) throw new Error(`Tavily HTTP ${resp.status}`);
  const data = (await resp.json()) as { results: Array<{ title: string; url: string; content: string }> };
  return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
}

async function serperSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  if (!config.serperApiKey) throw new Error("SERPER_API_KEY not set");
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": config.serperApiKey },
    body: JSON.stringify({ q: query, num: maxResults }),
  });
  if (!resp.ok) throw new Error(`Serper HTTP ${resp.status}`);
  const data = (await resp.json()) as { organic: Array<{ title: string; link: string; snippet: string }> };
  return (data.organic ?? []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }));
}

async function braveSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  if (!config.braveApiKey) throw new Error("BRAVE_API_KEY not set");
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
  const resp = await fetch(url, {
    headers: { "Accept": "application/json", "X-Subscription-Token": config.braveApiKey },
  });
  if (!resp.ok) throw new Error(`Brave HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    web?: { results: Array<{ title: string; url: string; description: string }> };
  };
  return (data.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.description }));
}

export async function webSearchImpl(query: string, maxResults = 5): Promise<SearchResult[]> {
  if (!config.enableWebSearch) return [];
  try {
    switch (config.webSearchProvider) {
      case "tavily":
        return await tavilySearch(query, maxResults);
      case "serper":
        return await serperSearch(query, maxResults);
      case "brave":
        return await braveSearch(query, maxResults);
    }
  } catch (err) {
    log.warn({ query, err }, "Web search failed");
    return [];
  }
}

// Per-job call counter — enforces WEB_SEARCH_MAX_CALLS_PER_JOB
const jobSearchCounts = new Map<string, number>();

// JSON Schema instead of zod: zod 3.25 + @langchain/core 0.3.80 make tsc blow up (TS2589, multi-GB heap).
export function createWebSearchTool(jobId: string) {
  return tool(
    async (input): Promise<string> => {
      const { query, maxResults = 5 } = input as { query: string; maxResults?: number };
      const count = jobSearchCounts.get(jobId) ?? 0;
      if (count >= config.webSearchMaxCallsPerJob) {
        log.warn({ jobId, query }, "webSearch: rate limit hit for job");
        return JSON.stringify({ results: [], rateLimited: true });
      }
      jobSearchCounts.set(jobId, count + 1);
      const results = await webSearchImpl(query, maxResults);
      return JSON.stringify({ results, rateLimited: false });
    },
    {
      name: "web_search",
      description:
        "Search the web for factual grounding on niche topics. " +
        "Use for algorithm specifics, domain math, or obscure CS concepts where your knowledge may be incomplete. " +
        "Limited to " + config.webSearchMaxCallsPerJob + " calls per job. Returns { results: [{title, url, snippet}] }.",
      schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          maxResults: { type: "number", description: "Max results to return (default 5)" },
        },
        required: ["query"],
      } as const,
    }
  );
}

export function clearJobSearchCount(jobId: string): void {
  jobSearchCounts.delete(jobId);
}
