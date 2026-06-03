import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import {
  Code2, Bug, Search, Layers, Mic2,
  Save, RefreshCw, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, KeyRound, Clock, Leaf,
  Server, Copy, Check, Zap, LogIn, ExternalLink, RefreshCcw,
  Play, Timer, Cpu, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import type { ProviderFallbackConfig } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type ServiceKey = 'coder' | 'debugger' | 'query_transform' | 'embedder' | 'tts';
type Tier = 'free' | 'plus' | 'master';

interface ServiceConfigDoc {
  service: ServiceKey;
  tier: Tier;
  provider: string;
  maskedKey: string;
  hasKey: boolean;
  baseURL: string | null;
  model: string | null;
  params: Record<string, unknown>;
  enabled: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
  /** Optional fallback provider, used when the primary fails. */
  fallback?: ProviderFallbackConfig;
}
type ProvidersResponse = Record<ServiceKey, Record<Tier, ServiceConfigDoc>>;

interface TierFormState {
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
  paramsJson: string;
  enabled: boolean;
  fallback: FallbackFormState;
}

interface FallbackFormState {
  enabled: boolean;
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
  paramsJson: string;
}

interface GatewayProviderStatus {
  provider: string;
  baseURL: string;
  configured: boolean;
  maskedToken: string | null;
  hasRefreshToken: boolean;
  hasAccountId: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  models: string[];
}
interface GatewayStatusResponse {
  providers: GatewayProviderStatus[];
  internalKeySet: boolean;
  proxyBase: string;
}

// ── Provider + model catalogue ─────────────────────────────────────────────────

const LLM_PROVIDERS = ['opencodego', 'codex', 'openai', 'anthropic', 'gemini', 'ollama', 'azure'];
const EMBEDDER_PROVIDERS = ['ollama', 'openai', 'azure'];
const TTS_PROVIDERS = ['gtts', 'azure'];

const PROVIDER_MODELS: Record<string, string[]> = {
  'opencodego': [
    'glm-5.1', 'glm-5',
    'kimi-k2.5', 'kimi-k2.6',
    'deepseek-v4-flash', 'deepseek-v4-pro',
    'mimo-v2-omni', 'mimo-v2-pro', 'mimo-v2.5', 'mimo-v2.5-pro',
    'minimax-m2.5', 'minimax-m2.7',
    'qwen3.5-plus', 'qwen3.6-plus',
  ],
  'codex': [
    'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex',
  ],
  'openai': [
    'gpt-4o', 'gpt-4o-mini',
    'gpt-4.1', 'gpt-4.1-mini',
    'gpt-4-turbo', 'gpt-4',
    'o1-preview', 'o1-mini', 'o3', 'o3-mini', 'o4-mini',
  ],
  'anthropic': [
    'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
    'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307',
  ],
  'gemini': [
    'gemini-2.5-pro', 'gemini-2.5-flash',
    'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash',
  ],
  'ollama': [],
  'azure': [],
};

const PROVIDER_DEFAULT_BASE_URL: Record<string, string> = {
  'opencodego': 'https://opencode.ai/zen/go/v1',
  'codex': 'http://api:3000/api/gateway/proxy/codex/v1',
  'openai': 'https://api.openai.com/v1',
  'anthropic': '',
  'gemini': '',
  'ollama': 'http://host.docker.internal:11434/v1',
  'azure': '',
};

// Per-model param presets — auto-applied when a model is selected.
//
// Verified empirically on opencode-go 2026-06-03 (see CODEGEN_PLUGIN_ROOTCAUSE.md §10).
// KEY FINDING: the thinking-disable flag is NOT the same across model families and the
// gateway does NOT normalise it. Sending the wrong flag (or several at once) either
// leaves thinking ON (slow → query_transform 12s timeouts) or 400s the request:
//   • deepseek / kimi / qwen / mimo  → thinking: { type: "disabled" }   (0 reasoning tokens)
//   • glm-5.1 / glm-5 / minimax-m2.7 → reasoning: { enabled: false }    (0 reasoning tokens)
//   • kimi   → 400s on enable_thinking / reasoning flags (only thinking:{type:disabled} works)
//   • qwen   → reasoning:{enabled:false} times out (use thinking:{type:disabled})
//   • minimax-m2.5 → cannot be fully disabled (~226 reasoning tokens on every flag) — avoid for latency-critical
//
//   params  = sensible default for the coder/debugger services.
//   noThink = VERIFIED fully-thinking-disabled set — auto-applied for the latency-critical
//             query_transform service so it never hangs/times out (deepseek-v4-flash ≈ 2.4s, 0 reasoning).
const TD = { type: 'disabled' };  // thinking-disable knob — deepseek/kimi/qwen/mimo
const RD = { enabled: false };    // reasoning-disable knob — glm / minimax-m2.7
const MODEL_PARAM_PRESETS: Record<string, { params: Record<string, unknown>; noThink?: Record<string, unknown>; note?: string }> = {
  // OpenCode Go — glm/kimi populate `content` even with thinking on, so coder may keep it on.
  'glm-5.1':   { params: { temperature: 0.6, max_tokens: 16000, enable_thinking: true, thinking_budget: 10000 }, noThink: { temperature: 0.2, max_tokens: 2048, reasoning: RD }, note: '✓ thinking ok for coder. Disable with reasoning:{enabled:false} (verified 0 reasoning, ~3s) — NOT thinking:{type:disabled} (glm only partly honors that).' },
  'glm-5':     { params: { temperature: 0.6, max_tokens: 16000, enable_thinking: true, thinking_budget: 10000 }, noThink: { temperature: 0.2, max_tokens: 2048, reasoning: RD }, note: '✓ thinking ok for coder. Disable with reasoning:{enabled:false} (verified).' },
  'kimi-k2.5': { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: 'Disable with thinking:{type:disabled} (verified). NOTE: kimi 400s on enable_thinking / reasoning flags.' },
  'kimi-k2.6': { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: 'Disable with thinking:{type:disabled} (verified). NOTE: kimi 400s on enable_thinking / reasoning flags.' },
  // OpenCode Go — deepseek/mimo/minimax/qwen route thinking to the `reasoning` field.
  // MUST disable with thinking:{type:disabled}; enable_thinking:false leaves thinking ON (slow).
  'deepseek-v4-flash': { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: '★ best query_transform model — thinking:{type:disabled} → 0 reasoning, ~2.4s, valid JSON, holds at concurrency 12. (enable_thinking:false does NOT fully disable it → 26s.)' },
  'deepseek-v4-pro':   { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: 'thinking:{type:disabled} → 0 reasoning, ~3.5s (verified). enable_thinking:false does NOT fully disable it.' },
  'mimo-v2-omni':  { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: 'Disable with thinking:{type:disabled} (verified 0 reasoning).' },
  'mimo-v2-pro':   { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: 'Disable with thinking:{type:disabled} (verified).' },
  'mimo-v2.5':     { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: 'Disable with thinking:{type:disabled} (verified).' },
  'mimo-v2.5-pro': { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: 'Disable with thinking:{type:disabled} (verified).' },
  'minimax-m2.7':  { params: { temperature: 0.2, max_tokens: 8000, reasoning: RD }, noThink: { temperature: 0.2, max_tokens: 2048, reasoning: RD }, note: 'Disable with reasoning:{enabled:false} (verified 0 reasoning, ~2.8s).' },
  'minimax-m2.5':  { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: '⚠ cannot fully disable thinking (~226 reasoning tokens remain on every flag) — avoid for latency-critical query_transform.' },
  'qwen3.5-plus':  { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: 'Disable with thinking:{type:disabled} (verified 0 reasoning). reasoning:{enabled:false} times out on qwen.' },
  'qwen3.6-plus':  { params: { temperature: 0.2, max_tokens: 8000, thinking: TD }, noThink: { temperature: 0.2, max_tokens: 2048, thinking: TD }, note: 'Disable with thinking:{type:disabled} (verified 0 reasoning). reasoning:{enabled:false} times out on qwen.' },
  // Codex Plus plan models — reasoning_effort controls depth; lower = faster/cheaper.
  'gpt-5.5':       { params: { max_tokens: 8000, reasoning_effort: 'medium' }, noThink: { max_tokens: 2048, reasoning_effort: 'low' }, note: '✓ reasoning low|medium|high. query_transform uses reasoning_effort:low.' },
  'gpt-5.4':       { params: { max_tokens: 8000, reasoning_effort: 'medium' }, noThink: { max_tokens: 2048, reasoning_effort: 'low' }, note: '✓ reasoning low|medium|high.' },
  'gpt-5.4-mini':  { params: { max_tokens: 8000 }, noThink: { max_tokens: 2048 }, note: 'omit reasoning_effort for fastest response.' },
  'gpt-5.3-codex': { params: { max_tokens: 8000, reasoning_effort: 'medium' }, noThink: { max_tokens: 2048, reasoning_effort: 'low' }, note: '✓ reasoning low|medium|high.' },
};

const PROVIDER_DEFAULT_PARAMS: Record<string, Record<string, unknown>> = {
  'opencodego': { temperature: 0.2, max_tokens: 8000, enable_thinking: false },
  'codex':       { reasoning_effort: 'medium' },
  'openai':      { temperature: 0.2, max_tokens: 8000 },
  'anthropic':   { temperature: 0.2, max_tokens: 8000 },
  'gemini':      { temperature: 0.2, maxOutputTokens: 8000 },
  'ollama':      { temperature: 0.2 },
  'azure':       { temperature: 0.2 },
  'gtts':        { voice: 'en-us' },
};

// Service-aware default params for a model. The query_transform stage is
// latency-critical (a slow/thinking transform times out → no plugins → raw Manim),
// so it gets the VERIFIED thinking-disabled (`noThink`) preset; coder/debugger get
// the default preset (thinking allowed where the model supports it in `content`).
function presetParamsFor(model: string, serviceKey: ServiceKey): Record<string, unknown> | undefined {
  const preset = MODEL_PARAM_PRESETS[model];
  if (!preset) return undefined;
  return serviceKey === 'query_transform' && preset.noThink ? preset.noThink : preset.params;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TIERS: Tier[] = ['free', 'plus', 'master'];
const TIER_COLORS: Record<Tier, string> = {
  free: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  plus: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  master: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

interface ServiceMeta {
  key: ServiceKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  kind: 'llm' | 'embedder' | 'tts';
  providers: string[];
  note?: string;
  paramsHint: string;
}

const SERVICES: ServiceMeta[] = [
  {
    key: 'coder', label: 'Code Generator',
    description: 'LLM used in the agent /code stage to write Manim scenes.',
    icon: Code2, kind: 'llm', providers: LLM_PROVIDERS,
    paramsHint: 'Disable thinking → deepseek/kimi/qwen/mimo: {"thinking":{"type":"disabled"}} · glm/minimax-m2.7: {"reasoning":{"enabled":false}} · codex: reasoning_effort:low. Plus temperature, max_tokens (or maxTokens), top_p. Picking a model auto-fills the verified preset.',
  },
  {
    key: 'debugger', label: 'Debugger',
    description: 'LLM used in the agent /debug stage to fix render errors.',
    icon: Bug, kind: 'llm', providers: LLM_PROVIDERS,
    paramsHint: 'Disable thinking → deepseek/kimi/qwen/mimo: {"thinking":{"type":"disabled"}} · glm/minimax-m2.7: {"reasoning":{"enabled":false}} · codex: reasoning_effort:low. Plus temperature, max_tokens (or maxTokens), top_p. Picking a model auto-fills the verified preset.',
  },
  {
    key: 'query_transform', label: 'Query Transform',
    description: 'LLM used in the RAG /enhance stage to expand user queries + detect required plugins.',
    icon: Search, kind: 'llm', providers: LLM_PROVIDERS,
    note: 'Latency-critical: if thinking is left on, this stage times out under load → no plugin detection → coder falls back to raw Manim. Picking a model auto-applies the verified thinking-disabled preset. Best: deepseek-v4-flash (~2.4s).',
    paramsHint: 'Disable thinking → deepseek/kimi/qwen/mimo: {"thinking":{"type":"disabled"}} · glm/minimax-m2.7: {"reasoning":{"enabled":false}} · codex: reasoning_effort:low. Plus temperature, max_tokens (or maxTokens), top_p. Picking a model auto-fills the verified preset.',
  },
  {
    key: 'embedder', label: 'Embedder',
    description: 'Embedding model for RAG vector search.',
    icon: Layers, kind: 'embedder', providers: EMBEDDER_PROVIDERS,
    note: 'Changing the model requires a full corpus re-embed (dimensions must match).',
    paramsHint: 'Usually empty: {}',
  },
  {
    key: 'tts', label: 'Voiceover TTS',
    description: 'Text-to-speech engine for voiceover tracks.',
    icon: Mic2, kind: 'tts', providers: TTS_PROVIDERS,
    paramsHint: 'Keys: region (e.g. eastus), voice (e.g. en-US-AvaNeural or en-us for gtts)',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function emptyFallbackForm(provider = ''): FallbackFormState {
  return {
    enabled: false,
    provider,
    apiKey: '',
    baseURL: '',
    model: '',
    paramsJson: '{}',
  };
}

function fallbackToFormState(fb: ProviderFallbackConfig | undefined): FallbackFormState {
  if (!fb) return emptyFallbackForm();
  return {
    enabled: fb.enabled ?? false,
    provider: fb.provider ?? '',
    apiKey: '',
    baseURL: fb.baseURL ?? '',
    model: fb.model ?? '',
    paramsJson: JSON.stringify(fb.params ?? {}, null, 2),
  };
}

function docToFormState(doc: ServiceConfigDoc): TierFormState {
  return {
    provider: doc.provider ?? '',
    apiKey: '',
    baseURL: doc.baseURL ?? '',
    model: doc.model ?? '',
    paramsJson: JSON.stringify(doc.params ?? {}, null, 2),
    enabled: doc.enabled ?? true,
    fallback: fallbackToFormState(doc.fallback),
  };
}

function tryParseJson(str: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(str) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'Must be a JSON object.' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: e instanceof SyntaxError ? e.message : 'Invalid JSON' };
  }
}

function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }); } catch { return dateStr; }
}

// ── ConfigSummary ──────────────────────────────────────────────────────────────

function ConfigSummary({ doc }: { doc: ServiceConfigDoc | undefined }) {
  if (!doc) {
    return (
      <div className="mt-1.5 rounded-md bg-muted/40 border px-3 py-2">
        <span className="text-xs text-muted-foreground italic">No config stored yet.</span>
      </div>
    );
  }
  const isSeeded = doc.updatedBy == null;
  const paramsStr = Object.keys(doc.params ?? {}).length > 0 ? JSON.stringify(doc.params) : '{}';
  return (
    <div className="mt-1.5 rounded-md bg-muted/40 border px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-semibold text-foreground font-mono">{doc.provider || '—'}</span>
        {doc.model && (
          <><span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-mono text-foreground">{doc.model}</span></>
        )}
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${doc.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500'}`}>
          {doc.enabled ? 'enabled' : 'disabled'}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <KeyRound className="h-3 w-3 text-muted-foreground shrink-0" />
        {doc.hasKey
          ? <span className="text-[11px] font-mono text-foreground">{doc.maskedKey}</span>
          : <span className="text-[11px] text-amber-600 dark:text-amber-400">no key set</span>}
      </div>
      {doc.baseURL && (
        <div className="flex items-start gap-1.5">
          <span className="text-[10px] text-muted-foreground w-14 shrink-0">baseURL</span>
          <span className="text-[11px] font-mono text-foreground break-all">{doc.baseURL}</span>
        </div>
      )}
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] text-muted-foreground w-14 shrink-0">params</span>
        <span className="text-[11px] font-mono text-foreground break-all">{paramsStr}</span>
      </div>
      {doc.fallback?.enabled && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground w-14 shrink-0">fallback</span>
          <span className="text-[11px] font-mono text-foreground break-all">
            {doc.fallback.provider || '—'}{doc.fallback.model ? ' / ' + doc.fallback.model : ''}
          </span>
          {doc.fallback.hasKey
            ? <KeyRound className="h-3 w-3 text-muted-foreground shrink-0" />
            : <span className="text-[10px] text-amber-600 dark:text-amber-400">no key</span>}
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-0.5">
        {isSeeded
          ? <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 font-medium"><Leaf className="h-2.5 w-2.5" />seeded from env</span>
          : <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 font-medium"><Clock className="h-2.5 w-2.5" />admin-set</span>}
        {doc.updatedAt && <span className="text-[10px] text-muted-foreground">{relativeTime(doc.updatedAt)}</span>}
      </div>
    </div>
  );
}

// ── JsonParamsEditor ───────────────────────────────────────────────────────────

function JsonParamsEditor({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint: string }) {
  const result = tryParseJson(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs">Params (JSON)</Label>
        {!result.ok && <span className="text-[10px] text-destructive font-mono">{result.error}</span>}
      </div>
      <textarea
        className={`w-full min-h-[100px] rounded-md border px-3 py-2 text-xs font-mono bg-background resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!result.ok ? 'border-destructive ring-1 ring-destructive/50' : 'border-input'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
      />
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

// ── ModelSelector: dropdown of known models + free-text fallback ───────────────

function ModelSelector({ provider, value, onChange, kind, serviceKey, onPresetApply }: {
  provider: string; value: string; onChange: (v: string) => void; kind: ServiceMeta['kind'];
  serviceKey: ServiceKey;
  onPresetApply?: (params: Record<string, unknown>) => void;
}) {
  const knownModels = PROVIDER_MODELS[provider] ?? [];
  const isKnown = knownModels.includes(value);
  const preset = MODEL_PARAM_PRESETS[value];
  const isQT = serviceKey === 'query_transform';

  if (kind === 'tts' || knownModels.length === 0) {
    return (
      <Input className="h-8 text-xs font-mono"
        placeholder={kind === 'embedder' ? 'e.g. bge-m3' : 'e.g. custom-model-id'}
        value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }

  return (
    <div className="space-y-1.5">
      <Select value={isKnown ? value : '__custom__'}
        onValueChange={(v) => {
          if (v === '__custom__') return;
          onChange(v);
          // Auto-apply preset params when model is picked (service-aware: query_transform
          // gets the verified thinking-disabled set so it never times out).
          const ps = presetParamsFor(v, serviceKey);
          if (onPresetApply && ps) onPresetApply(ps);
        }}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select model" /></SelectTrigger>
        <SelectContent>
          {knownModels.map((m) => (
            <SelectItem key={m} value={m} className="text-xs font-mono">
              <span className="flex items-center gap-1.5">
                {m}
                {MODEL_PARAM_PRESETS[m]?.note?.startsWith('✓') && <span className="text-[9px] text-green-600">✓ thinking</span>}
                {MODEL_PARAM_PRESETS[m]?.note?.startsWith('⚠') && <span className="text-[9px] text-amber-600">⚠ no thinking</span>}
              </span>
            </SelectItem>
          ))}
          {!isKnown && value && <SelectItem value="__custom__" className="text-xs">{value} (custom)</SelectItem>}
        </SelectContent>
      </Select>
      <Input className="h-7 text-xs font-mono" placeholder="or type custom model ID…"
        value={isKnown ? '' : value}
        onChange={(e) => { if (e.target.value) { onChange(e.target.value); } }} />
      {/* Show preset note for the currently selected model */}
      {preset?.note && (
        <p className={`text-[10px] ${preset.note.startsWith('⚠') ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
          {preset.note}
        </p>
      )}
      {isQT && preset?.noThink && (
        <p className="text-[10px] text-sky-600 dark:text-sky-400">
          ↯ query_transform: auto-applying the thinking-disabled preset (latency-critical — must not time out).
        </p>
      )}
      {preset && onPresetApply && (
        <button type="button"
          onClick={() => onPresetApply(presetParamsFor(value, serviceKey) ?? preset.params)}
          className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline">
          ↺ Reset params to {value}{isQT && preset.noThink ? ' (thinking off)' : ''} defaults
        </button>
      )}
    </div>
  );
}

// ── TierCell ───────────────────────────────────────────────────────────────────

interface TierCellProps {
  service: ServiceMeta;
  tier: Tier;
  doc: ServiceConfigDoc | undefined;
  onSaved: () => void;
  proxyBase?: string; // gateway proxy base URL for auto-population
}

function TierCell({ service, tier, doc, onSaved, proxyBase }: TierCellProps) {
  const [form, setForm] = useState<TierFormState>(() =>
    doc ? docToFormState(doc) : {
      provider: service.providers[0] ?? '',
      apiKey: '',
      baseURL: '',
      model: '',
      paramsJson: '{}',
      enabled: true,
      fallback: emptyFallbackForm(),
    }
  );
  const [expanded, setExpanded] = useState(false);

  const paramsValid = tryParseJson(form.paramsJson).ok;
  const fallbackParamsValid = tryParseJson(form.fallback.paramsJson).ok;

  // When provider changes, auto-fill baseURL + params if the fields are empty/default
  const handleProviderChange = useCallback((newProvider: string) => {
    setForm((prev) => {
      let newBaseURL = prev.baseURL;
      let newParamsJson = prev.paramsJson;

      // Auto-populate baseURL if it's empty or was auto-set for a previous known provider
      const autoURL = newProvider === 'codex' && proxyBase
        ? `${proxyBase}/${newProvider}/v1`
        : PROVIDER_DEFAULT_BASE_URL[newProvider] ?? '';

      const prevDefault = Object.values(PROVIDER_DEFAULT_BASE_URL).includes(prev.baseURL)
        || (proxyBase && prev.baseURL.startsWith(proxyBase))
        || !prev.baseURL;

      if (prevDefault) newBaseURL = autoURL;

      // Clear model if it's not valid for the new provider (compute first so we can
      // auto-apply the model's service-aware preset below).
      const newModelList = PROVIDER_MODELS[newProvider] ?? [];
      const newModel = newModelList.length > 0 && !newModelList.includes(prev.model)
        ? newModelList[0]
        : prev.model;

      // Auto-populate params if they're empty or were {}/default. Prefer the model's
      // service-aware preset (query_transform → thinking-disabled) over the provider default.
      const prevParamsParsed = tryParseJson(prev.paramsJson);
      const isEmpty = prevParamsParsed.ok && Object.keys(prevParamsParsed.value).length === 0;
      const wasDefault = Object.entries(PROVIDER_DEFAULT_PARAMS).some(
        ([, def]) => JSON.stringify(def) === JSON.stringify(prevParamsParsed.ok ? prevParamsParsed.value : {})
      );
      const modelPreset = presetParamsFor(newModel, service.key);
      if (newProvider === 'codex') {
        // Codex only accepts reasoning_effort — always override params
        newParamsJson = JSON.stringify(
          modelPreset ?? { reasoning_effort: service.key === 'query_transform' ? 'low' : 'medium' }, null, 2);
      } else if (isEmpty || wasDefault) {
        const defaults = modelPreset ?? PROVIDER_DEFAULT_PARAMS[newProvider];
        if (defaults) newParamsJson = JSON.stringify(defaults, null, 2);
      }

      return { ...prev, provider: newProvider, baseURL: newBaseURL, paramsJson: newParamsJson, model: newModel };
    });
  }, [proxyBase, service.key]);

  // Same auto-fill behaviour as handleProviderChange, but for the fallback sub-form.
  const handleFallbackProviderChange = useCallback((newProvider: string) => {
    setForm((prev) => {
      const fb = prev.fallback;
      let newBaseURL = fb.baseURL;
      let newParamsJson = fb.paramsJson;

      // Auto-populate baseURL if it's empty or was auto-set for a previous known provider
      const autoURL = newProvider === 'codex' && proxyBase
        ? `${proxyBase}/${newProvider}/v1`
        : PROVIDER_DEFAULT_BASE_URL[newProvider] ?? '';

      const prevDefault = Object.values(PROVIDER_DEFAULT_BASE_URL).includes(fb.baseURL)
        || (proxyBase && fb.baseURL.startsWith(proxyBase))
        || !fb.baseURL;

      if (prevDefault) newBaseURL = autoURL;

      // Clear model if it's not valid for the new provider (compute first for preset).
      const newModelList = PROVIDER_MODELS[newProvider] ?? [];
      const newModel = newModelList.length > 0 && !newModelList.includes(fb.model)
        ? newModelList[0]
        : fb.model;

      // Auto-populate params if they're empty or were {}/default. Prefer the model's
      // service-aware preset (query_transform → thinking-disabled) over the provider default.
      const prevParamsParsed = tryParseJson(fb.paramsJson);
      const isEmpty = prevParamsParsed.ok && Object.keys(prevParamsParsed.value).length === 0;
      const wasDefault = Object.entries(PROVIDER_DEFAULT_PARAMS).some(
        ([, def]) => JSON.stringify(def) === JSON.stringify(prevParamsParsed.ok ? prevParamsParsed.value : {})
      );
      const modelPreset = presetParamsFor(newModel, service.key);
      if (newProvider === 'codex') {
        // Codex only accepts reasoning_effort — always override params
        newParamsJson = JSON.stringify(
          modelPreset ?? { reasoning_effort: service.key === 'query_transform' ? 'low' : 'medium' }, null, 2);
      } else if (isEmpty || wasDefault) {
        const defaults = modelPreset ?? PROVIDER_DEFAULT_PARAMS[newProvider];
        if (defaults) newParamsJson = JSON.stringify(defaults, null, 2);
      }

      return {
        ...prev,
        fallback: { ...fb, provider: newProvider, baseURL: newBaseURL, paramsJson: newParamsJson, model: newModel },
      };
    });
  }, [proxyBase, service.key]);

  const mutation = useMutation({
    mutationFn: () => {
      const parseResult = tryParseJson(form.paramsJson);
      if (!parseResult.ok) throw new Error('Invalid JSON params: ' + parseResult.error);
      const body: Record<string, unknown> = {
        // 'codex' is a UI convenience label — the agent service factory only
        // understands 'openai' (OpenAI-compat). The gateway at the baseURL handles
        // the Codex-specific translation transparently.
        provider: form.provider === 'codex' ? 'openai' : form.provider,
        enabled: form.enabled,
        params: parseResult.value,
      };
      if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();
      if (form.baseURL.trim()) body.baseURL = form.baseURL.trim();
      if (form.model.trim()) body.model = form.model.trim();

      // Fallback provider (used if the primary fails). Same semantics as primary:
      // blank apiKey preserves the existing encrypted key, so only send it when typed.
      const fb = form.fallback;
      const fbParseResult = tryParseJson(fb.paramsJson);
      if (!fbParseResult.ok) throw new Error('Invalid JSON fallback params: ' + fbParseResult.error);
      const fallback: Record<string, unknown> = {
        enabled: fb.enabled,
        provider: fb.provider === 'codex' ? 'openai' : fb.provider,
        params: fbParseResult.value,
      };
      if (fb.apiKey.trim()) fallback.apiKey = fb.apiKey.trim();
      if (fb.baseURL.trim()) fallback.baseURL = fb.baseURL.trim();
      if (fb.model.trim()) fallback.model = fb.model.trim();
      body.fallback = fallback;

      return api.put(`/admin/providers/${service.key}/${tier}`, body);
    },
    onSuccess: () => {
      toast.success(`Saved ${service.label} / ${tier}`);
      setForm((f) => ({ ...f, apiKey: '', fallback: { ...f.fallback, apiKey: '' } }));
      onSaved();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message
        : (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? `Failed to save ${service.label} / ${tier}`);
    },
  });

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`capitalize text-xs ${TIER_COLORS[tier]}`}>{tier}</Badge>
          {doc && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]" title={`${doc.provider}${doc.model ? ' / ' + doc.model : ''}`}>
              {doc.provider}{doc.model ? ' / ' + doc.model : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={form.enabled}
            onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${form.enabled ? 'bg-primary' : 'bg-input'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${form.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
          <span className="text-xs text-muted-foreground">{form.enabled ? 'on' : 'off'}</span>
        </div>
      </div>

      <ConfigSummary doc={doc} />

      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Collapse editor</> : <><ChevronDown className="h-3.5 w-3.5" /> Edit config</>}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1">
          <Separator />

          {/* Provider */}
          <div className="space-y-1.5">
            <Label className="text-xs">Provider</Label>
            <Select value={service.providers.includes(form.provider) ? form.provider : '__custom__'}
              onValueChange={(v) => { if (v !== '__custom__') handleProviderChange(v); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                {service.providers.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                ))}
                {form.provider && !service.providers.includes(form.provider) && (
                  <SelectItem value="__custom__" className="text-xs">{form.provider} (custom)</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Input className="h-7 text-xs" placeholder="or type custom provider…"
              value={service.providers.includes(form.provider) ? '' : form.provider}
              onChange={(e) => { if (e.target.value) handleProviderChange(e.target.value); }} />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              {form.provider === 'codex' ? 'Session Token / API Key' : 'API Key'}
            </Label>
            <Input type="password" className="h-8 text-xs font-mono"
              placeholder={doc?.hasKey ? `${doc.maskedKey} — leave blank to keep` : 'Enter key / token'}
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              autoComplete="new-password" />
            {form.provider === 'codex' && (
              <p className="text-[10px] text-sky-600 dark:text-sky-400">
                API Key = your GATEWAY_INTERNAL_KEY env var value. Base URL must be http://api:3000/api/gateway/proxy/codex/v1 for the agent service to reach the gateway internally.
              </p>
            )}
            {form.provider === 'opencodego' && (
              <p className="text-[10px] text-sky-600 dark:text-sky-400">
                Your OpenCode Go subscription key (sk-…). Or leave blank to use gateway token.
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">Write-only. Existing key shown masked above. Leave blank to keep.</p>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">Base URL / Endpoint</Label>
            <Input className="h-8 text-xs font-mono" placeholder="Auto-populated — or enter custom"
              value={form.baseURL}
              onChange={(e) => setForm((f) => ({ ...f, baseURL: e.target.value }))} />
            {form.provider === 'codex' && proxyBase && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Use <span className="font-mono">{proxyBase}/codex/v1</span> to route through the gateway (auto-refresh + logging), or <span className="font-mono">https://api.openai.com/v1</span> for direct.
              </p>
            )}
          </div>

          {/* Model */}
          {service.kind !== 'tts' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Model</Label>
              <ModelSelector
                provider={form.provider}
                value={form.model}
                onChange={(v) => setForm((f) => ({ ...f, model: v }))}
                kind={service.kind}
                serviceKey={service.key}
                onPresetApply={(params) => setForm((f) => ({ ...f, paramsJson: JSON.stringify(params, null, 2) }))}
              />
              {service.kind === 'embedder' && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Model change requires corpus re-embed (dimensions must match).
                </p>
              )}
            </div>
          )}

          {/* JSON params */}
          <div className="space-y-1.5">
            <Separator />
            <JsonParamsEditor
              value={form.paramsJson}
              onChange={(val) => setForm((f) => ({ ...f, paramsJson: val }))}
              hint={service.paramsHint}
            />
          </div>

          {/* ── Fallback provider (used if primary fails) ────────────────────── */}
          <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">Fallback (used if primary fails)</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.fallback.enabled}
                  aria-label="Enable fallback"
                  onClick={() => setForm((f) => ({ ...f, fallback: { ...f.fallback, enabled: !f.fallback.enabled } }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${form.fallback.enabled ? 'bg-primary' : 'bg-input'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${form.fallback.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <span className="text-xs text-muted-foreground">{form.fallback.enabled ? 'on' : 'off'}</span>
              </div>
            </div>

            {form.fallback.enabled ? (
              <div className="space-y-3">
                {/* Fallback provider */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Provider</Label>
                  <Select value={service.providers.includes(form.fallback.provider) ? form.fallback.provider : (form.fallback.provider ? '__custom__' : '')}
                    onValueChange={(v) => { if (v !== '__custom__') handleFallbackProviderChange(v); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent>
                      {service.providers.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                      ))}
                      {form.fallback.provider && !service.providers.includes(form.fallback.provider) && (
                        <SelectItem value="__custom__" className="text-xs">{form.fallback.provider} (custom)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Input className="h-7 text-xs" placeholder="or type custom provider…"
                    value={service.providers.includes(form.fallback.provider) ? '' : form.fallback.provider}
                    onChange={(e) => { if (e.target.value) handleFallbackProviderChange(e.target.value); }} />
                </div>

                {/* Fallback API Key */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {form.fallback.provider === 'codex' ? 'Session Token / API Key' : 'API Key'}
                  </Label>
                  <Input type="password" className="h-8 text-xs font-mono"
                    placeholder={doc?.fallback?.hasKey ? `${doc.fallback.maskedKey} — leave blank to keep` : 'Enter key / token'}
                    value={form.fallback.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, fallback: { ...f.fallback, apiKey: e.target.value } }))}
                    autoComplete="new-password" />
                  <p className="text-[10px] text-muted-foreground">Write-only. Existing key shown masked above. Leave blank to keep.</p>
                </div>

                {/* Fallback Base URL */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Base URL / Endpoint</Label>
                  <Input className="h-8 text-xs font-mono" placeholder="Auto-populated — or enter custom"
                    value={form.fallback.baseURL}
                    onChange={(e) => setForm((f) => ({ ...f, fallback: { ...f.fallback, baseURL: e.target.value } }))} />
                  {form.fallback.provider === 'codex' && proxyBase && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      Use <span className="font-mono">{proxyBase}/codex/v1</span> to route through the gateway (auto-refresh + logging), or <span className="font-mono">https://api.openai.com/v1</span> for direct.
                    </p>
                  )}
                </div>

                {/* Fallback Model */}
                {service.kind !== 'tts' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Model</Label>
                    <ModelSelector
                      provider={form.fallback.provider}
                      value={form.fallback.model}
                      onChange={(v) => setForm((f) => ({ ...f, fallback: { ...f.fallback, model: v } }))}
                      kind={service.kind}
                      serviceKey={service.key}
                      onPresetApply={(params) => setForm((f) => ({ ...f, fallback: { ...f.fallback, paramsJson: JSON.stringify(params, null, 2) } }))}
                    />
                    {service.kind === 'embedder' && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Model change requires corpus re-embed (dimensions must match).
                      </p>
                    )}
                  </div>
                )}

                {/* Fallback JSON params */}
                <div className="space-y-1.5">
                  <Separator />
                  <JsonParamsEditor
                    value={form.fallback.paramsJson}
                    onChange={(val) => setForm((f) => ({ ...f, fallback: { ...f.fallback, paramsJson: val } }))}
                    hint={service.paramsHint}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Enable to define a secondary provider that runs automatically when the primary provider fails.
              </p>
            )}
          </div>

          {/* Save */}
          <div className="pt-1 flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs gap-1.5"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !paramsValid || (form.fallback.enabled && !fallbackParamsValid)}
              title={(!paramsValid || (form.fallback.enabled && !fallbackParamsValid)) ? 'Fix JSON errors before saving' : undefined}>
              {mutation.isPending
                ? <><RefreshCw className="h-3 w-3 animate-spin" />Saving…</>
                : <><Save className="h-3 w-3" />Save {tier}</>}
            </Button>
            {(!paramsValid || (form.fallback.enabled && !fallbackParamsValid)) && <span className="flex items-center gap-1 text-[11px] text-destructive"><AlertCircle className="h-3 w-3" />Invalid JSON</span>}
            {mutation.isSuccess && paramsValid && (!form.fallback.enabled || fallbackParamsValid) && <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400"><CheckCircle2 className="h-3 w-3" />Saved</span>}
            {mutation.isError && <span className="flex items-center gap-1 text-[11px] text-destructive"><AlertCircle className="h-3 w-3" />Error</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ServiceCard ────────────────────────────────────────────────────────────────

function ServiceCard({ service, tierDocs, onSaved, proxyBase }: {
  service: ServiceMeta;
  tierDocs: Record<Tier, ServiceConfigDoc> | undefined;
  onSaved: () => void;
  proxyBase?: string;
}) {
  const Icon = service.icon;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          {service.label}
        </CardTitle>
        <CardDescription className="text-xs">
          {service.description}
          {service.note && <span className="block mt-1 text-amber-600 dark:text-amber-400">{service.note}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden lg:grid lg:grid-cols-3 gap-3">
          {TIERS.map((tier) => (
            <TierCell key={tier} service={service} tier={tier} doc={tierDocs?.[tier]} onSaved={onSaved} proxyBase={proxyBase} />
          ))}
        </div>
        <div className="lg:hidden">
          <Tabs defaultValue="free">
            <TabsList className="w-full">
              {TIERS.map((tier) => (
                <TabsTrigger key={tier} value={tier} className="capitalize flex-1 text-xs">{tier}</TabsTrigger>
              ))}
            </TabsList>
            {TIERS.map((tier) => (
              <TabsContent key={tier} value={tier} className="mt-3">
                <TierCell service={service} tier={tier} doc={tierDocs?.[tier]} onSaved={onSaved} proxyBase={proxyBase} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

// ── CopyButton ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-1"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── ModelTestPanel ─────────────────────────────────────────────────────────────

interface TestResult {
  success: boolean;
  model: string;
  latencyMs: number;
  httpStatus?: number;
  reply?: string | null;
  finishReason?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  error?: string;
  raw?: unknown;
}

function ModelTestPanel({ provider, models }: { provider: string; models: string[] }) {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState(models[0] ?? '');
  const [prompt, setPrompt] = useState('Hi! Just say "API OK" and nothing else.');
  const [paramsJson, setParamsJson] = useState(() => {
    const first = models[0] ? MODEL_PARAM_PRESETS[models[0]]?.params : undefined;
    return JSON.stringify(first ?? { temperature: 0.2, max_tokens: 256 }, null, 2);
  });
  const [result, setResult] = useState<TestResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const paramsValid = (() => { try { JSON.parse(paramsJson); return true; } catch { return false; } })();

  const testMutation = useMutation({
    mutationFn: () => {
      const params = JSON.parse(paramsJson) as Record<string, unknown>;
      return api.post<TestResult>('/admin/gateway/test', { provider, model, params, prompt }).then((r) => r.data);
    },
    onSuccess: (data) => { setResult(data); setShowRaw(false); },
    onError: (err: unknown) => {
      const apiErr = (err as { response?: { data?: TestResult } })?.response?.data;
      if (apiErr) { setResult(apiErr); setShowRaw(false); return; }
      setResult({ success: false, model, latencyMs: 0, error: String(err) });
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
      >
        <Play className="h-3 w-3" />
        Test models
      </button>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      <Separator />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5 text-muted-foreground" />
          Test a model
        </p>
        <button type="button" onClick={() => { setOpen(false); setResult(null); }}
          className="text-[11px] text-muted-foreground hover:text-foreground">close</button>
      </div>

      {/* Model picker */}
      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <div className="flex gap-2">
          <Select value={models.includes(model) ? model : '__custom__'}
            onValueChange={(v) => {
              if (v === '__custom__') return;
              setModel(v);
              if (MODEL_PARAM_PRESETS[v]) {
                setParamsJson(JSON.stringify(MODEL_PARAM_PRESETS[v].params, null, 2));
              }
            }}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {models.map((m) => <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="h-8 text-xs font-mono w-40" placeholder="custom model"
            value={models.includes(model) ? '' : model}
            onChange={(e) => { if (e.target.value) setModel(e.target.value); }} />
        </div>
        {MODEL_PARAM_PRESETS[model]?.note && (
          <p className={`text-[10px] ${MODEL_PARAM_PRESETS[model].note!.startsWith('⚠') ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
            {MODEL_PARAM_PRESETS[model].note}
          </p>
        )}
      </div>

      {/* Prompt */}
      <div className="space-y-1">
        <Label className="text-xs">Prompt</Label>
        <textarea
          className="w-full min-h-[56px] rounded-md border border-input px-3 py-2 text-xs bg-background resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          spellCheck={false}
          placeholder='e.g. "Say hi" or "Explain what enable_thinking does"'
        />
      </div>

      {/* Params JSON */}
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1.5">
          Params (JSON)
          <span className="text-[10px] text-muted-foreground font-normal">— temperature, max_tokens, enable_thinking, thinking_budget, reasoning_effort…</span>
        </Label>
        <textarea
          className={`w-full min-h-[80px] rounded-md border px-3 py-2 text-xs font-mono bg-background resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!paramsValid ? 'border-destructive' : 'border-input'}`}
          value={paramsJson}
          onChange={(e) => setParamsJson(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Run button */}
      <Button size="sm" className="gap-1.5 h-8 text-xs"
        onClick={() => { setResult(null); testMutation.mutate(); }}
        disabled={testMutation.isPending || !model || !paramsValid}>
        {testMutation.isPending
          ? <><RefreshCw className="h-3 w-3 animate-spin" />Running…</>
          : <><Sparkles className="h-3 w-3" />Run test</>}
      </Button>

      {/* Result */}
      {result && (
        <div className={`rounded-lg border p-3 space-y-2 text-xs ${result.success ? 'border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-900/10' : 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10'}`}>
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            {result.success
              ? <span className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />OK</span>
              : <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400"><AlertCircle className="h-3.5 w-3.5" />Failed</span>}
            <span className="font-mono text-muted-foreground">{result.model}</span>
            {result.httpStatus && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${result.httpStatus < 400 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600'}`}>
                HTTP {result.httpStatus}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1 text-muted-foreground">
              <Timer className="h-3 w-3" />{result.latencyMs}ms
            </span>
          </div>

          {/* Parsed reply (content field) */}
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">content field</p>
            <p className="font-mono text-foreground whitespace-pre-wrap break-all bg-background/60 rounded px-2 py-1.5 border text-[11px]">
              {result.reply ?? <span className="text-amber-600 italic">(null — thinking models may put output in reasoning field, check raw below)</span>}
            </p>
          </div>

          {/* Error */}
          {result.error && (
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Error</p>
              <p className="font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap break-all bg-background/60 rounded px-2 py-1.5 border text-[11px]">
                {result.error}
              </p>
            </div>
          )}

          {/* Usage + finish reason */}
          {(result.usage || result.finishReason) && (
            <div className="flex items-center gap-3 pt-0.5 text-[10px] text-muted-foreground flex-wrap">
              {result.usage && (
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  {result.usage.prompt_tokens ?? '?'} in / {result.usage.completion_tokens ?? '?'} out
                  {result.usage.total_tokens ? ` (${result.usage.total_tokens} total)` : ''}
                </span>
              )}
              {result.finishReason && <span>finish: <span className="font-mono">{result.finishReason}</span></span>}
            </div>
          )}

          {/* Raw response toggle */}
          <div className="space-y-1 pt-1">
            <button type="button"
              onClick={() => setShowRaw((x) => !x)}
              className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-medium">
              {showRaw ? '▲ Hide raw response' : '▼ Show full raw response'}
            </button>
            {showRaw && (
              <pre className="text-[10px] font-mono bg-muted/60 border rounded p-2 overflow-auto max-h-96 whitespace-pre-wrap break-all">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── GatewaySection ─────────────────────────────────────────────────────────────

function GatewayProviderCard({ p, onSaved }: { p: GatewayProviderStatus; onSaved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [token, setToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const isCodex = p.provider === 'codex';
  const isOCG   = p.provider === 'opencode-go'; // gateway config uses 'opencode-go', ServiceConfig uses 'opencodego'

  // ── OAuth popup flow ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCodex) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'codex_connected') {
        setConnectingOAuth(false);
        popupRef.current?.close();
        toast.success('Codex connected! Tokens saved.');
        onSaved();
      }
      if (e.data?.type === 'codex_error') {
        setConnectingOAuth(false);
        toast.error('Codex auth failed: ' + (e.data.error ?? 'unknown'));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isCodex, onSaved]);

  const startOAuth = useMutation({
    mutationFn: () => api.post<{ oauthUrl: string }>('/admin/gateway/codex/start-auth').then((r) => r.data),
    onSuccess: ({ oauthUrl }) => {
      setConnectingOAuth(true);
      const popup = window.open(oauthUrl, 'codex_oauth', 'width=520,height=640,toolbar=0,menubar=0');
      popupRef.current = popup;
      // If popup is blocked or closed without postMessage, reset state
      const timer = setInterval(() => {
        if (popup?.closed) { clearInterval(timer); setConnectingOAuth(false); }
      }, 1000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to start OAuth';
      toast.error(msg);
    },
  });

  // ── Token refresh ─────────────────────────────────────────────────────────
  const refreshMutation = useMutation({
    mutationFn: () => api.post<{ success: boolean; maskedToken?: string; error?: string }>('/admin/gateway/codex/refresh').then((r) => r.data),
    onSuccess: (data) => {
      if (data.success) { toast.success('Token refreshed!'); onSaved(); }
      else toast.error(data.error ?? 'Refresh failed');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Refresh failed';
      toast.error(msg);
    },
  });

  // ── Manual token save ─────────────────────────────────────────────────────
  const manualMutation = useMutation({
    mutationFn: () => api.put(`/admin/gateway/providers/${p.provider}`, {
      token: token.trim(),
      ...(refreshToken.trim() ? { refreshToken: refreshToken.trim() } : {}),
      ...(isCodex && accountId.trim() ? { accountId: accountId.trim() } : {}),
    }),
    onSuccess: () => {
      toast.success(`Token saved for ${p.provider}`);
      setToken(''); setRefreshToken(''); setAccountId(''); setManualMode(false);
      onSaved();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed';
      toast.error(msg);
    },
  });

  const tokenExpired = p.expiresAt ? new Date(p.expiresAt) < new Date() : false;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Server className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold font-mono text-sm">{p.provider}</span>
            {p.configured && !tokenExpired
              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">connected</span>
              : tokenExpired
              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">expired</span>
              : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">not connected</span>}
            {p.hasRefreshToken && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 font-medium">auto-refresh</span>
            )}
            {isCodex && (
              p.hasAccountId
                ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 font-medium">account id: set</span>
                : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium">account id: not set</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground pl-6">
            {isOCG   && 'OpenCode Go subscription (sk-… key)'}
            {isCodex && 'OpenAI Codex — OAuth 2.0 with PKCE'}
          </p>
        </div>
        <button type="button" onClick={() => setExpanded((x) => !x)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0">
          {expanded ? <><ChevronUp className="h-3.5 w-3.5" />Collapse</> : <><ChevronDown className="h-3.5 w-3.5" />Manage</>}
        </button>
      </div>

      {/* Status row */}
      <div className="rounded bg-muted/40 border px-3 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <KeyRound className="h-3 w-3 text-muted-foreground" />
          {p.maskedToken
            ? <span className="text-[11px] font-mono">{p.maskedToken}</span>
            : <span className="text-[11px] text-amber-600 dark:text-amber-400">no token</span>}
        </div>
        {p.expiresAt && (
          <div className={`text-[10px] ${tokenExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
            {tokenExpired ? 'Expired' : 'Expires'} {relativeTime(p.expiresAt)}
          </div>
        )}
        {p.updatedAt && (
          <div className="text-[10px] text-muted-foreground">
            Updated {relativeTime(p.updatedAt)}
          </div>
        )}
      </div>

      {/* Models + inline test panel */}
      {p.models.length > 0 && (
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Available models</p>
            <div className="flex flex-wrap gap-1">
              {p.models.map((m) => (
                <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">{m}</span>
              ))}
            </div>
          </div>
          {p.configured && <ModelTestPanel provider={p.provider} models={p.models} />}
        </div>
      )}

      {/* Actions panel */}
      {expanded && (
        <div className="space-y-3 pt-1">
          <Separator />

          {isCodex && (
            <div className="space-y-2">
              {/* OAuth connect button */}
              <Button
                size="sm"
                className="w-full gap-2 h-9 text-xs"
                onClick={() => startOAuth.mutate()}
                disabled={startOAuth.isPending || connectingOAuth}
              >
                {connectingOAuth
                  ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Waiting for OpenAI…</>
                  : startOAuth.isPending
                  ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Opening…</>
                  : <><LogIn className="h-3.5 w-3.5" />{p.configured ? 'Re-connect with OpenAI' : 'Connect with OpenAI'}</>}
              </Button>
              {connectingOAuth && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Complete sign-in in the popup window. This page will update automatically.
                </p>
              )}

              {/* Refresh token button */}
              {p.hasRefreshToken && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 h-8 text-xs"
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                >
                  {refreshMutation.isPending
                    ? <><RefreshCw className="h-3 w-3 animate-spin" />Refreshing…</>
                    : <><RefreshCcw className="h-3 w-3" />Refresh token now</>}
                </Button>
              )}

              {/* Manual paste toggle */}
              <button
                type="button"
                onClick={() => setManualMode((x) => !x)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground w-full justify-center pt-1"
              >
                <ExternalLink className="h-3 w-3" />
                {manualMode ? 'Hide manual paste' : 'Paste token manually instead'}
              </button>
            </div>
          )}

          {/* Manual paste (for codex if toggle on, or for opencode-go always) */}
          {(isOCG || manualMode) && (
            <div className="space-y-2">
              {isCodex && <p className="text-[10px] text-muted-foreground">Run <span className="font-mono">cat ~/.codex/auth.json</span> and paste the <span className="font-mono">access_token</span>.</p>}
              <div className="space-y-1.5">
                <Label className="text-xs">{isCodex ? 'Access Token' : 'API Key (sk-…)'}</Label>
                <Input type="password" className="h-8 text-xs font-mono"
                  placeholder={p.maskedToken ? `${p.maskedToken} — leave blank to keep` : 'Paste token / key'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="new-password" />
              </div>
              {isCodex && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Refresh Token (optional)</Label>
                  <Input type="password" className="h-8 text-xs font-mono"
                    placeholder="refresh_token from auth.json"
                    value={refreshToken}
                    onChange={(e) => setRefreshToken(e.target.value)} />
                </div>
              )}
              {isCodex && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Account ID (optional)</Label>
                  <Input className="h-8 text-xs font-mono"
                    placeholder={p.hasAccountId ? 'Already set — leave blank to keep' : 'e.g. user-abc123'}
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    autoComplete="off" />
                  <p className="text-[10px] text-muted-foreground">
                    Leave blank to auto-extract from the token. Find it in{' '}
                    <span className="font-mono">~/.codex/auth.json</span> as{' '}
                    <span className="font-mono">tokens.account_id</span>.
                  </p>
                </div>
              )}
              <Button size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => manualMutation.mutate()}
                disabled={manualMutation.isPending || !token.trim()}>
                {manualMutation.isPending
                  ? <><RefreshCw className="h-3 w-3 animate-spin" />Saving…</>
                  : <><Save className="h-3 w-3" />Save</>}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GatewaySection({ onSaved }: { onSaved: () => void }) {
  const { data, isLoading, isError, refetch } = useQuery<GatewayStatusResponse>({
    queryKey: ['admin/gateway/status'],
    queryFn: () => api.get<GatewayStatusResponse>('/admin/gateway/status').then((r) => r.data),
  });

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  if (isError || !data) return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
      Failed to load gateway status. Ensure the API supports the gateway endpoint.
      <Button variant="outline" size="sm" className="ml-2" onClick={() => void refetch()}>Retry</Button>
    </div>
  );

  const { proxyBase, internalKeySet } = data;

  return (
    <div className="space-y-4">
      {/* Internal key info */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Gateway Internal Key</span>
          {internalKeySet
            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">set</span>
            : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">NOT SET</span>}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Set <span className="font-mono">GATEWAY_INTERNAL_KEY</span> in your API <span className="font-mono">.env</span> to a random secret.
          The Agent service must use this as the <span className="font-mono">apiKey</span> in ServiceConfig rows that point to the gateway.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Proxy base URL:</span>
          <span className="text-[11px] font-mono break-all">{proxyBase}</span>
          <CopyButton text={proxyBase} />
        </div>
        {!internalKeySet && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            Without a key set, the proxy is open — only use in local dev. Set GATEWAY_INTERNAL_KEY in production.
          </p>
        )}
      </div>

      {/* Per-provider config */}
      <div className="grid gap-4 sm:grid-cols-2">
        {data.providers.map((p) => (
          <GatewayProviderCard key={p.provider} p={p} onSaved={() => { void refetch(); onSaved(); }} />
        ))}
      </div>

      {/* Usage guide */}
      <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
        <p className="text-xs font-semibold">How to wire a service to the gateway</p>
        <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Set the token above for the provider (opencode-go or codex).</li>
          <li>In the <span className="font-medium">Services</span> tab, pick <span className="font-mono">opencodego</span> or <span className="font-mono">codex</span> as the provider for a service×tier.</li>
          <li>Set <span className="font-mono">Base URL</span> to <span className="font-mono">{proxyBase}/{'<provider>'}/v1</span>.</li>
          <li>Set <span className="font-mono">API Key</span> to your <span className="font-mono">GATEWAY_INTERNAL_KEY</span> value.</li>
          <li>Pick the model from the dropdown and set params as JSON. Hit <span className="font-medium">Save</span>.</li>
        </ol>
        <p className="text-[11px] text-muted-foreground pt-1">
          The Agent service will POST to the gateway, which swaps the key for the real provider token and forwards the request.
        </p>
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'services' | 'gateway'>('services');

  const { data, isLoading, isError, refetch } = useQuery<ProvidersResponse>({
    queryKey: ['admin/providers'],
    queryFn: () => api.get<{ ok: boolean; providers: ProvidersResponse }>('/admin/providers').then((r) => r.data.providers),
  });

  // Fetch gateway status to get proxyBase for service config auto-fill
  const { data: gatewayData } = useQuery<GatewayStatusResponse>({
    queryKey: ['admin/gateway/status'],
    queryFn: () => api.get<GatewayStatusResponse>('/admin/gateway/status').then((r) => r.data),
    staleTime: 60_000,
  });

  const handleSaved = () => void queryClient.invalidateQueries({ queryKey: ['admin/providers'] });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Control every external provider per tier at runtime. Changes take effect within ~15 seconds — no redeploy needed."
      >
        <Button variant="outline" size="sm" className="gap-1.5"
          onClick={() => { void refetch(); void queryClient.invalidateQueries({ queryKey: ['admin/gateway/status'] }); }}
          disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'services' | 'gateway')}>
        <TabsList>
          <TabsTrigger value="services" className="gap-1.5">
            <Code2 className="h-3.5 w-3.5" />Services
          </TabsTrigger>
          <TabsTrigger value="gateway" className="gap-1.5">
            <Server className="h-3.5 w-3.5" />Subscription Gateway
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4">
          {/* Tier legend */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <span className="text-xs text-muted-foreground">Tiers:</span>
            {TIERS.map((tier) => (
              <Badge key={tier} variant="secondary" className={`capitalize text-xs ${TIER_COLORS[tier]}`}>{tier}</Badge>
            ))}
            <Separator orientation="vertical" className="h-4" />
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 font-medium">
              <Leaf className="h-2.5 w-2.5" />seeded from env
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 font-medium">
              <Clock className="h-2.5 w-2.5" />admin-set
            </span>
            <span className="text-xs text-muted-foreground ml-1">— expand any tier cell to edit.</span>
          </div>

          {isLoading ? <PageSkeleton />
            : isError || !data ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center space-y-2">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                <p className="font-semibold text-sm">Failed to load provider configs</p>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {SERVICES.map((service) => (
                  <ServiceCard
                    key={service.key}
                    service={service}
                    tierDocs={data[service.key]}
                    onSaved={handleSaved}
                    proxyBase={gatewayData?.proxyBase}
                  />
                ))}
              </div>
            )}
        </TabsContent>

        <TabsContent value="gateway" className="mt-4">
          <GatewaySection onSaved={() => void queryClient.invalidateQueries({ queryKey: ['admin/gateway/status'] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
