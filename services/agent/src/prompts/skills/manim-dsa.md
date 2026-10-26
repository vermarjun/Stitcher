# manim-dsa — data structures & algorithms (arrays, stacks, graphs, trees, variables)

**Use when:** the prompt is about data structures or algorithms — arrays, stacks, variables/pointers, graphs (BFS/DFS/Dijkstra/Prim/etc.), or trees. Prefer this over hand-built `Rectangle`/`VGroup` grids; it gives styled, animatable DS mobjects with built-in highlight animations.

**Imports** (import only what you use):
```python
from manim_dsa import MArray, MArrayStyle
from manim_dsa import MStack, MStackStyle
from manim_dsa import MVariable, MVariableStyle
from manim_dsa import MGraph, MGraphStyle
from manim_dsa import MTree, MTreeStyle
```

**Available styles for every DS:** `DEFAULT`, `BLUE`, `GREEN`, `PURPLE` (e.g. `MArrayStyle.BLUE`). There is no `STANDARD` style — use `DEFAULT` instead.

---

**Key APIs**

### MArray
`MArray(arr=[], direction=RIGHT, style=MArrayStyle.DEFAULT)` — horizontal (or directional) array of cells. Subclass of `VGroup`.

- `arr.add_indexes(direction=UP, buff=0.25)` — add index labels above (or in the specified direction). Returns `self`. Call as a statement or chain: `arr.add_indexes()`. Raises if direction is parallel to array growth direction.
- `arr.append(value)` — add element to the end (returns `self`; bare statement). Animate: `self.play(arr.animate.append(value))`.
- `arr.pop(index=-1)` — remove element at index (returns `self`; bare statement). Animate: `self.play(arr.animate.pop(index))`.
- `arr.swap(i, j)` — swap elements at indices i and j (returns `self`; bare statement). Animate: `self.play(arr.animate.swap(i, j))`.
- `arr[i]` — returns the `MElement` (an `MIndexedElement`) at index i. Use for per-element operations.
- `arr.add_label(text, direction=UP, buff=0.5)` — add a text label to the array (returns `self`).

**Element highlight (MArray):**
`arr[i]` returns an `MElement` which inherits from `Highlightable`. Correct patterns:
```python
# Instant highlight (no animation — bare statement):
arr[i].highlight(stroke_color=RED, stroke_width=8)

# Animated highlight (use with self.play):
self.play(arr[i].animate.highlight())             # default RED, width=8
self.play(arr[i].animate.highlight(stroke_color=YELLOW, stroke_width=10))

# Animated unhighlight:
self.play(arr[i].animate.unhighlight())
```
`highlight()` called bare (not via `.animate`) returns `self` (the element) — NOT an animation. Only use it inside `self.play(...)` via the `.animate` syntax.

### MStack
`MStack(arr=[], buff=0.1, style=MStackStyle.DEFAULT)` — vertical stack with a visual container (U-shape). Subclass of `MCollection`.

- `stack.append(value)` — push to top (returns `self`; bare statement). Animate: `self.play(stack.animate.append(value))`.
- `stack.pop()` — pop from top (returns `self`; bare statement). Animate: `self.play(stack.animate.pop())`.
- `stack.swap(i, j)` — swap elements at indices i, j (returns `self`; bare statement).
- `stack[i]` — returns `MElement` at index i (same highlight API as MArray above).
- `stack.add_label(text, direction=UP, buff=0.5)` — add label (returns `self`).

### MVariable
`MVariable(value, style=MVariableStyle.DEFAULT)` — a single labelled variable box. Subclass of `MElement` and `Labelable`.

- `var.set_value(new_value)` — update displayed value (returns `self`; bare statement). Animate: `self.play(var.animate.set_value(new_value))`.
- `var.add_label(text, direction=UP, buff=0.5)` — add label (returns `self`; bare statement).
- `var.highlight(stroke_color=RED, stroke_width=8)` — instant highlight (returns `self`; bare statement). Animate: `self.play(var.animate.highlight())`.
- `var.unhighlight()` — instant unhighlight (returns `self`; bare statement). Animate: `self.play(var.animate.unhighlight())`.

### MGraph
`MGraph(graph, nodes_position={}, style=MGraphStyle.DEFAULT)` — directed graph. Subclass of `VDict`.

**`graph` input format** — any of:
- `networkx.DiGraph` — pass directly
- `dict[str, list[str]]` — unweighted: `{'A': ['B', 'C'], 'B': ['C']}`
- `dict[str, list[tuple[str, int]]]` — weighted: `{'A': [('B', 2), ('C', 4)]}`
- `list[list[str]]` or `list[list[tuple[str,int]]]` — same formats with integer node names

`nodes_position` is a `dict[str, Vector3D]`. If omitted, `kamada_kawai_layout` is applied automatically.

- `graph.add_node(name, position=ORIGIN)` — add a node (returns `self`).
- `graph.add_edge(node1_name, node2_name, weight=None, label_distance=0.25)` — add a directed edge (returns `self`).
- `graph.add_curved_edge(node1_name, node2_name, weight=None, ...)` — add a curved directed edge (returns `self`). Use when two nodes have edges in both directions.
- `graph.node_layout(layout='kamada_kawai_layout')` — apply a NetworkX layout algorithm (returns `self`; bare statement or chain). Other options: `'spring_layout'`, `'circular_layout'`, `'shell_layout'`.
- `graph.nodes['A']` — access `MGraph.Node` for node `'A'`. Nodes have `highlight`/`unhighlight`/`set_highlight`.
- `graph.edges[('A','B')]` — access `MGraph.Edge` for the edge. Edges have `set_highlight`/`highlight`.
- `graph.add_label(text, direction=UP, buff=0.5)` — add label (returns `self`).

**Highlight patterns for MGraph:**
```python
# Instant (no animation) — highlight ALL nodes or ALL edges at once:
graph.set_nodes_highlight(color=RED, width=8)   # returns self — bare statement
graph.set_edges_highlight(color=YELLOW, width=6) # returns self — bare statement

# Animated — highlight individual node or edge:
self.play(graph.nodes['A'].animate.highlight())
self.play(graph.nodes['A'].animate.highlight(stroke_color=YELLOW, stroke_width=10))
self.play(graph.nodes['A'].animate.unhighlight())
self.play(graph.edges[('A','B')].animate.highlight())
```
`set_nodes_highlight` / `set_edges_highlight` call `set_highlight()` (instant, no animation) on each node/edge — use them as bare statements to set initial highlight state, not to produce animations.

### MTree
`MTree(tree, root=None, style=MTreeStyle.DEFAULT)` — directed tree. Subclass of `MGraph`.

**`tree` input format** — same as `MGraph` (networkx DiGraph, dict, or list). The graph must be a DAG; `root` specifies the root node name (auto-detected if omitted).

- `tree.node_layout()` — apply hierarchical (top-down) layout (returns `self`; called automatically on init). Call manually after adding nodes/edges.
- All `MGraph` methods apply (`add_node`, `add_edge`, `nodes[name]`, `edges[(a,b)]`, highlight patterns).
- `MTree.node_layout()` takes **no arguments** (unlike `MGraph.node_layout` which takes a `layout` string).

---

**Canonical pattern — array algorithm**
```python
from manim_dsa import MArray, MArrayStyle
from manim import *

arr = MArray([5, 2, 9, 1], style=MArrayStyle.BLUE)
arr.add_indexes()
arr.move_to(ORIGIN)
self.play(Create(arr))

# Animate visiting/comparing elements
self.play(arr[0].animate.highlight())           # highlight index 0
self.play(arr[0].animate.unhighlight(), arr[2].animate.highlight())
self.play(arr.animate.swap(0, 2))               # animated swap
self.play(arr[2].animate.unhighlight())
```

**Canonical pattern — graph traversal**
```python
from manim_dsa import MGraph, MGraphStyle
from manim import *

graph_data = {'A': ['B', 'C'], 'B': ['D'], 'C': ['D'], 'D': []}
positions = {'A': UP*2, 'B': LEFT+UP*0.5, 'C': RIGHT+UP*0.5, 'D': DOWN}
g = MGraph(graph_data, nodes_position=positions, style=MGraphStyle.BLUE)
self.play(Create(g))

# Animate BFS/DFS visiting:
self.play(g.nodes['A'].animate.highlight())
self.play(g.nodes['B'].animate.highlight(), g.edges[('A','B')].animate.highlight())
```

**Canonical pattern — stack**
```python
from manim_dsa import MStack, MStackStyle
from manim import *

stack = MStack([], style=MStackStyle.GREEN)
stack.move_to(ORIGIN)
self.play(Create(stack))
self.play(stack.animate.append(10))
self.play(stack.animate.append(20))
self.play(stack.animate.pop())
```

**Gotchas**
- `highlight()` called bare (not via `.animate`) returns `self` — it is NOT an animation. Always use `self.play(obj.animate.highlight())` for animated highlighting.
- `arr[i]` returns the `MElement`; to get the visual square or value text use `arr[i].square` and `arr[i].value`.
- `MTree.node_layout()` takes no arguments. `MGraph.node_layout(layout='...')` takes an optional layout string.
- `set_nodes_highlight` / `set_edges_highlight` on `MGraph`/`MTree` are instant setters (no animation) — use as bare statements, not inside `self.play(...)`.
- Style enums are `DEFAULT`, `BLUE`, `GREEN`, `PURPLE` for all five DS classes. There is **no** `STANDARD` style.
- `MStack.pop()` always removes the top element (no index argument). `MArray.pop(index=-1)` accepts an index.
- Keep `MTree` and `MGraph` small (fewer than ~10 nodes) so labels stay legible at default scale.

<!-- verified against manim_dsa via introspection on 2026-06-08 -->
