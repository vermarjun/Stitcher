// ============================================================
// Stitcher Admin Portal — TypeScript types
// Authoritative shapes from ADMIN_PORTAL_SPEC.md §2
// ============================================================

// --------------- Shared primitives ---------------

export type UserPlan = 'free' | 'basic' | 'plus' | 'max';
export type UserRole = 'user' | 'admin';
export type JobStatus =
  | 'queued'
  | 'planning'
  | 'rendering'
  | 'concatenating'
  | 'uploading'
  | 'complete'
  | 'failed'
  | 'cancelled';
export type JobQueue = 'generation' | 'edit';
export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded';
export type FeedbackType = 'Bug' | 'Idea' | 'Other';
export type FeedbackStatus = 'new' | 'triaged' | 'resolved';
export type ServiceStatus = 'up' | 'degraded' | 'down';
export type ProjectStatus = 'draft' | 'in_progress' | 'compiled' | 'error';
export type AssetType = 'video' | 'audio';
export type AssetOrigin = 'template' | 'upload' | 'generated_video';
export type CollabStatus = 'pending' | 'accepted' | 'declined';

// --------------- §2a: Feedback ---------------

export interface FeedbackUser {
  _id: string;
  username: string;
  email: string;
}

export interface FeedbackItem {
  _id: string;
  user: FeedbackUser | null;
  type: FeedbackType;
  message: string;
  status: FeedbackStatus;
  adminNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface FeedbackListResponse {
  feedback: FeedbackItem[];
  total: number;
  page: number;
  limit: number;
  counts: {
    byType: { Bug: number; Idea: number; Other: number };
    byStatus: { new: number; triaged: number; resolved: number };
  };
}

export interface FeedbackUpdateResponse {
  feedback: FeedbackItem;
}

// --------------- §2b: Admin Metrics — Overview ---------------

export interface QueueCounts {
  active: number;
  waiting: number;
  delayed: number;
}

export interface OverviewMetrics {
  users: {
    total: number;
    new24h: number;
    new7d: number;
    new30d: number;
    activeToday: number;
    activeWeek: number;
  };
  revenue: {
    today: number;
    mtd: number;
    total: number;
    currency: 'INR';
  };
  generations: {
    active: number;
    last24h: number;
    succeeded24h: number;
    failed24h: number;
    successRate24h: number;
  };
  queue: {
    generation: QueueCounts;
    edit: QueueCounts;
  };
  content: {
    projects: number;
    videos: number;
    posts: number;
    storageBytes: number;
  };
  feedback: {
    new: number;
    total: number;
  };
}

// --------------- §2b: Admin Metrics — Users ---------------

export interface SignupDataPoint {
  date: string;
  count: number;
}

export interface PlanCount {
  plan: UserPlan;
  count: number;
}

export interface TopUser {
  _id: string;
  username: string;
  email: string;
  plan: UserPlan;
  generations: number;
  createdAt: string;
}

export interface UsersMetrics {
  signups: SignupDataPoint[];
  totals: {
    total: number;
    active7d: number;
    active30d: number;
  };
  byPlan: PlanCount[];
  authSplit: {
    oauth: number;
    password: number;
  };
  credits: {
    totalGeneration: number;
    totalEditing: number;
    expiringSoon: number;
  };
  topUsers: TopUser[];
}

// --------------- §2b: Admin Metrics — Users List ---------------

export interface UserRow {
  _id: string;
  username: string;
  email: string;
  plan: UserPlan;
  role: UserRole;
  isActive: boolean;
  isTestAccount: boolean;
  credits: {
    generation: number;
    editing: number;
  };
  createdAt: string;
  lastActive: string;
}

export interface UsersListResponse {
  users: UserRow[];
  total: number;
  page: number;
  limit: number;
}

// --------------- §2b: Admin Metrics — Generations ---------------

export interface GenerationDataPoint {
  date: string;
  complete: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface StatusBreakdownItem {
  status: JobStatus | string;
  count: number;
}

export interface FailureReason {
  reason: string;
  count: number;
}

export interface QueueSplit {
  generation: number;
  edit: number;
}

export interface RecentPrompt {
  prompt: string;
  status: JobStatus;
  createdAt: string;
  userId: string;
}

export interface TopPromptTerm {
  term: string;
  count: number;
}

export interface GenerationsMetrics {
  series: GenerationDataPoint[];
  statusBreakdown: StatusBreakdownItem[];
  successRate: number;
  failureRate: number;
  duration: {
    p50Ms: number;
    p95Ms: number;
    avgMs: number;
  };
  retryRate: number;
  avgScenes: number;
  failureReasons: FailureReason[];
  queueSplit: QueueSplit;
  recentPrompts: RecentPrompt[];
  topPromptTerms: TopPromptTerm[];
}

// --------------- §2b: Admin Metrics — Generations List ---------------

export interface SceneProgress {
  done: number;
  total: number;
}

export interface JobRow {
  _id: string;
  jobId: string;
  queue: JobQueue;
  userId: string;
  prompt: string;
  status: JobStatus;
  sceneProgress: SceneProgress;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  traceId?: string;
  finalUrl?: string;
}

export interface JobsListResponse {
  jobs: JobRow[];
  total: number;
  page: number;
  limit: number;
}

// --------------- §4.1: Job Detail / Ticket Timeline ---------------

export type StageId =
  | 'rag_enhance'
  | 'agent_plan'
  | 'agent_code'
  | 'render'
  | 'agent_debug'
  | 'tts'
  | 'concat'
  | 'upload';

export type StageService =
  | 'stitcher-api'
  | 'stitcher-rag'
  | 'stitcher-agent'
  | 'stitcher-render';

export interface JobStageTokens {
  input: number;
  output: number;
  total: number;
}

export interface JobStage {
  stage: StageId;
  service: StageService;
  sceneIndex?: number;
  status: 'ok' | 'failed';
  error?: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  tokens?: JobStageTokens;
  model?: string;
  outputSummary?: string;
  /** Generated Manim code at time of failure — shown in collapsible code block. */
  failedCode?: string;
}

export interface JobDetail {
  _id: string;
  jobId: string;
  queue: JobQueue;
  userId: string;
  prompt: string;
  status: JobStatus;
  sceneProgress: SceneProgress;
  error?: string;
  traceId?: string;
  finalUrl?: string;
  startedAt: string;
  completedAt?: string;
  tokens?: { input: number; output: number };
  costUsd?: number;
  stages: JobStage[];
  createdAt: string;
  updatedAt: string;
}

// --------------- §2b: Admin Metrics — Content ---------------

export interface ProjectByStatus {
  status: ProjectStatus;
  count: number;
}

export interface CreatedSeriesPoint {
  date: string;
  count: number;
}

export interface AssetByType {
  type: AssetType;
  count: number;
}

export interface AssetByOrigin {
  origin: AssetOrigin;
  count: number;
}

export interface TopPost {
  _id: string;
  title: string;
  author: string;
  likesCount: number;
  views: number;
}

export interface TopLikedTemplate {
  _id: string;
  title: string;
  likes: number;
}

export interface ContentMetrics {
  projects: {
    total: number;
    byStatus: ProjectByStatus[];
    createdSeries: CreatedSeriesPoint[];
  };
  assets: {
    total: number;
    byType: AssetByType[];
    byOrigin: AssetByOrigin[];
    storageBytes: number;
  };
  community: {
    posts: number;
    likes: number;
    comments: number;
    views: number;
    topPosts: TopPost[];
  };
  shares: {
    total: number;
    totalViews: number;
  };
  templates: {
    total: number;
    topLiked: TopLikedTemplate[];
  };
  collab: {
    invites: number;
    accepted: number;
    acceptanceRate: number;
  };
}

// --------------- §2b: Admin Metrics — Revenue ---------------

export interface RevenueDataPoint {
  date: string;
  amount: number;
  count: number;
}

export interface PlanRevenue {
  plan: UserPlan;
  amount: number;
  count: number;
}

export interface PaymentStatusBreakdown {
  status: PaymentStatus;
  count: number;
}

export interface RecentPayment {
  user: {
    username: string;
    email: string;
  };
  plan: UserPlan;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
}

export interface RevenueMetrics {
  series: RevenueDataPoint[];
  totals: {
    today: number;
    mtd: number;
    total: number;
    currency: 'INR';
  };
  byPlan: PlanRevenue[];
  statusBreakdown: PaymentStatusBreakdown[];
  recent: RecentPayment[];
}

// --------------- §2b: Admin Metrics — Cost ---------------

export interface TokensByModel {
  model: string;
  input: number;
  output: number;
}

export interface TokensByRole {
  role: string;
  tokens: number;
}

export interface CostSeriesPoint {
  date: string;
  input: number;
  output: number;
}

export interface CostByModel {
  model: string;
  usd: number;
}

export type CostSource = 'prometheus' | 'persisted' | 'none';

export interface CostMetrics {
  tokens: {
    input: number;
    output: number;
    total: number;
    byModel: TokensByModel[];
    byRole: TokensByRole[];
  };
  series: CostSeriesPoint[];
  cost: {
    totalUsd: number;
    perJobAvgUsd: number;
    byModel: CostByModel[];
  };
  source: CostSource;
  note?: string;
}

// --------------- §2c: Health ---------------

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  detail?: string;
  checkedAt: string;
}

export interface HealthResponse {
  services: ServiceHealth[];
  generatedAt: string;
}

// --------------- §2d: Live Jobs ---------------

export interface LiveJobSnapshot {
  /** BullMQ queue name: "video-generation" | "video-edit" */
  queue: string;
  jobId: string;
  chatId: string;
  userId: string;
  /** Truncated prompt / edit instruction for display. */
  prompt: string;
  /** BullMQ job state: "active" | "waiting" | "delayed" | "unknown" */
  state: string;
  attemptsMade: number;
  /** Epoch ms when the job was created / enqueued. */
  timestamp: number | null;
  /** Epoch ms when processing began (null while waiting). */
  processedOn: number | null;
  traceId?: string;
}

export interface LiveJobsResponse {
  jobs: LiveJobSnapshot[];
  count: number;
}

// --------------- Admin Actions ---------------

export interface AuditLogEntry {
  _id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

// --------------- Date Range ---------------

export interface DateRange {
  from: Date;
  to: Date;
}

// --------------- RLHF — Feature 1 + 2 + 3 ---------------

export type CurationStatus = 'unreviewed' | 'approved' | 'rejected';

/** Extended JobRow with RLHF fields returned by /admin/metrics/generations/list */
export interface JobRowRlhf extends JobRow {
  rating: number | null;
  ratedAt?: string;
  curationStatus: CurationStatus;
  debugInvoked: boolean;
  debugResolved: boolean;
  createdAt: string;
}

/** Extended JobsListResponse with RLHF rows */
export interface JobsListRlhfResponse {
  jobs: JobRowRlhf[];
  total: number;
  page: number;
  limit: number;
}

/** Extended JobDetail with RLHF fields */
export interface JobDetailRlhf extends JobDetail {
  rating: number | null;
  ratedAt?: string;
  curationStatus: CurationStatus;
  debugInvoked: boolean;
  debugResolved: boolean;
}

// --------------- RLHF — RAG retrieval trace ---------------

export interface RetrievalCandidate {
  id: string;
  title: string;
  score: number;
  apisUsed?: string[];
}

export interface RetrievalSelectResult {
  method: string;
  selected: Array<{ id: string; title: string; apisUsed?: string[] }>;
  coveredApis: string[];
}

export interface RetrievalEmbedInfo {
  provider: string;
  model: string;
  dims: number;
}

export interface RetrievalTrace {
  searchQuery: string;
  dense: RetrievalCandidate[];
  sparse: RetrievalCandidate[];
  merged: RetrievalCandidate[];
  topK: number;
  select: RetrievalSelectResult;
  embed: RetrievalEmbedInfo;
}

/** One LLM I/O record from GET /admin/rlhf/generations/:jobId/llm-io */
export interface LlmIoEntry {
  stage: string;
  sceneIndex?: number;
  attempt: number;
  role: string;
  provider: string;
  llmModel: string;
  systemPrompt: string;
  userPrompt: string;
  fullInput?: unknown;
  rawOutput: string;
  tokensUsed?: number;
  error?: string;
  createdAt: string;
  /** Present on stage="rag_enhance" / role="retrieval" rows — renders as RAG panel instead of LLM I/O */
  retrievalTrace?: RetrievalTrace;
}

/** POST /admin/rlhf/rag/sync response */
export interface RagSyncResponse {
  synced: number;
  failed: number;
}

/** POST /admin/rlhf/generations/:jobId/curate response — returns updated job fields */
export interface CurateResponse {
  curationStatus: CurationStatus;
  jobId: string;
}
