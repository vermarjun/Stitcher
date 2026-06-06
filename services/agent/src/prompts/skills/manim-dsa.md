# manim-dsa — data structures & algorithms (arrays, stacks, graphs, trees)

**Use when:** the prompt is about data structures or algorithms — arrays, stacks, variables/pointers, graphs (BFS/DFS/Dijkstra/Prim), or trees. Prefer this over hand-built `Rectangle`/`VGroup` grids; it gives styled, animatable DS mobjects with built-in highlight animations.

**Imports** (import only what you use):
- `from manim_dsa import MArray, MArrayStyle`
- `from manim_dsa import MStack, MStackStyle`
- `from manim_dsa import MVariable, MVariableStyle`
- `from manim_dsa import MGraph, MGraphStyle`
- `from manim_dsa import MTree, MTreeStyle`

**Key APIs**
- `MArray(arr=[...], style=MArrayStyle.BLUE)` — an array of cells. `.add_indexes()` to label indices. `Create(marray)` to draw.
- `MStack(arr=[...], style=MStackStyle.GREEN)` — a stack; push/pop by transforming.
- `MVariable(value, style=MVariableStyle.PURPLE)` — a labelled variable box (great for pointers/counters).
- `MGraph(graph, nodes_position={...}, style=MGraphStyle.PURPLE)` — a graph from an adjacency/edge structure with explicit node positions.
- `MTree(tree, style=MTreeStyle.STANDARD)` — a tree from a networkx DiGraph or nested list/dict.
- Highlighting (the reason to use this plugin): `MElement.animate.highlight(...)` / `.unhighlight()`, and `MGraph.Node.set_highlight(...)` — animate visiting/comparing elements during an algorithm walkthrough.

**Canonical pattern**
```python
arr = MArray([5, 2, 9, 1], style=MArrayStyle.BLUE).add_indexes()
arr.move_to(ORIGIN)
self.play(Create(arr))
# highlight element being compared
self.play(arr[1].animate.highlight())
```

**Gotchas**
- Each DS has a paired `*Style` enum; pass one via `style=`. Don't invent style names — use the documented enums (BLUE/GREEN/PURPLE/STANDARD as seen in examples).
- Index into the structure to get an element, then animate `.highlight()/.unhighlight()` — this is how you show an algorithm stepping through.
- `MTree` accepts a networkx DiGraph or a nested list; keep trees small so labels stay legible.
