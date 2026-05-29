# ManimRAG — end-to-end trace

**Generated:** 2026-05-29T21:52:35.974Z

**Input prompt:**
```text
Explain binary search with a proper example on this array: 2 8 9 3 44 81 92 45 and searching for element 81
```

**Pipeline config for this run** (all stages forced ON):
```json
{
  "embedder": {
    "provider": "ollama",
    "model": "bge-m3:latest",
    "dim": 1024
  },
  "llm": {
    "model": "glm-5.1",
    "baseUrl": "https://opencode.ai/zen/go/v1",
    "extraBody": {
      "thinking": {
        "type": "disabled"
      }
    }
  },
  "reranker": {
    "model": "deepseek-v4-flash",
    "extraBody": {
      "thinking": {
        "type": "disabled"
      }
    }
  },
  "stages": {
    "queryTransform": true,
    "sparse": false,
    "rerank": true,
    "pitfalls": true
  },
  "retrieval": {
    "denseTopK": 40,
    "denseNumCandidates": 200,
    "sparseTopK": 40,
    "rerankCandidates": 10,
    "rerankDocChars": 300,
    "rerankTopN": 5,
    "rrfK": 60
  },
  "store": "mongodb_atlas"
}
```

> Note: the array `2 8 9 3 44 81 92 45` is unsorted; binary search requires a sorted array. ManimRAG only grounds the request — handling that caveat is the downstream code-gen model's job.

---
## Step 1 — Query transformation  (`core/query-transform.ts`, model: glm-5.1)

Rewrites the casual prompt into an API-specific description via a forced tool call (structured output).

**Output (structured):**
```json
{
  "transformedQuery": "Visualize binary search on the array [2, 8, 9, 3, 44, 81, 92, 45] searching for target value 81. First sort the array to [2, 3, 8, 9, 44, 45, 81, 92] using Swap animation on Rectangle cells with Text labels arranged in a horizontal VGroup. Then perform binary search: initialize low=0 and high=7 pointers using Arrow mobjects pointing upward at the low and high indices, and a mid pointer Arrow in a different color. At each step, compute mid = (low+high)//2, highlight the mid cell with SurroundingRectangle and Indicate. Compare the mid value to the target 81 using MathTex comparison text. If mid value < target, FadeOut or color-grey the left half and shift low to mid+1 with MoveToTarget on the low Arrow. If mid value > target, FadeOut or color-grey the right half and shift high to mid-1. Repeat until mid value equals 81, then flash the found cell with Circumscribe and Flash. Display running low, mid, high indices as Integer labels and comparison results as MathTex text below the array.",
  "suggestedApis": [
    "VGroup",
    "Rectangle",
    "Text",
    "MathTex",
    "Integer",
    "Arrow",
    "SurroundingRectangle",
    "Indicate",
    "Circumscribe",
    "Flash",
    "FadeOut",
    "MoveToTarget",
    "Transform",
    "Swap",
    "LaggedStart",
    "AnimationGroup",
    "Write",
    "ValueTracker"
  ],
  "domain": "cs",
  "tags": [
    "binary-search",
    "sorted-array",
    "algorithm",
    "search",
    "pointer",
    "divide-and-conquer",
    "comparison",
    "swap"
  ],
  "estimatedComplexity": "intermediate"
}
```
**Latency:** 4455 ms   |   **Tokens:** prompt=2702, completion=578, total=3280

---
## Step 2 — Embedding  (`providers/embedder.ts`, model: bge-m3:latest, 1024-dim)

**Text actually embedded** (transformed query + suggested APIs):
```text
Visualize binary search on the array [2, 8, 9, 3, 44, 81, 92, 45] searching for target value 81. First sort the array to [2, 3, 8, 9, 44, 45, 81, 92] using Swap animation on Rectangle cells with Text labels arranged in a horizontal VGroup. Then perform binary search: initialize low=0 and high=7 pointers using Arrow mobjects pointing upward at the low and high indices, and a mid pointer Arrow in a different color. At each step, compute mid = (low+high)//2, highlight the mid cell with SurroundingRectangle and Indicate. Compare the mid value to the target 81 using MathTex comparison text. If mid value < target, FadeOut or color-grey the left half and shift low to mid+1 with MoveToTarget on the low Arrow. If mid value > target, FadeOut or color-grey the right half and shift high to mid-1. Repeat until mid value equals 81, then flash the found cell with Circumscribe and Flash. Display running low, mid, high indices as Integer labels and comparison results as MathTex text below the array.
Relevant Manim APIs: VGroup, Rectangle, Text, MathTex, Integer, Arrow, SurroundingRectangle, Indicate, Circumscribe, Flash, FadeOut, MoveToTarget, Transform, Swap, LaggedStart, AnimationGroup, Write, ValueTracker
```
**Output:** 1024-dim unit vector. First 8 values:
```text
[-0.08695, -0.03567, -0.04155, 0.00298, -0.02164, 0.04620, 0.01239, 0.03445, … ]  (L2 norm = 1.0000)
```
**Latency:** 1201 ms   |   **Tokens (input):** 349   |   no completion tokens (embeddings)

---
## Step 3 — Dense vector search  (Atlas `$vectorSearch`, cosine)

Search params: numCandidates=200, limit (denseTopK)=40.

**Output:** 40 candidates. Top 15 by cosine similarity:

| # | similarity | docType | title |
|---|-----------|---------|-------|
| 0 | 0.9342 | script | BinarySearchVisual |
| 1 | 0.8770 | script | BubbleSortVisual |
| 2 | 0.8551 | script | HashTableVisual |
| 3 | 0.8528 | script | LinkedListVisual |
| 4 | 0.8492 | script | MatrixMultiplicationVisual |
| 5 | 0.8326 | script | BarChartRace |
| 6 | 0.8314 | script | StackOperations |
| 7 | 0.8271 | api | manim.mobject.text.numbers.Variable |
| 8 | 0.8253 | api | manim.scene.vector_space_scene.VectorScene.get_vector_label |
| 9 | 0.8250 | script | BFSTraversal |
| 10 | 0.8244 | script | Opening Manim |
| 11 | 0.8244 | script | Opening Manim |
| 12 | 0.8244 | script | AnimatedCounter |
| 13 | 0.8242 | script | GradientDescentVisual |
| 14 | 0.8231 | api | manim.scene.vector_space_scene.VectorScene.coords_to_vector |

**Latency:** 155 ms   |   tokens: n/a (vector DB)

---
## Step 4 — Rerank  (`core/rerank.ts`, LLM-as-reranker, model: deepseek-v4-flash)

**Input to reranker** (10 candidates, each truncated to 300 chars):
```text
[0] BinarySearchVisual — Visualizes binary search on a sorted integer array. Creates a horizontal VGroup of Rectangle cells with centered Text labels representing array elements. Uses a downward-pointing Arrow above the array to indicate the current mid-index. Animates the search range shrinking by Fade
[1] BubbleSortVisual — Visualizes bubble sort on an array using vertical bars (Rectangles) whose heights represent values. Each comparison highlights the two compared bars in yellow using Indicate. When a swap occurs, both bars animate their positions using .animate.move_to(). After each full pass, the 
[2] HashTableVisual — Visualizes a hash table with separate chaining for collision resolution. The hash table is an array of slots shown as Rectangle cells arranged vertically, each labeled with an index. A hash function computation is shown as MathTex animating with Write. When a key is inserted, an ar
[3] LinkedListVisual — Visualizes a singly linked list with rectangular nodes containing data and next-pointer fields. Each node is a VGroup containing two Rectangle sections (data box and pointer box) with Text labels. Nodes are connected by curved Arrows representing next pointers. Demonstrates insert
[4] MatrixMultiplicationVisual — Visualizes 2x2 matrix multiplication step by step. Uses MathTex to display two input matrices and the result matrix. SurroundingRectangles highlight the active row of matrix A and active column of matrix B. For each result cell, arrows animate from the highlighted row an
[5] BarChartRace — Animated bar chart where bars grow and change values over multiple data frames. Uses a VGroup of Rectangles for bars where each bar's height is proportional to its value. Value labels sit atop each bar as Text. At each time step, all bars animate their heights simultaneously using .an
[6] StackOperations — Animates push and pop operations on a stack data structure. The stack is represented as a vertical VGroup of Rectangle elements with Text labels. Push operations animate a new element sliding in from the right and landing on top of the stack with a FadeIn + shift UP animation. Pop 
[7] manim.mobject.text.numbers.Variable — Manim class: Variable Module: manim.mobject.text.numbers | Category: mobjects Inherits from: VMobject What it does: A class for displaying text that shows "label = value" with the value continuously updated from a ValueTracker. Parameters: var: The initial value
[8] manim.scene.vector_space_scene.VectorScene.get_vector_label — Manim method: VectorScene.get_vector_label() Module: manim.scene.vector_space_scene | Category: scenes Signature: VectorScene.get_vector_label(vector, label, at_tip=False, direction='left', rotate=False, color=None, label_scale_factor=LAR
[9] BFSTraversal — Visualizes BFS traversal on an undirected graph. Nodes are Circles with Text labels, positioned manually on screen. Edges are Lines connecting node pairs. A VGroup holds all nodes and edges. BFS proceeds level by level: unvisited nodes are gray, the queue frontier is yellow (#F59E0B),
```
**Raw reranker response:**
```text
[{"index": 0, "score": 0.85}, {"index": 1, "score": 0.0}, {"index": 2, "score": 0.0}, {"index": 3, "score": 0.0}, {"index": 4, "score": 0.0}, {"index": 5, "score": 0.0}, {"index": 6, "score": 0.0}, {"index": 7, "score": 0.1}, {"index": 8, "score": 0.0}, {"index": 9, "score": 0.0}]
```
**Reordering (dense rank → rerank score):**

| rerank # | score | docType | title |
|----------|-------|---------|-------|
| 0 | 0.85 | script | BinarySearchVisual |
| 1 | 0.10 | api | manim.mobject.text.numbers.Variable |
| 2 | 0.00 | script | BubbleSortVisual |
| 3 | 0.00 | script | HashTableVisual |
| 4 | 0.00 | script | LinkedListVisual |
| 5 | 0.00 | script | MatrixMultiplicationVisual |
| 6 | 0.00 | script | BarChartRace |
| 7 | 0.00 | script | StackOperations |
| 8 | 0.00 | api | manim.scene.vector_space_scene.VectorScene.get_vector_label |
| 9 | 0.00 | script | BFSTraversal |

**Latency:** 1920 ms   |   **Tokens:** prompt=1016, completion=141, total=1157

---
## Step 5 — Context assembly  (`core/assemble.ts`)

Buckets the reranked hits by docType and derives style + pitfalls.

- **apiExamples:** 2
- **similarScripts:** 5
- **styleRecommendations:** 6
- **pitfalls:** 6

**apiExamples:**
```json
[
  {
    "symbol": "manim.mobject.text.numbers.Variable",
    "category": "mobjects",
    "signature": "",
    "score": 0.1,
    "snippetChars": 1574
  },
  {
    "symbol": "manim.scene.vector_space_scene.VectorScene.get_vector_label",
    "category": "scenes",
    "signature": "VectorScene.get_vector_label(vector, label, at_tip=False, direction='left', rotate=False, color=None, label_scale_factor=LARGE_BUFF - 0.2)",
    "score": 0,
    "snippetChars": 0
  }
]
```
**similarScripts:**
```json
[
  {
    "title": "BinarySearchVisual",
    "apisUsed": [
      "VGroup",
      "Rectangle",
      "Text",
      "Arrow",
      "SurroundingRectangle",
      "Indicate",
      "FadeOut",
      "FadeIn"
    ],
    "complexity": "intermediate",
    "score": 0.85,
    "codeChars": 2220
  },
  {
    "title": "BubbleSortVisual",
    "apisUsed": [
      "VGroup",
      "Rectangle",
      "Text",
      "Indicate",
      "AnimationGroup"
    ],
    "complexity": "intermediate",
    "score": 0,
    "codeChars": 2169
  },
  {
    "title": "HashTableVisual",
    "apisUsed": [
      "VGroup",
      "Rectangle",
      "Text",
      "Arrow",
      "MathTex",
      "FadeIn",
      "Write"
    ],
    "complexity": "intermediate",
    "score": 0,
    "codeChars": 3061
  },
  {
    "title": "LinkedListVisual",
    "apisUsed": [
      "VGroup",
      "Rectangle",
      "Text",
      "Arrow",
      "CurvedArrow",
      "FadeIn",
      "Write"
    ],
    "complexity": "intermediate",
    "score": 0,
    "codeChars": 3206
  },
  {
    "title": "MatrixMultiplicationVisual",
    "apisUsed": [
      "MathTex",
      "SurroundingRectangle",
      "Arrow",
      "AnimationGroup",
      "Transform",
      "VGroup"
    ],
    "complexity": "intermediate",
    "score": 0,
    "codeChars": 2399
  }
]
```
**styleRecommendations:**
```json
[
  "Reuse the palette seen in similar scenes: #1a1a2e, #3B82F6, #F59E0B, #10B981, #8B5CF6, #EF4444.",
  "Reveal groups of mobjects with LaggedStart(*anims, lag_ratio=0.1) for a staggered, polished entrance rather than one big simultaneous play().",
  "For data-structure/algorithm scenes, represent elements as a VGroup of Square/Rectangle cells with centered Text, and use Indicate or SurroundingRectangle to highlight the active element each step.",
  "Set a dark, consistent background (e.g. self.camera.background_color = \"#1a1a2e\") and a small, cohesive color palette.",
  "Use Text() for labels and titles with a sensible font_size; reserve MathTex for actual mathematics.",
  "Give animations deliberate run_time and rate_func (smooth, there_and_back) so motion reads clearly rather than snapping."
]
```
**pitfalls:**
```json
[
  "Transform(a, b) morphs `a` into `b` but keeps `a` on screen (b is discarded); use ReplacementTransform(a, b) when you want `b` to be the mobject that remains. Mixing them up leaves stale mobjects on screen.",
  "MathTex/Tex require a working LaTeX install at render time and use math mode by default. Escape backslashes in Python strings (use raw strings r\"\\frac{a}{b}\") and prefer Text() for plain (non-math) labels to avoid LaTeX failures.",
  "A mobject does not follow a ValueTracker automatically. Wrap it in always_redraw(lambda: ...) or attach add_updater(); animate the value with tracker.animate.set_value(x), and read it with tracker.get_value().",
  "VGroup(*mobjects).arrange(RIGHT, buff=0.5) lays children out; arrange() mutates positions, so add the group to the scene AFTER arranging. Use arrange_in_grid(rows=, cols=) for tables/matrices of cells.",
  "FadeIn(mob, shift=UP) and FadeOut(mob, shift=DOWN) add directional motion to the fade. Passing run_time and rate_func to self.play() controls pacing for any of these intro/outro animations.",
  "Start every file with `from manim import *` and define exactly one Scene subclass whose construct(self) method builds the animation."
]
```
**Latency:** 3 ms   |   tokens: n/a (local assembly)

---
## Final output

### groundedPrompt (the headline output — fed to the code-gen model)
```text
# Manim Animation Task

TASK: Explain binary search with a proper example on this array: 2 8 9 3 44 81 92 45 and searching for element 81

INTERPRETATION: Visualize binary search on the array [2, 8, 9, 3, 44, 81, 92, 45] searching for target value 81. First sort the array to [2, 3, 8, 9, 44, 45, 81, 92] using Swap animation on Rectangle cells with Text labels arranged in a horizontal VGroup. Then perform binary search: initialize low=0 and high=7 pointers using Arrow mobjects pointing upward at the low and high indices, and a mid pointer Arrow in a different color. At each step, compute mid = (low+high)//2, highlight the mid cell with SurroundingRectangle and Indicate. Compare the mid value to the target 81 using MathTex comparison text. If mid value < target, FadeOut or color-grey the left half and shift low to mid+1 with MoveToTarget on the low Arrow. If mid value > target, FadeOut or color-grey the right half and shift high to mid-1. Repeat until mid value equals 81, then flash the found cell with Circumscribe and Flash. Display running low, mid, high indices as Integer labels and comparison results as MathTex text below the array.

Generate a complete, runnable Manim Community v0.19 Python scene for the task above.

## Likely-relevant Manim APIs
VGroup, Rectangle, Text, MathTex, Integer, Arrow, SurroundingRectangle, Indicate, Circumscribe, Flash, FadeOut, MoveToTarget, Transform, Swap, LaggedStart, AnimationGroup, Write, ValueTracker, FadeIn, Variable

## Relevant API reference (2)
### manim.mobject.text.numbers.Variable
Manim class: Variable
Module: manim.mobject.text.numbers | Category: mobjects
Inherits from: VMobject

What it does: A class for displaying text that shows "label = value" with
the value continuously updated from a ValueTracker.

Parameters:
  var: The initial value you need to keep track of and display.
  label: The label for your variable. Raw strings are convertex to MathTex objects.
  var_type: The class used for displaying the number. Defaults to DecimalNumber.
  num_decimal_places: The num
```python
class VariablesWithValueTracker(Scene):
    def construct(self):
        var = 0.5
        on_screen_var = Variable(var, Text("var"), num_decimal_places=3)

        # You can also change the colours for the label and value
        on_screen_var.label.set_color(RED)
        on_screen_var.value.set_color(GREEN)

        self.play(Write(on_screen_var))
        # The above line will just display the variable with
        # its initial value on the screen. If you also wish to
        # update it, you can do so by accessing the `tracker` attribute
        self.wait()
        var_tracker = on_screen_var.tracker
        var = 10.5
        self.play(var_tracker.animate.set_value(var))
        self.wait()

        int_var = 0
        on_screen_int_var = Variable(
            int_var, Text("int_var"), var_type=Integer
        ).next_to(on_screen_var, DOWN)
        on_screen_int_var.label.set_color(RED)
        on_screen_int_var.value.set_color(GREEN)

        self.play(Write(on_screen_int_var))
        self.wait()
        var_tracker = on_screen_int_var.tracker
        var = 10.5
        self.play(var_tracker.animate.set_value(var))
        self.wait()

        # If you wish to have a somewhat more complicated label for your
        # variable with subscripts, superscripts, etc. the default class
        # for the label is MathTex
        subscript_label_var = 10
        on_screen_subscript_var = Variable(subscript_label_var, "{a}_{i}").next_to(
            on_screen_int_var, DOWN
        )
        self.play(Write(on_screen_subscript_var))
        self.wait()
```

### manim.scene.vector_space_scene.VectorScene.get_vector_label — VectorScene.get_vector_label(vector, label, at_tip=False, direction='left', rotate=False, color=None, label_scale_factor=LARGE_BUFF - 0.2)
Manim method: VectorScene.get_vector_label()
Module: manim.scene.vector_space_scene | Category: scenes

Signature: VectorScene.get_vector_label(vector, label, at_tip=False, direction='left', rotate=False, color=None, label_scale_factor=LARGE_BUFF - 0.2)

What it does: Returns naming labels for the passed vector.

Parameters:
  vector: Vector Object for which to get the label.
  at_tip: Whether or not to place the label at the tip of the vector.
  direction: If the label should be on the "left" o

## Similar complete scenes (5 — study the patterns)
### Example 1: BinarySearchVisual
Visualizes binary search on a sorted integer array. Creates a horizontal VGroup of Rectangle cells with centered Text labels representing array elements. Uses a downward-pointing Arrow above the array to indicate the current mid-index. Animates the search range shrinking by FadeOut-ing elements outside the current window. Uses SurroundingRectangle and Indicate to highlight the mid-element during c
APIs: VGroup, Rectangle, Text, Arrow, SurroundingRectangle, Indicate, FadeOut, FadeIn
```python
from manim import *

class BinarySearchVisual(Scene):
    def construct(self):
        self.camera.background_color = "#1a1a2e"

        arr = [2, 5, 8, 12, 16, 23, 38, 45, 56, 72]
        target = 23

        cells = VGroup(*[
            VGroup(
                Rectangle(width=0.8, height=0.8, fill_color="#3B82F6",
                          fill_opacity=0.8, stroke_color=WHITE, stroke_width=1),
                Text(str(v), font_size=22, color=WHITE)
            ).arrange(buff=0)
            for v in arr
        ]).arrange(RIGHT, buff=0.05)
        cells.move_to(ORIGIN)

        title = Text("Binary Search", font_size=36, color=WHITE).to_edge(UP, buff=0.5)
        target_text = Text(f"Target: {target}", font_size=24, color="#F59E0B").next_to(title, DOWN)

        self.play(Write(title), FadeIn(target_text))
        self.play(Create(cells))
        self.wait(0.5)

        arrow = Arrow(start=UP * 0.8, end=UP * 0.1, color="#F59E0B", buff=0.05)

        lo, hi = 0, len(arr) - 1
        found = False

        while lo <= hi:
            mid = (lo + hi) // 2
            mid_cell = cells[mid]

            arrow.next_to(mid_cell, UP, buff=0.1)
            if lo == 0 and hi == len(arr) - 1:
                self.play(GrowArrow(arrow))
            else:
                self.play(arrow.animate.next_to(mid_cell, UP, buff=0.1))

            self.play(Indicate(mid_cell, color="#F59E0B", scale_factor=1.15))

            if arr[mid] == target:
                self.play(
                    mid_cell[0].animate.set_fill("#10B981"),
                    arrow.animate.set_color("#10B981")
                )
                found_text = Text("Found!", font_size=28, color="#10B981").next_to(cells, DOWN, buff=0.5)
                self.play(Write(found_text))
                found = True
                break
            elif arr[mid] < target:
                lo = mid + 1
                fade_out = VGroup(*[cells[i] for i in range(mid + 1)])
                self.play(fade_out.animate.set_opacity(0.2))
            else:
                hi = mid - 1
                fade_out = VGroup(*[cells[i] for i in range(mid, len(arr))])
                self.play(fade_out.animate.set_opacity(0.2))

        self.wait(1)
```

### Example 2: BubbleSortVisual
Visualizes bubble sort on an array using vertical bars (Rectangles) whose heights represent values. Each comparison highlights the two compared bars in yellow using Indicate. When a swap occurs, both bars animate their positions using .animate.move_to(). After each full pass, the sorted portion at the right is highlighted in green. Uses a VGroup of Rectangles arranged horizontally. The animation s
APIs: VGroup, Rectangle, Text, Indicate, AnimationGroup
```python
from manim import *

class BubbleSortVisual(Scene):
    def construct(self):
        self.camera.background_color = "#1a1a2e"
        values = [64, 34, 25, 12, 22, 11, 90]
        n = len(values)
        bar_width = 0.7
        max_val = max(values)
        scale = 3.0 / max_val

        def make_bars(vals):
            bars = VGroup()
            for v in vals:
                bar = Rectangle(
                    width=bar_width,
                    height=v * scale,
                    fill_color="#3B82F6",
                    fill_opacity=0.9,
                    stroke_color=WHITE,
                    stroke_width=1
                )
                label = Text(str(v), font_size=18, color=WHITE)
                label.next_to(bar, DOWN, buff=0.1)
                grp = VGroup(bar, label)
                bars.add(grp)
            bars.arrange(RIGHT, buff=0.1, aligned_edge=DOWN)
            bars.move_to(ORIGIN)
            return bars

        bars = make_bars(values)
        title = Text("Bubble Sort", font_size=36, color=WHITE).to_edge(UP, buff=0.5)
        self.play(Write(title), Create(bars))
        self.wait(0.5)

        for i in range(n - 1):
            for j in range(n - i - 1):
                b1, b2 = bars[j], bars[j + 1]
                self.play(
                    b1[0].animate.set_fill("#F59E0B"),
                    b2[0].animate.set_fill("#F59E0B"),
                    run_time=0.2
                )
                if values[j] > values[j + 1]:
                    values[j], values[j + 1] = values[j + 1], values[j]
                    p1 = b1.get_center()
                    p2 = b2.get_center()
                    self.play(
                        b1.animate.move_to(p2),
                        b2.animate.move_to(p1),
                        run_time=0.4
                    )
                    bars[j], bars[j + 1] = bars[j + 1], bars[j]
                self.play(
                    bars[j][0].animate.set_fill("#3B82F6"),
                    bars[j + 1][0].animate.set_fill("#3B82F6"),
                    run_time=0.15
                )
            bars[n - 1 - i][0].set_fill("#10B981")

        self.wait(1)
```

### Example 3: HashTableVisual
Visualizes a hash table with separate chaining for collision resolution. The hash table is an array of slots shown as Rectangle cells arranged vertically, each labeled with an index. A hash function computation is shown as MathTex animating with Write. When a key is inserted, an arrow animates from the key to the computed bucket index. Chains (linked lists) extend rightward from collision buckets.
APIs: VGroup, Rectangle, Text, Arrow, MathTex, FadeIn, Write
```python
from manim import *

class HashTableVisual(Scene):
    def construct(self):
        self.camera.background_color = "#1a1a2e"

        SIZE = 7
        CELL_W, CELL_H = 0.9, 0.55
        table_x = LEFT * 4

        # Build table slots
        slots = VGroup()
        slot_labels = VGroup()
        slot_content = {}
        for i in range(SIZE):
            cell = Rectangle(width=CELL_W, height=CELL_H,
                            fill_color="#1F2937", fill_opacity=0.9,
                            stroke_color="#6B7280", stroke_width=1.5)
            idx_label = Text(str(i), font_size=18, color="#9CA3AF")
            cell.move_to(table_x + DOWN * (i - SIZE // 2) * CELL_H)
            idx_label.next_to(cell, LEFT, buff=0.2)
            slots.add(cell)
            slot_labels.add(idx_label)
            slot_content[i] = []

        title = Text("Hash Table", font_size=32, color=WHITE).to_edge(UP, buff=0.4)
        hash_formula = MathTex(r"h(k) = k \mod 7", font_size=26, color="#F59E0B")
        hash_formula.to_corner(UR, buff=0.8)

        self.play(Write(title), Write(hash_formula))
        self.play(Create(slots), FadeIn(slot_labels))
        self.wait(0.3)

        keys = [15, 8, 43, 22, 1, 36, 57]
        colors = ["#3B82F6", "#10B981", "#8B5CF6", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"]

        for key, color in zip(keys, colors):
            bucket = key % SIZE

            # Show key appearing on the right
            key_box = VGroup(
                Rectangle(width=0.7, height=0.5, fill_color=color,
                         fill_opacity=0.8, stroke_color=WHITE, stroke_width=1.2),
                Text(str(key), font_size=20, color=WHITE)
            )
            key_box.move_to(RIGHT * 2.5)
            self.play(FadeIn(key_box, shift=LEFT * 0.3), run_time=0.4)

            # Show hash computation
            calc = MathTex(f"h({key}) = {key} \\mod 7 = {bucket}",
                          font_size=20, color=WHITE).to_edge(DOWN, buff=0.7)
            self.play(Write(calc), run_time=0.5)

            # Arrow to bucket
            target_cell = slots[bucket]
            chain_pos = target_cell.get_right() + RIGHT * (0.9 * (len(slot_content[bucket]) + 1))

            arrow = Arrow(
                start=key_box.get_left(),
                end=chain_pos + LEFT * 0.35,
                color=color, buff=0.05, stroke_width=2,
                max_tip_length_to_length_ratio=0.2
            )
            self.play(GrowArrow(arrow), run_time=0.5)

            # Place in chain
            chain_box = VGroup(
                Rectangle(width=0.7, height=0.5, fill_color=color,
                         fill_opacity=0.8, stroke_color=WHITE, stroke_width=1.2),
                Text(str(key), font_size=18, color=WHITE)
            ).move_to(chain_pos)
            self.play(
                FadeIn(chain_box),
                FadeOut(key_box),
                FadeOut(arrow),
                FadeOut(calc),
                run_time=0.4
            )
            slot_content[bucket].append(chain_box)

        self.wait(1)
```

### Example 4: LinkedListVisual
Visualizes a singly linked list with rectangular nodes containing data and next-pointer fields. Each node is a VGroup containing two Rectangle sections (data box and pointer box) with Text labels. Nodes are connected by curved Arrows representing next pointers. Demonstrates insertion by creating a new node, animating it fading in above the list, then updating arrow connections to wire it in. The h
APIs: VGroup, Rectangle, Text, Arrow, CurvedArrow, FadeIn, Write
```python
from manim import *

class LinkedListVisual(Scene):
    def construct(self):
        self.camera.background_color = "#1a1a2e"

        def make_node(val, color="#3B82F6"):
            data_box = Rectangle(width=0.8, height=0.6, fill_color=color,
                                 fill_opacity=0.85, stroke_color=WHITE, stroke_width=1.5)
            next_box = Rectangle(width=0.5, height=0.6, fill_color="#374151",
                                 fill_opacity=0.85, stroke_color=WHITE, stroke_width=1.5)
            data_text = Text(str(val), font_size=22, color=WHITE)
            next_text = Text("→", font_size=18, color="#9CA3AF")
            data_group = VGroup(data_box, data_text)
            next_group = VGroup(next_box, next_text)
            row = VGroup(data_group, next_group).arrange(RIGHT, buff=0)
            return row

        values = [10, 20, 40, 50]
        nodes = VGroup(*[make_node(v) for v in values])
        nodes.arrange(RIGHT, buff=0.6)
        nodes.move_to(ORIGIN)

        head_arrow = Arrow(
            start=nodes[0].get_top() + UP * 0.5,
            end=nodes[0].get_top(),
            color="#F59E0B", buff=0.05
        )
        head_label = Text("head", font_size=18, color="#F59E0B")
        head_label.next_to(head_arrow, UP, buff=0.1)

        arrows = VGroup()
        for i in range(len(nodes) - 1):
            a = Arrow(
                start=nodes[i][1].get_right(),
                end=nodes[i + 1][0].get_left(),
                color=WHITE, buff=0.05, stroke_width=2
            )
            arrows.add(a)

        null_box = Rectangle(width=0.5, height=0.6, fill_color="#1F2937",
                             fill_opacity=0.9, stroke_color="#EF4444", stroke_width=1.5)
        null_text = Text("NULL", font_size=14, color="#EF4444")
        null_group = VGroup(null_box, null_text).next_to(nodes[-1], RIGHT, buff=0.6)
        last_arrow = Arrow(
            start=nodes[-1][1].get_right(),
            end=null_group.get_left(),
            color=WHITE, buff=0.05, stroke_width=2
        )

        title = Text("Linked List", font_size=34, color=WHITE).to_edge(UP, buff=0.5)
        self.play(Write(title))
        self.play(Create(nodes), GrowArrow(head_arrow), Write(head_label))
        self.play(*[GrowArrow(a) for a in arrows], GrowArrow(last_arrow), FadeIn(null_group))
        self.wait(1)

        # Insert node with value 30 between 20 and 40
        new_node = make_node(30, color="#8B5CF6")
        insert_label = Text("Insert 30", font_size=20, color="#8B5CF6").to_edge(DOWN, buff=0.8)
        self.play(Write(insert_label))

        new_node.next_to(nodes[1], DOWN, buff=1.0)
        self.play(FadeIn(new_node, shift=DOWN * 0.3))
        self.wait(0.5)

        # Animate pointer update
        new_arrow_1 = Arrow(
            start=nodes[1][1].get_right(),
            end=new_node[0].get_top(),
            color="#8B5CF6", buff=0.05
        )
        new_arrow_2 = Arrow(
            start=new_node[1].get_right(),
            end=nodes[2][0].get_left(),
            color="#8B5CF6", buff=0.05
        )
        self.play(
            Transform(arrows[1], new_arrow_1),
            GrowArrow(new_arrow_2)
        )
        self.wait(1)
```

### Example 5: MatrixMultiplicationVisual
Visualizes 2x2 matrix multiplication step by step. Uses MathTex to display two input matrices and the result matrix. SurroundingRectangles highlight the active row of matrix A and active column of matrix B. For each result cell, arrows animate from the highlighted row and column to the result position, and the multiplication calculation is shown as a MathTex expression that Transform-s into the nu
APIs: MathTex, SurroundingRectangle, Arrow, AnimationGroup, Transform, VGroup
```python
from manim import *

class MatrixMultiplicationVisual(Scene):
    def construct(self):
        self.camera.background_color = "#0f0f23"

        A = [[1, 2], [3, 4]]
        B = [[5, 6], [7, 8]]
        C = [[A[i][0]*B[0][j] + A[i][1]*B[1][j] for j in range(2)] for i in range(2)]

        def make_matrix(data, color=WHITE):
            entries = [[str(v) for v in row] for row in data]
            return Matrix(entries, element_to_mobject_config={"color": color})

        mat_a = make_matrix(A, "#3B82F6")
        mat_b = make_matrix(B, "#F59E0B")
        mat_c = make_matrix([["?" for _ in row] for row in C], "#10B981")

        times = MathTex(r"\times", font_size=36, color=WHITE)
        equals = MathTex(r"=", font_size=36, color=WHITE)

        equation = VGroup(mat_a, times, mat_b, equals, mat_c).arrange(RIGHT, buff=0.5)
        equation.move_to(ORIGIN)

        title = Text("Matrix Multiplication", font_size=32, color=WHITE).to_edge(UP, buff=0.4)
        self.play(Write(title))
        self.play(Write(mat_a), Write(times), Write(mat_b), Write(equals), Write(mat_c))
        self.wait(0.5)

        for i in range(2):
            for j in range(2):
                row_highlight = SurroundingRectangle(
                    VGroup(*[mat_a.get_rows()[i]]), color="#3B82F6", buff=0.1
                )
                col_highlight = SurroundingRectangle(
                    VGroup(*[mat_b.get_columns()[j]]), color="#F59E0B", buff=0.1
                )
                self.play(
                    Create(row_highlight),
                    Create(col_highlight),
                    run_time=0.4
                )

                calc = MathTex(
                    f"{A[i][0]} \\cdot {B[0][j]} + {A[i][1]} \\cdot {B[1][j]} = {C[i][j]}",
                    font_size=24, color=WHITE
                ).to_edge(DOWN, buff=0.8)
                self.play(Write(calc), run_time=0.5)

                result_entry = mat_c.get_entries()[i * 2 + j]
                new_val = MathTex(str(C[i][j]), font_size=36, color="#10B981")
                new_val.move_to(result_entry.get_center())
                self.play(Transform(result_entry, new_val), run_time=0.4)

                self.play(
                    FadeOut(row_highlight),
                    FadeOut(col_highlight),
                    FadeOut(calc),
                    run_time=0.3
                )

        self.wait(1)
```

## Style guidance
- Reuse the palette seen in similar scenes: #1a1a2e, #3B82F6, #F59E0B, #10B981, #8B5CF6, #EF4444.
- Reveal groups of mobjects with LaggedStart(*anims, lag_ratio=0.1) for a staggered, polished entrance rather than one big simultaneous play().
- For data-structure/algorithm scenes, represent elements as a VGroup of Square/Rectangle cells with centered Text, and use Indicate or SurroundingRectangle to highlight the active element each step.
- Set a dark, consistent background (e.g. self.camera.background_color = "#1a1a2e") and a small, cohesive color palette.
- Use Text() for labels and titles with a sensible font_size; reserve MathTex for actual mathematics.
- Give animations deliberate run_time and rate_func (smooth, there_and_back) so motion reads clearly rather than snapping.

## Pitfalls to avoid
- Transform(a, b) morphs `a` into `b` but keeps `a` on screen (b is discarded); use ReplacementTransform(a, b) when you want `b` to be the mobject that remains. Mixing them up leaves stale mobjects on screen.
- MathTex/Tex require a working LaTeX install at render time and use math mode by default. Escape backslashes in Python strings (use raw strings r"\frac{a}{b}") and prefer Text() for plain (non-math) labels to avoid LaTeX failures.
- A mobject does not follow a ValueTracker automatically. Wrap it in always_redraw(lambda: ...) or attach add_updater(); animate the value with tracker.animate.set_value(x), and read it with tracker.get_value().
- VGroup(*mobjects).arrange(RIGHT, buff=0.5) lays children out; arrange() mutates positions, so add the group to the scene AFTER arranging. Use arrange_in_grid(rows=, cols=) for tables/matrices of cells.
- FadeIn(mob, shift=UP) and FadeOut(mob, shift=DOWN) add directional motion to the fade. Passing run_time and rate_func to self.play() controls pacing for any of these intro/outro animations.
- Start every file with `from manim import *` and define exactly one Scene subclass whose construct(self) method builds the animation.

## Output requirements
- Use `from manim import *` and define a single Scene subclass.
- Target Manim Community v0.19. Do NOT copy the examples verbatim — adapt their patterns to the task.
- Ensure the code is self-contained and runnable with `manim -pql`.
```

### Full similarScripts code (what the code-gen model studies)
#### BinarySearchVisual  (score 0.85)
```python
from manim import *

class BinarySearchVisual(Scene):
    def construct(self):
        self.camera.background_color = "#1a1a2e"

        arr = [2, 5, 8, 12, 16, 23, 38, 45, 56, 72]
        target = 23

        cells = VGroup(*[
            VGroup(
                Rectangle(width=0.8, height=0.8, fill_color="#3B82F6",
                          fill_opacity=0.8, stroke_color=WHITE, stroke_width=1),
                Text(str(v), font_size=22, color=WHITE)
            ).arrange(buff=0)
            for v in arr
        ]).arrange(RIGHT, buff=0.05)
        cells.move_to(ORIGIN)

        title = Text("Binary Search", font_size=36, color=WHITE).to_edge(UP, buff=0.5)
        target_text = Text(f"Target: {target}", font_size=24, color="#F59E0B").next_to(title, DOWN)

        self.play(Write(title), FadeIn(target_text))
        self.play(Create(cells))
        self.wait(0.5)

        arrow = Arrow(start=UP * 0.8, end=UP * 0.1, color="#F59E0B", buff=0.05)

        lo, hi = 0, len(arr) - 1
        found = False

        while lo <= hi:
            mid = (lo + hi) // 2
            mid_cell = cells[mid]

            arrow.next_to(mid_cell, UP, buff=0.1)
            if lo == 0 and hi == len(arr) - 1:
                self.play(GrowArrow(arrow))
            else:
                self.play(arrow.animate.next_to(mid_cell, UP, buff=0.1))

            self.play(Indicate(mid_cell, color="#F59E0B", scale_factor=1.15))

            if arr[mid] == target:
                self.play(
                    mid_cell[0].animate.set_fill("#10B981"),
                    arrow.animate.set_color("#10B981")
                )
                found_text = Text("Found!", font_size=28, color="#10B981").next_to(cells, DOWN, buff=0.5)
                self.play(Write(found_text))
                found = True
                break
            elif arr[mid] < target:
                lo = mid + 1
                fade_out = VGroup(*[cells[i] for i in range(mid + 1)])
                self.play(fade_out.animate.set_opacity(0.2))
            else:
                hi = mid - 1
                fade_out = VGroup(*[cells[i] for i in range(mid, len(arr))])
                self.play(fade_out.animate.set_opacity(0.2))

        self.wait(1)

```
#### BubbleSortVisual  (score 0)
```python
from manim import *

class BubbleSortVisual(Scene):
    def construct(self):
        self.camera.background_color = "#1a1a2e"
        values = [64, 34, 25, 12, 22, 11, 90]
        n = len(values)
        bar_width = 0.7
        max_val = max(values)
        scale = 3.0 / max_val

        def make_bars(vals):
            bars = VGroup()
            for v in vals:
                bar = Rectangle(
                    width=bar_width,
                    height=v * scale,
                    fill_color="#3B82F6",
                    fill_opacity=0.9,
                    stroke_color=WHITE,
                    stroke_width=1
                )
                label = Text(str(v), font_size=18, color=WHITE)
                label.next_to(bar, DOWN, buff=0.1)
                grp = VGroup(bar, label)
                bars.add(grp)
            bars.arrange(RIGHT, buff=0.1, aligned_edge=DOWN)
            bars.move_to(ORIGIN)
            return bars

        bars = make_bars(values)
        title = Text("Bubble Sort", font_size=36, color=WHITE).to_edge(UP, buff=0.5)
        self.play(Write(title), Create(bars))
        self.wait(0.5)

        for i in range(n - 1):
            for j in range(n - i - 1):
                b1, b2 = bars[j], bars[j + 1]
                self.play(
                    b1[0].animate.set_fill("#F59E0B"),
                    b2[0].animate.set_fill("#F59E0B"),
                    run_time=0.2
                )
                if values[j] > values[j + 1]:
                    values[j], values[j + 1] = values[j + 1], values[j]
                    p1 = b1.get_center()
                    p2 = b2.get_center()
                    self.play(
                        b1.animate.move_to(p2),
                        b2.animate.move_to(p1),
                        run_time=0.4
                    )
                    bars[j], bars[j + 1] = bars[j + 1], bars[j]
                self.play(
                    bars[j][0].animate.set_fill("#3B82F6"),
                    bars[j + 1][0].animate.set_fill("#3B82F6"),
                    run_time=0.15
                )
            bars[n - 1 - i][0].set_fill("#10B981")

        self.wait(1)

```
#### HashTableVisual  (score 0)
```python
from manim import *

class HashTableVisual(Scene):
    def construct(self):
        self.camera.background_color = "#1a1a2e"

        SIZE = 7
        CELL_W, CELL_H = 0.9, 0.55
        table_x = LEFT * 4

        # Build table slots
        slots = VGroup()
        slot_labels = VGroup()
        slot_content = {}
        for i in range(SIZE):
            cell = Rectangle(width=CELL_W, height=CELL_H,
                            fill_color="#1F2937", fill_opacity=0.9,
                            stroke_color="#6B7280", stroke_width=1.5)
            idx_label = Text(str(i), font_size=18, color="#9CA3AF")
            cell.move_to(table_x + DOWN * (i - SIZE // 2) * CELL_H)
            idx_label.next_to(cell, LEFT, buff=0.2)
            slots.add(cell)
            slot_labels.add(idx_label)
            slot_content[i] = []

        title = Text("Hash Table", font_size=32, color=WHITE).to_edge(UP, buff=0.4)
        hash_formula = MathTex(r"h(k) = k \mod 7", font_size=26, color="#F59E0B")
        hash_formula.to_corner(UR, buff=0.8)

        self.play(Write(title), Write(hash_formula))
        self.play(Create(slots), FadeIn(slot_labels))
        self.wait(0.3)

        keys = [15, 8, 43, 22, 1, 36, 57]
        colors = ["#3B82F6", "#10B981", "#8B5CF6", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"]

        for key, color in zip(keys, colors):
            bucket = key % SIZE

            # Show key appearing on the right
            key_box = VGroup(
                Rectangle(width=0.7, height=0.5, fill_color=color,
                         fill_opacity=0.8, stroke_color=WHITE, stroke_width=1.2),
                Text(str(key), font_size=20, color=WHITE)
            )
            key_box.move_to(RIGHT * 2.5)
            self.play(FadeIn(key_box, shift=LEFT * 0.3), run_time=0.4)

            # Show hash computation
            calc = MathTex(f"h({key}) = {key} \\mod 7 = {bucket}",
                          font_size=20, color=WHITE).to_edge(DOWN, buff=0.7)
            self.play(Write(calc), run_time=0.5)

            # Arrow to bucket
            target_cell = slots[bucket]
            chain_pos = target_cell.get_right() + RIGHT * (0.9 * (len(slot_content[bucket]) + 1))

            arrow = Arrow(
                start=key_box.get_left(),
                end=chain_pos + LEFT * 0.35,
                color=color, buff=0.05, stroke_width=2,
                max_tip_length_to_length_ratio=0.2
            )
            self.play(GrowArrow(arrow), run_time=0.5)

            # Place in chain
            chain_box = VGroup(
                Rectangle(width=0.7, height=0.5, fill_color=color,
                         fill_opacity=0.8, stroke_color=WHITE, stroke_width=1.2),
                Text(str(key), font_size=18, color=WHITE)
            ).move_to(chain_pos)
            self.play(
                FadeIn(chain_box),
                FadeOut(key_box),
                FadeOut(arrow),
                FadeOut(calc),
                run_time=0.4
            )
            slot_content[bucket].append(chain_box)

        self.wait(1)

```
#### LinkedListVisual  (score 0)
```python
from manim import *

class LinkedListVisual(Scene):
    def construct(self):
        self.camera.background_color = "#1a1a2e"

        def make_node(val, color="#3B82F6"):
            data_box = Rectangle(width=0.8, height=0.6, fill_color=color,
                                 fill_opacity=0.85, stroke_color=WHITE, stroke_width=1.5)
            next_box = Rectangle(width=0.5, height=0.6, fill_color="#374151",
                                 fill_opacity=0.85, stroke_color=WHITE, stroke_width=1.5)
            data_text = Text(str(val), font_size=22, color=WHITE)
            next_text = Text("→", font_size=18, color="#9CA3AF")
            data_group = VGroup(data_box, data_text)
            next_group = VGroup(next_box, next_text)
            row = VGroup(data_group, next_group).arrange(RIGHT, buff=0)
            return row

        values = [10, 20, 40, 50]
        nodes = VGroup(*[make_node(v) for v in values])
        nodes.arrange(RIGHT, buff=0.6)
        nodes.move_to(ORIGIN)

        head_arrow = Arrow(
            start=nodes[0].get_top() + UP * 0.5,
            end=nodes[0].get_top(),
            color="#F59E0B", buff=0.05
        )
        head_label = Text("head", font_size=18, color="#F59E0B")
        head_label.next_to(head_arrow, UP, buff=0.1)

        arrows = VGroup()
        for i in range(len(nodes) - 1):
            a = Arrow(
                start=nodes[i][1].get_right(),
                end=nodes[i + 1][0].get_left(),
                color=WHITE, buff=0.05, stroke_width=2
            )
            arrows.add(a)

        null_box = Rectangle(width=0.5, height=0.6, fill_color="#1F2937",
                             fill_opacity=0.9, stroke_color="#EF4444", stroke_width=1.5)
        null_text = Text("NULL", font_size=14, color="#EF4444")
        null_group = VGroup(null_box, null_text).next_to(nodes[-1], RIGHT, buff=0.6)
        last_arrow = Arrow(
            start=nodes[-1][1].get_right(),
            end=null_group.get_left(),
            color=WHITE, buff=0.05, stroke_width=2
        )

        title = Text("Linked List", font_size=34, color=WHITE).to_edge(UP, buff=0.5)
        self.play(Write(title))
        self.play(Create(nodes), GrowArrow(head_arrow), Write(head_label))
        self.play(*[GrowArrow(a) for a in arrows], GrowArrow(last_arrow), FadeIn(null_group))
        self.wait(1)

        # Insert node with value 30 between 20 and 40
        new_node = make_node(30, color="#8B5CF6")
        insert_label = Text("Insert 30", font_size=20, color="#8B5CF6").to_edge(DOWN, buff=0.8)
        self.play(Write(insert_label))

        new_node.next_to(nodes[1], DOWN, buff=1.0)
        self.play(FadeIn(new_node, shift=DOWN * 0.3))
        self.wait(0.5)

        # Animate pointer update
        new_arrow_1 = Arrow(
            start=nodes[1][1].get_right(),
            end=new_node[0].get_top(),
            color="#8B5CF6", buff=0.05
        )
        new_arrow_2 = Arrow(
            start=new_node[1].get_right(),
            end=nodes[2][0].get_left(),
            color="#8B5CF6", buff=0.05
        )
        self.play(
            Transform(arrows[1], new_arrow_1),
            GrowArrow(new_arrow_2)
        )
        self.wait(1)

```
#### MatrixMultiplicationVisual  (score 0)
```python
from manim import *

class MatrixMultiplicationVisual(Scene):
    def construct(self):
        self.camera.background_color = "#0f0f23"

        A = [[1, 2], [3, 4]]
        B = [[5, 6], [7, 8]]
        C = [[A[i][0]*B[0][j] + A[i][1]*B[1][j] for j in range(2)] for i in range(2)]

        def make_matrix(data, color=WHITE):
            entries = [[str(v) for v in row] for row in data]
            return Matrix(entries, element_to_mobject_config={"color": color})

        mat_a = make_matrix(A, "#3B82F6")
        mat_b = make_matrix(B, "#F59E0B")
        mat_c = make_matrix([["?" for _ in row] for row in C], "#10B981")

        times = MathTex(r"\times", font_size=36, color=WHITE)
        equals = MathTex(r"=", font_size=36, color=WHITE)

        equation = VGroup(mat_a, times, mat_b, equals, mat_c).arrange(RIGHT, buff=0.5)
        equation.move_to(ORIGIN)

        title = Text("Matrix Multiplication", font_size=32, color=WHITE).to_edge(UP, buff=0.4)
        self.play(Write(title))
        self.play(Write(mat_a), Write(times), Write(mat_b), Write(equals), Write(mat_c))
        self.wait(0.5)

        for i in range(2):
            for j in range(2):
                row_highlight = SurroundingRectangle(
                    VGroup(*[mat_a.get_rows()[i]]), color="#3B82F6", buff=0.1
                )
                col_highlight = SurroundingRectangle(
                    VGroup(*[mat_b.get_columns()[j]]), color="#F59E0B", buff=0.1
                )
                self.play(
                    Create(row_highlight),
                    Create(col_highlight),
                    run_time=0.4
                )

                calc = MathTex(
                    f"{A[i][0]} \\cdot {B[0][j]} + {A[i][1]} \\cdot {B[1][j]} = {C[i][j]}",
                    font_size=24, color=WHITE
                ).to_edge(DOWN, buff=0.8)
                self.play(Write(calc), run_time=0.5)

                result_entry = mat_c.get_entries()[i * 2 + j]
                new_val = MathTex(str(C[i][j]), font_size=36, color="#10B981")
                new_val.move_to(result_entry.get_center())
                self.play(Transform(result_entry, new_val), run_time=0.4)

                self.play(
                    FadeOut(row_highlight),
                    FadeOut(col_highlight),
                    FadeOut(calc),
                    run_time=0.3
                )

        self.wait(1)

```

---
## Per-step time & tokens summary

| Step | Latency (ms) | Prompt tokens | Completion tokens | Model |
|------|--------------|---------------|-------------------|-------|
| 1. Query transform | 4455 | 2702 | 578 | glm-5.1 |
| 2. Embedding | 1201 | 349 | - | bge-m3:latest |
| 3. Vector search | 155 | - | - | Atlas |
| 4. Rerank | 1920 | 1016 | 141 | deepseek-v4-flash |
| 5. Assembly | 3 | - | - | local |
| **TOTAL** | **7734** | **4067** | **719** | — |

**LLM calls:** 2 (query transform + rerank).  **Total tokens:** 4786 (4067 prompt + 719 completion).

> Note: this trace forces query-transform + rerank ON to expose every step, so total latency (~7.7s) is higher than the production default (query-transform OFF, ~2.3s p95).