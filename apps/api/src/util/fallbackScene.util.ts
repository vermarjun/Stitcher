/**
 * Guaranteed-renderable Manim fallback scene.
 *
 * Used as a last resort when the LLM pipeline cannot produce a working scene,
 * so the user ALWAYS receives a video (a simple animated title card) instead of
 * an outright failure. No LLM, no voiceover, no external deps — pure template.
 */

export const FALLBACK_SCENE_CLASS = "FallbackScene";

/** Sanitise arbitrary prompt text into a safe, single-line ASCII Manim string literal body. */
function sanitiseForManim(prompt: string): string {
    const safe = (prompt || "Your animation")
        .replace(/[\\"]/g, " ")          // drop backslashes + double quotes
        .replace(/[\r\n\t]+/g, " ")      // collapse newlines/tabs
        .replace(/[^\x20-\x7E]/g, "")    // ASCII-only (avoid Pango/font crashes)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 90);
    return safe.length > 0 ? safe : "Your animation";
}

/**
 * Build a bulletproof single-scene Manim program that renders an animated title card.
 * The scene class is always FALLBACK_SCENE_CLASS.
 */
export function buildFallbackSceneCode(prompt: string): string {
    const safe = sanitiseForManim(prompt);
    return `from manim import *


class ${FALLBACK_SCENE_CLASS}(Scene):
    def construct(self):
        brand = Text("Stitcher", font_size=64, color=BLUE)
        topic = Text("${safe}", font_size=30, color=WHITE)
        if topic.width > 11:
            topic.set_width(11)
        topic.next_to(brand, DOWN, buff=0.6)
        note = Text("Preview generated - full animation coming soon", font_size=20, color=GRAY)
        note.to_edge(DOWN, buff=0.8)
        self.play(Write(brand), run_time=1.5)
        self.play(FadeIn(topic, shift=UP * 0.3), run_time=1.0)
        self.wait(1.5)
        self.play(FadeIn(note), run_time=0.8)
        self.wait(1.0)
`;
}
