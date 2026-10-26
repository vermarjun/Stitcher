# manim-ml — neural networks & ML architectures

**Use when:** the prompt is about neural networks, deep learning, or ML architectures — feed-forward nets, CNNs, pooling layers, embeddings, vectors. Prefer this over drawing neurons/edges by hand; it builds the network and animates a forward pass for you.

**Import:**
```python
from manim_ml.neural_network import (
    NeuralNetwork,
    FeedForwardLayer,
    Convolutional2DLayer,
    ImageLayer,
    MaxPooling2DLayer,
    EmbeddingLayer,
    VectorLayer,
)
```

**Key APIs**

- `NeuralNetwork(input_layers, layer_spacing=0.2)` — assembles a list of layer objects into a network mobject. First argument is a plain Python list of layer objects. `self.play(Create(nn))` to draw.
- `FeedForwardLayer(num_nodes, node_color=ManimColor('#58C4DD'), node_radius=0.08, node_spacing=0.3, activation_function=None)` — a dense layer of N nodes. `num_nodes` is the only required positional argument.
- `Convolutional2DLayer(num_feature_maps, feature_map_size=None, filter_size=None, cell_width=0.2, color=ManimColor('#58C4DD'), fill_opacity=0.3)` — a conv layer (use for CNNs / image models).
- `ImageLayer(numpy_image, height=1.5, show_image_on_create=True)` — an input-image layer (front of a CNN). Pass a NumPy array (H×W or H×W×C).
- `MaxPooling2DLayer(kernel_size=2, stride=1, cell_width=0.2)` — a max-pool layer; connects after `Convolutional2DLayer`.
- `EmbeddingLayer(point_radius=0.02, mean=..., covariance=...)` — a 2-D latent-space scatter layer.
- `VectorLayer(num_values)` — a 1-D value vector layer.
- `nn.make_forward_pass_animation(run_time=None, passing_flash=True, layer_args={}, per_layer_animations=False)` — returns an `AnimationGroup` of data flowing through the network. **Play it**: `self.play(nn.make_forward_pass_animation())`. When `per_layer_animations=True` the return value is a dict mapping layers to animations instead of a group.

**Canonical pattern**
```python
from manim_ml.neural_network import NeuralNetwork, FeedForwardLayer

nn = NeuralNetwork([
    FeedForwardLayer(4, node_color="#58C4DD"),
    FeedForwardLayer(6),
    FeedForwardLayer(2),
], layer_spacing=0.3)
nn.move_to(ORIGIN)
self.play(Create(nn))
self.play(nn.make_forward_pass_animation(), run_time=3)
```

**CNN pattern**
```python
import numpy as np
from manim_ml.neural_network import (
    NeuralNetwork, ImageLayer, Convolutional2DLayer,
    MaxPooling2DLayer, FeedForwardLayer,
)

image = np.random.rand(28, 28, 1)
nn = NeuralNetwork([
    ImageLayer(image, height=1.5),
    Convolutional2DLayer(4, feature_map_size=5, filter_size=3),
    MaxPooling2DLayer(kernel_size=2),
    FeedForwardLayer(10),
], layer_spacing=0.3)
self.play(Create(nn))
self.play(nn.make_forward_pass_animation())
```

**Gotchas**
- `make_forward_pass_animation()` returns a real `AnimationGroup` — it is safe and correct to pass it to `self.play()`.
- `NeuralNetwork` `layer_spacing` default is `0.2`, not `0.25`.
- In VOICEOVER mode wrap the forward-pass play in a `with self.voiceover(...)` block and pass `run_time=tracker.duration` (or split across beats).
- Keep node counts modest (≤8 per layer) so the diagram stays readable.
- For CNNs, order layers input→output: `ImageLayer` → `Convolutional2DLayer`(s) → `MaxPooling2DLayer`(s) → `FeedForwardLayer`(s).
- `LSTMLayer` does **not** exist in this installation. Use `FeedForwardLayer` for RNN diagrams.

<!-- verified against manim_ml via introspection on 2026-06-08 -->
