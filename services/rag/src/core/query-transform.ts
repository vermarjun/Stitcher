import { chatText } from "../providers/llm.js";
import { log } from "../logger.js";
import { withTimeout } from "../util/retry.js";
import { recordLlmTokens } from "../observability/rag.js";
import type { Complexity, TransformedQuery, QueryTransformProviderOverride, TraceQueryTransform } from "../types.js";
import type { ResolvedSettings } from "./settings.js";
import { providerDefaults } from "../config.js";
import type { LlmTarget } from "../providers/llm.js";

// ─── Static API reference list (403 Manim symbols) ────────────────────────────
// Inlined at build time — avoids file-read path issues in both ESM and CJS bundles.
// Per CONTRACT 1: injected as a static prefix in every query-transform call so the
// provider's KV cache can reuse the prefix across requests (cheap per call).
const MANIM_API_LIST = "Add: Add Mobjects to a scene, without animating them in any other way\nAddTextLetterByLetter: Show a :class:`~\nAddTextWordByWord: Show a :class:`~\nAngle: A circular arc or elbow-type mobject representing an angle of two lines\nAnimatedBoundary: Boundary of a :class:`\nAnimation: An animation\nAnimationGroup: Plays a group or series of :class:`~\nAnnotationDot: A dot with bigger radius and bold stroke to annotate scenes\nAnnularSector: A sector of an annulus\nAnnulus: Region between two concentric Circles\nApplyComplexFunction: Animates a mobject by applying a method\nApplyFunction: A Transform transforms a Mobject into a target Mobject\nApplyMatrix: Applies a matrix transform to an mobject\nApplyMethod: Animates a mobject by applying a method\nApplyPointwiseFunction: Animation that applies a pointwise function to a mobject\nApplyPointwiseFunctionToCenter: Animation that applies a pointwise function to a mobject\nApplyWave: Send a wave through the Mobject distorting it temporarily\nArc: A circular arc\nArcBetweenPoints: Inherits from Arc and additionally takes 2 points between which the arc is spanned\nArcBrace: Creates a Brace that wraps around an Arc\nArcPolygon: A generalized polygon allowing for points to be connected with arcs\nArcPolygonFromArcs: A generalized polygon allowing for points to be connected with arcs\nArrow: An arrow\nArrow3D: An arrow made out of a cylindrical line and a conical tip\nArrowCircleFilledTip: Circular arrow tip with filled tip\nArrowCircleTip: Circular arrow tip\nArrowSquareFilledTip: Square arrow tip with filled tip\nArrowSquareTip: Square arrow tip\nArrowTip: Base class for arrow tips\nArrowTriangleFilledTip: Triangular arrow tip with filled tip\nArrowTriangleTip: Triangular arrow tip\nArrowVectorField: A VectorField represented by a set of change vectors\nAxes: Creates a set of axes\nBackgroundRectangle: A background rectangle\nBarChart: Creates a bar chart\nBlink: Blink the mobject\nBrace: Takes a mobject and draws a brace adjacent to it\nBraceBetweenPoints: Similar to Brace, but instead of taking a mobject it uses 2 points to place the brace\nBraceLabel: Create a brace with a label attached\nBraceText: Create a brace with a text label attached\nBroadcast: Broadcast a mobject starting from an initial_width, up to the actual size of the mobject\nBulletedList: A bulleted list\nCamera: Base camera class\nChangeDecimalToValue: Animate a DecimalNumber\nChangeSpeed: Modifies the speed of passed animation\nChangingDecimal: Animate a DecimalNumber\nCircle: A circle\nCircumscribe: Draw a temporary line surrounding the mobject\nClockwiseTransform: Transforms the points of a mobject along a clockwise oriented arc\nCode: A highlighted source code listing\nComplexPlane: A complex number plane\nComplexValueTracker: Tracks a complex-valued parameter\nCone: A circular cone\nCoordinateSystem: Abstract base class for Axes and NumberPlane\nCounterclockwiseTransform: Transforms the points of a mobject along a counterclockwise oriented arc\nCreate: Incrementally show a VMobject\nCross: Creates a cross\nCube: A three-dimensional cube\nCubicBezier: A cubic Bezier curve\nCurvedArrow: A curved arrow between two points\nCurvedDoubleArrow: A curved double arrow between two points\nCurvesAsSubmobjects: Convert a curve's elements to submobjects\nCutout: A shape with smaller cutouts\nCyclicReplace: An animation moving mobjects cyclically\nCylinder: A cylinder, defined by its height, radius and direction\nDashedLine: A dashed Line\nDashedVMobject: A VMobject composed of dashes instead of lines\nDecimalMatrix: A mobject that displays a matrix with decimal entries\nDecimalNumber: A mobject representing a decimal number\nDiGraph: A directed graph\nDot: A circle with a very small radius\nDot3D: A spherical dot\nDoubleArrow: An arrow with tips on both ends\nDrawBorderThenFill: Draw the border first and then show the fill\nElbow: Two lines that create a right angle about each other: L-shape\nEllipse: A circular shape; oval, circle\nFadeIn: Fade in a mobject\nFadeOut: Fade out a mobject\nFadeToColor: Animation that changes color of a mobject\nFadeTransform: Fades one mobject into another\nFadeTransformPieces: Fades submobjects of one mobject into submobjects of another one\nFlash: Send out lines in all directions\nFocusOn: Shrink a spotlight to a position\nFunctionGraph: A ParametricFunction that spans the length of the scene\nGraph: An undirected graph (vertices connected with edges)\nGroup: Groups together multiple Mobjects\nGrowArrow: Introduce an Arrow by growing it\nGrowFromCenter: Introduce a Mobject by growing it from its center\nGrowFromEdge: Introduce a Mobject by growing it from one of its edges\nGrowFromPoint: Introduce a Mobject by growing it from a point\nHomotopy: A Homotopy\nIcosahedron: An icosahedron, one of the five platonic solids\nImageMobject: Displays an Image from a numpy array or a file\nImplicitFunction: A vectorized mobject representing an implicit function\nIndicate: Indicate a Mobject by temporarily resizing and recoloring it\nInteger: A class for displaying Integers\nIntegerMatrix: A mobject that displays a matrix with integer entries\nIntersection: Find the intersection of two VMobjects\nLabel: A Label consisting of text surrounded by a frame\nLabeledArrow: Constructs an arrow containing a label box\nLabeledDot: A Dot containing a label in its center\nLabeledLine: Constructs a line containing a label box\nLaggedStart: Adjusts the timing of a series of animations\nLaggedStartMap: Plays a series of animations with lag\nLine: A straight or curved line segment between two points or mobjects\nLine3D: A cylindrical line, for use in ThreeDScene\nLinearTransformationScene: Scene suitable for showing linear transformations\nManimBanner: Convenience class representing Manim's banner\nManimColor: Internal representation of a color\nMarkupText: Display (non-LaTeX) text rendered using Pango\nMathTex: A string compiled with LaTeX in math mode\nMatrix: A mobject that displays a matrix on the screen\nMobject: Mathematical Object: base class for objects that can be displayed on screen\nMoveAlongPath: Make one mobject move along the path of another mobject\nMoveToTarget: Transforms a mobject to the mobject stored in its target attribute\nMovingCamera: A camera that follows and matches the size and position of its frame\nMovingCameraScene: A Scene suitable for cases where the camera moves\nNumberLine: Creates a number line with tick marks\nNumberPlane: Creates a cartesian plane with background lines\nOctahedron: An octahedron, one of the five platonic solids\nParagraph: Display a paragraph of text\nParametricFunction: A parametric curve\nPoint: A mobject representing a point\nPolarPlane: Creates a polar plane with background lines\nPolygon: A shape consisting of one closed loop of vertices\nPolygram: A generalized Polygon, allowing for disconnected sets of edges\nPolyhedron: An abstract polyhedra class\nPrism: A right rectangular prism\nRectangle: A quadrilateral with two sets of parallel sides\nRegularPolygon: An n-sided regular Polygon\nRegularPolygram: A Polygram with regularly spaced vertices\nRemoveTextLetterByLetter: Remove a Text letter by letter\nReplacementTransform: Replaces and morphs a mobject into a target mobject\nRestore: Transforms a mobject to its last saved state\nRightAngle: An elbow-type mobject representing a right angle between two lines\nRotate: Animation that rotates a Mobject\nRoundedRectangle: A rectangle with rounded corners\nSVGMobject: A vectorized mobject created from importing an SVG file\nScene: A Scene is the canvas of your animation\nSector: A sector of a circle\nShowIncreasingSubsets: Show one submobject at a time, leaving all previous ones displayed\nShowPassingFlash: Show only a sliver of the VMobject each frame\nShrinkToCenter: Animation that makes a mobject shrink to center\nSpinInFromNothing: Introduce a Mobject by spinning it in\nSpiralIn: Create the Mobject with sub-Mobjects flying in on spiral trajectories\nSquare: A rectangle with equal side lengths\nStar: A regular polygram without the intersecting lines\nStreamLines: StreamLines represent the flow of a VectorField\nSuccession: Plays a series of animations in succession\nSurface: Creates a Parametric Surface using a checkerboard pattern\nSurroundingRectangle: A rectangle surrounding a mobject\nSwap: An animation moving mobjects cyclically\nTable: A mobject that displays a table on the screen\nTangentLine: Constructs a line tangent to a curve\nTex: A string compiled with LaTeX in normal mode\nMathTex: A string compiled with LaTeX in math mode\nText: Display (non-LaTeX) text rendered using Pango\nThreeDAxes: A 3-dimensional set of axes\nThreeDScene: A Scene suitable for Three Dimensional animations\nTitle: A mobject representing an underlined title\nTorus: A torus\nTracedPath: Traces the path of a point returned by a function call\nTransform: A Transform transforms a Mobject into a target Mobject\nTransformFromCopy: Performs a reversed Transform\nTransformMatchingShapes: An animation trying to transform groups by matching the shape of submobjects\nTransformMatchingTex: A transformation trying to transform rendered LaTeX strings\nTriangle: An equilateral triangle\nTypeWithCursor: Similar to Write but with a cursor\nUncreate: Like Create but in reverse\nUnderline: Creates an underline\nUnion: Union of two or more VMobjects\nUnitInterval: Creates a number line with tick marks\nUnwrite: Simulate erasing by hand\nUpdateFromAlphaFunc: updater based on alpha value\nUpdateFromFunc: updater based on a function\nVDict: A VGroup-like class with dict-like access\nVGroup: A group of vectorized mobjects\nVMobject: A vectorized mobject\nValueTracker: A mobject for tracking real-valued parameters\nVariable: Displays label = value with continuously updated value\nVector: A vector specialized for use in graphs\nVectorField: A vector field\nVectorScene: A Scene for vector operations\nWait: A no-operation animation (pause)\nWiggle: Wiggle a Mobject\nWrite: Simulate hand-writing a VMobject\nZoomedScene: A Scene suitable for zooming in on a part\nalways_redraw: Redraw the mobject constructed by a function every frame\nalways_rotate: A mobject which is continuously rotated\nalways_shift: A mobject which is continuously shifted\nangle_between_vectors: Returns the angle between two vectors\nbezier: Classic implementation of a Bezier curve\ncenter_of_mass: Gets the center of mass of the points in space\ncolor_gradient: Create a list of colors interpolated between the input array\ninterpolate: Linearly interpolates between two values\ninterpolate_color: Standalone function to interpolate two ManimColors\nnormalize: Normalize a vector\nrotate_vector: Function for rotating a vector\nrotation_matrix: Rotation in R^3 about a specified axis\nsmooth: Smooth rate function\nthere_and_back: Rate function that goes to 1 then back to 0\nturn_animation_into_updater: Add an updater to the animation's mobject";

const API_LIST_LINE_COUNT = MANIM_API_LIST.split("\n").length;

// ─── Plugin index ─────────────────────────────────────────────────────────────
// Static prefix (like MANIM_API_LIST) so the provider KV-cache reuses it. These are
// the vetted plugins installed in the render service. When a request matches one,
// using the plugin is far more reliable than hand-building the domain object in core
// Manim — so the transform must surface it as `requiredPlugins`.
const MANIM_PLUGIN_INDEX = `manim-chess — chess boards, FEN/PGN positions, animated legal moves, evaluation bars. APIs: Board, set_board_from_FEN, convert_from_PGN, play_game, EvaluationBar, move_piece, draw_arrow, mark_square, highlight_square.
manim-dsa — data structures & algorithms: arrays, stacks, variables/pointers, graphs (BFS/DFS/Dijkstra/Prim), trees, with built-in step/highlight animations. APIs: MArray, MStack, MVariable, MGraph, MTree (+ matching MArrayStyle/MStackStyle/MGraphStyle/MTreeStyle), add_indexes, highlight, set_highlight.
manim-ml — neural networks & ML architectures: feed-forward nets, CNNs, layers, forward-pass animations. APIs: NeuralNetwork, FeedForwardLayer, Convolutional2DLayer, ImageLayer, make_forward_pass_animation.
manim-physics — physics simulations: pendulums, electric/magnetic fields, waves, optics, rigid bodies. APIs: Pendulum, MultiPendulum, Charge, ElectricField, Magnet, RadialWave, LinearWave, Lens, Ray, SpaceScene, TracedPath.
manim-chemistry — molecules, atomic structure, periodic elements, formulas. APIs: BohrAtom, MElementObject, MMoleculeObject, GraphMolecule, Orbital, ChemicalFormula, NamedFormula.
manim-astronomy — stars, planets, spacetime curvature, telescopes. APIs: Star, Planet, SpaceTimeFabric, HubbleSpaceTelescope.`;

const SYSTEM_PROMPT = `You are a Manim expert. Understand what the user wants to animate and produce:
1. transformedQuery — the request translated into precise Manim-API-specific language.
2. requiredPlugins — if the topic matches one of the MANIM PLUGINS listed below (chess, data structures/algorithms, neural networks, physics, chemistry, astronomy), name the plugin(s) (e.g. "manim-chess"). A plugin renders the domain object for you and is STRONGLY preferred over core Manim. Use an empty array when none fit.
3. requiredApis — the specific classes/animations/mobjects most likely needed. Use exact names from the API reference; when a plugin fits, INCLUDE that plugin's API names here too.

Be concise and technical. Output ONLY valid JSON — no markdown, no prose, no explanation.`;

export interface TransformedQueryWithTrace extends TransformedQuery {
  _trace?: TraceQueryTransform;
}

function rawFallback(rawQuery: string): TransformedQueryWithTrace {
  return {
    transformedQuery: rawQuery,
    suggestedApis: [],
    requiredApis: [],
    requiredPlugins: [],
    domain: "general",
    tags: [],
    estimatedComplexity: "intermediate",
    ok: false,
  };
}

// Plugins we actually support (installed in the render service). The model may
// return loose names ("chess", "manim_chess", "Astronomy") — normalise to slugs
// and drop anything we don't ship so we never inject a non-existent plugin.
const SUPPORTED_PLUGINS = new Set<string>([
  "manim-chess", "manim-dsa", "manim-ml", "manim-physics", "manim-chemistry", "manim-astronomy",
]);
const PLUGIN_ALIASES: Record<string, string> = {
  "manim-astro": "manim-astronomy",
  "manim-chem": "manim-chemistry",
  "manim-nn": "manim-ml",
  "manim-neural-network": "manim-ml",
};

function normalisePlugins(raw: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (typeof r !== "string") continue;
    let s = r.trim().toLowerCase().replace(/_/g, "-");
    if (!s) continue;
    if (!s.startsWith("manim-")) s = `manim-${s}`;
    s = PLUGIN_ALIASES[s] ?? s;
    if (SUPPORTED_PLUGINS.has(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/**
 * Build an LlmTarget from a per-request queryTransform provider override,
 * falling back to the resolved settings (env defaults) for any absent field.
 * `params` is spread into `extraBody` so temperature/max_tokens/etc. are honoured.
 */
function llmTargetFromOverride(
  override: QueryTransformProviderOverride,
  fallback: LlmTarget
): LlmTarget {
  const defaults = override.provider ? providerDefaults(override.provider) : undefined;
  return {
    apiKey: override.apiKey ?? fallback.apiKey,
    model: override.model ?? defaults?.model ?? fallback.model,
    baseUrl: override.baseURL ?? defaults?.baseUrl ?? fallback.baseUrl,
    extraBody: override.params ?? (defaults ? (defaults.provider === "opencodego" ? { thinking: { type: "disabled" } } : {}) : fallback.extraBody),
  };
}

/**
 * Transform the raw query into a richer, API-specific form. Per CONTRACT 1:
 *  - Dumb/non-thinking model (plain chatText, not tool_choice — simpler + faster).
 *  - Full API reference list injected as a static prefix for provider-side caching.
 *  - Outputs (a) transformedQuery for retrieval, (b) requiredApis for the coder.
 *  - Opt-in via STAGE_QUERY_TRANSFORM; bounded by QUERY_TRANSFORM_TIMEOUT_MS.
 *  - Never throws — any failure degrades gracefully to the raw query.
 *
 * When `providerOverride` is supplied (CONTRACT 2), the LLM client is built from
 * those values instead of the env defaults. Absent fields fall back to env.
 */
export async function transformQuery(
  rawQuery: string,
  settings: ResolvedSettings,
  providerOverride?: QueryTransformProviderOverride
): Promise<TransformedQueryWithTrace> {
  if (!settings.stages.queryTransform) return rawFallback(rawQuery);

  // Resolve the LLM target: use per-request override when provided, else env defaults.
  const llmTarget: LlmTarget = providerOverride
    ? llmTargetFromOverride(providerOverride, settings.llm)
    : settings.llm;

  const userMessage =
    `MANIM API REFERENCE (${API_LIST_LINE_COUNT} symbols):\n${MANIM_API_LIST}\n\n` +
    `MANIM PLUGINS (prefer one when the topic matches; surface it in requiredPlugins):\n${MANIM_PLUGIN_INDEX}\n\n---\n` +
    `USER REQUEST: "${rawQuery}"\n\n` +
    `Respond with JSON only:\n{"transformedQuery": "...", "requiredPlugins": ["..."], "requiredApis": ["...", "..."], "domain": "cs|math|physics|biology|chemistry|general", "estimatedComplexity": "beginner|intermediate|expert"}`;

  const tStart = Date.now();

  try {
    const { result: raw, usage } = await withTimeout(
      chatText({
        target: llmTarget,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        timeoutMs: settings.timeouts.queryTransformMs,
        temperature: 0,
      }),
      settings.timeouts.queryTransformMs,
      "query-transform"
    );

    const durationMs = Date.now() - tStart;

    // Emit stitcher.llm.tokens metric for the query-transform LLM call.
    recordLlmTokens(llmTarget.model, "query_transform", usage);

    // Parse JSON from the model response (may be wrapped in markdown fences)
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      log.warn({ raw: raw.slice(0, 200) }, "Query transform returned no JSON — falling back");
      const fb = rawFallback(rawQuery);
      fb._trace = {
        ran: false,
        provider: providerOverride?.provider ?? settings.llm.baseUrl,
        model: llmTarget.model,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: userMessage,
        rawOutput: raw,
        transformedQuery: rawQuery,
        requiredApis: [],
        requiredPlugins: [],
        tokensUsed: { input: 0, output: 0 },
        durationMs: Date.now() - tStart,
      };
      return fb;
    }

    const parsed = JSON.parse(match[0]) as {
      transformedQuery?: string;
      requiredApis?: unknown;
      requiredPlugins?: unknown;
      domain?: string;
      estimatedComplexity?: string;
    };

    const requiredApis = Array.isArray(parsed.requiredApis)
      ? (parsed.requiredApis as string[]).filter((s) => typeof s === "string")
      : [];

    // Normalise plugin names to the canonical "manim-<x>" slugs and keep only ones
    // we actually support (guards against the model inventing plugin names).
    const requiredPlugins = Array.isArray(parsed.requiredPlugins)
      ? normalisePlugins(parsed.requiredPlugins as unknown[])
      : [];

    const transformedQuery = parsed.transformedQuery || rawQuery;

    const traceQT: TraceQueryTransform = {
      ran: true,
      provider: providerOverride?.provider ?? settings.llm.baseUrl,
      model: llmTarget.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userMessage,
      rawOutput: raw,
      transformedQuery,
      requiredApis,
      requiredPlugins,
      tokensUsed: {
        input: (usage as any)?.prompt_tokens ?? (usage as any)?.input_tokens ?? 0,
        output: (usage as any)?.completion_tokens ?? (usage as any)?.output_tokens ?? 0,
      },
      durationMs,
    };

    return {
      transformedQuery,
      suggestedApis: requiredApis, // back-compat alias
      requiredApis,
      requiredPlugins,
      domain: (parsed.domain as TransformedQuery["domain"]) || "general",
      tags: [],
      estimatedComplexity: (parsed.estimatedComplexity as Complexity) || "intermediate",
      ok: true,
      _trace: traceQT,
    };
  } catch (err) {
    log.warn(
      { err: String(err), query: rawQuery.slice(0, 80) },
      "Query transform failed — falling back to raw query"
    );
    const fb = rawFallback(rawQuery);
    // Still capture inputs so the admin can see what was sent even on failure.
    fb._trace = {
      ran: false,
      provider: providerOverride?.provider ?? settings.llm.baseUrl,
      model: llmTarget.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userMessage,
      rawOutput: `[ERROR: ${String(err)}]`,
      transformedQuery: rawQuery,
      requiredApis: [],
      requiredPlugins: [],
      tokensUsed: { input: 0, output: 0 },
      durationMs: Date.now() - tStart,
    };
    return fb;
  }
}

/** Text to embed: enrich with suggested APIs when the transform succeeded. */
export function embeddingTextFor(rawQuery: string, t: TransformedQuery): string {
  if (!t.ok) return rawQuery;
  const apis = t.requiredApis?.length ? `\nRelevant Manim APIs: ${t.requiredApis.join(", ")}` : "";
  return `${t.transformedQuery}${apis}`;
}
