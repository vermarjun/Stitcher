import knowledge from "../../data/manim_knowledge.json";

interface KnowledgeEntry {
  id: string;
  apis?: string[];
  domains?: string[];
  text: string;
}
interface KnowledgeFile {
  pitfalls: KnowledgeEntry[];
  style: KnowledgeEntry[];
  general: { pitfalls: string[]; style: string[] };
}

function kb(): KnowledgeFile {
  return knowledge as KnowledgeFile;
}

function matches(entry: KnowledgeEntry, apiSet: Set<string>, domain: string): boolean {
  const apiHit =
    entry.apis?.some((a) => {
      const la = a.toLowerCase();
      for (const have of apiSet) if (have.includes(la) || la.includes(have)) return true;
      return false;
    }) ?? false;
  const domainHit = entry.domains?.includes(domain) ?? false;
  return apiHit || domainHit;
}

function lowerSet(apis: string[]): Set<string> {
  return new Set(apis.map((a) => a.toLowerCase()));
}

/** Pitfalls relevant to the detected APIs/domain, plus a few general ones. */
export function selectPitfalls(apis: string[], domain: string, max = 6): string[] {
  const k = kb();
  const apiSet = lowerSet(apis);
  const matched = k.pitfalls.filter((e) => matches(e, apiSet, domain)).map((e) => e.text);
  const out = [...matched];
  for (const g of k.general.pitfalls) {
    if (out.length >= max) break;
    if (!out.includes(g)) out.push(g);
  }
  return out.slice(0, max);
}

/** Style recommendations relevant to the detected APIs/domain, plus observed palettes. */
export function selectStyle(
  apis: string[],
  domain: string,
  observedColors: string[],
  max = 6
): string[] {
  const k = kb();
  const apiSet = lowerSet(apis);
  const out: string[] = [];
  if (observedColors.length > 0) {
    out.push(`Reuse the palette seen in similar scenes: ${observedColors.slice(0, 6).join(", ")}.`);
  }
  for (const e of k.style) {
    if (matches(e, apiSet, domain)) out.push(e.text);
  }
  for (const g of k.general.style) {
    if (out.length >= max) break;
    if (!out.includes(g)) out.push(g);
  }
  return out.slice(0, max);
}
