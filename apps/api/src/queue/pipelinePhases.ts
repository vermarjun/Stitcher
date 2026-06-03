/**
 * Canonical generation-pipeline phase map — the SINGLE source of truth for the
 * user-facing live progress (label + percentage) of a video generation.
 *
 * The worker advances through the LINEAR single-scene pipeline and emits these
 * phases as it goes:
 *
 *   queued → rag → code → voiceover → render → debug → upload → done
 *
 * Each phase carries:
 *   - label:   the human-readable step shown above the progress bar
 *              ("Rendering your animation…")
 *   - percent: the REAL floor the bar jumps to when this phase begins. This is
 *              persisted to GenerationJob.progress so a page reload restores the
 *              exact bar position.
 *   - ceil:    the cap the bar may slowly "creep" toward while the phase runs,
 *              so a long stage (code-gen / render can each take 60s+) never
 *              looks frozen. The bar NEVER reaches ceil until the next real
 *              phase fires — the creep is bounded + decelerating, never claiming
 *              progress that hasn't happened.
 *
 * Because both the live Socket.IO event and the persisted job record carry
 * these exact numbers, the frontend is "dumb": it renders precisely what the
 * backend reports — real, live, and reload-safe.
 *
 * NOTE: this module is pure data (no runtime deps) so it is safe to import from
 * the model, the worker, the controller, and the event publisher alike.
 */

export type GenerationPhase =
    | "queued"
    | "rag"
    | "code"
    | "voiceover"
    | "render"
    | "debug"
    | "upload"
    | "done"
    | "failed";

export interface PhaseMeta {
    label: string;
    percent: number;
    ceil: number;
}

/**
 * Floors + ceils are arranged in strictly increasing bands with small gaps so
 * the bar is monotonic across the whole pipeline:
 *   queued 4–12 · rag 15–30 · code 32–52 · voiceover 54–62 · render 64–76 ·
 *   debug 78–88 · upload 90–97 · done 100
 *
 * The debug→re-render loop re-enters lower-numbered phases (render after debug);
 * the persisted percent is clamped monotonic (setJobProgress uses $max) and the
 * client creep only ever moves forward, so the bar never jumps backward.
 */
export const PIPELINE_PHASES: Record<GenerationPhase, PhaseMeta> = {
    queued:    { label: "Waiting in queue…",                   percent: 4,   ceil: 12 },
    rag:       { label: "Looking up relevant Manim examples…", percent: 15,  ceil: 30 },
    code:      { label: "Writing animation code…",             percent: 32,  ceil: 52 },
    voiceover: { label: "Generating voiceover…",               percent: 54,  ceil: 62 },
    render:    { label: "Rendering your animation…",           percent: 64,  ceil: 76 },
    debug:     { label: "Fixing animation errors…",            percent: 78,  ceil: 88 },
    upload:    { label: "Finalizing your video…",              percent: 90,  ceil: 97 },
    done:      { label: "Done",                                percent: 100, ceil: 100 },
    failed:    { label: "Generation failed",                   percent: 100, ceil: 100 },
};

/** Look up a phase's metadata, falling back to `queued` for unknown keys. */
export function getPhaseMeta(phase: GenerationPhase | string): PhaseMeta {
    return PIPELINE_PHASES[phase as GenerationPhase] ?? PIPELINE_PHASES.queued;
}
