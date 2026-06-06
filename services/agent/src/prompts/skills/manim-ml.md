# manim-ml — neural networks & ML architectures

**Use when:** the prompt is about neural networks, deep learning, or ML architectures — feed-forward nets, CNNs, layers, forward passes, embeddings. Prefer this over drawing neurons/edges by hand; it builds the network and animates a forward pass for you.

**Import:**
```python
from manim_ml.neural_network import (
    NeuralNetwork,
    FeedForwardLayer,
    Convolutional2DLayer,
    ImageLayer,
)
```

**Key APIs**
- `NeuralNetwork([layer, layer, ...], layer_spacing=0.25)` — assembles layers into a network mobject. `self.play(Create(nn))` to draw.
- `FeedForwardLayer(num_nodes=4, node_color="#58C4DD")` — a dense layer of N nodes.
- `Convolutional2DLayer(num_feature_maps, feature_map_size=..., filter_size=...)` — a conv layer (use for CNNs / image models).
- `ImageLayer(numpy_image, height=1.5)` — an input-image layer (front of a CNN).
- `nn.make_forward_pass_animation()` — returns an animation of data flowing through the network; play it: `self.play(nn.make_forward_pass_animation())`.

**Canonical pattern**
```python
nn = NeuralNetwork([
    FeedForwardLayer(num_nodes=4, node_color="#58C4DD"),
    FeedForwardLayer(num_nodes=6),
    FeedForwardLayer(num_nodes=2),
], layer_spacing=0.3)
nn.move_to(ORIGIN)
self.play(Create(nn))
self.play(nn.make_forward_pass_animation(), run_time=tracker.duration)
```

**Gotchas**
- The forward-pass animation can be long; in VOICEOVER mode wrap it in a `with self.voiceover(...)` block and pass `run_time=tracker.duration` (or split across beats).
- Keep node counts modest (≤8 per layer) so the diagram stays readable.
- For CNNs, order layers input→output: `ImageLayer` → `Convolutional2DLayer`(s) → `FeedForwardLayer`(s).
