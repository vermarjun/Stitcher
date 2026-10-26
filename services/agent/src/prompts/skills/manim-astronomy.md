# manim-astronomy — stars, planets, spacetime, telescopes

**Use when:** the prompt is about astronomy/astrophysics — stars, planets, orbits, spacetime curvature, or telescopes. Prefer this over plain `Circle`/`Sphere`; it provides purpose-built celestial mobjects.

**Imports** (note the CAPITAL A in the module name):
- `from manim_Astronomy import Star, Planet`
- `from manim_Astronomy import SpaceTimeFabric`
- `from manim_Astronomy import HubbleSpaceTelescope`
- `from manim_Astronomy import JamesWebbSpaceTelescope`

**Key APIs**

`Star(center=ORIGIN, radius=0.5, num_of_particles=1000, size_of_particle=1e-6, colors=[YELLOW], luminosity=1.0, mass=1.0, temperature=6000, **kwargs)`
— A star mobject rendered as a particle cloud. Positioned via `center`. Use `colors` list to change star colour.

`Planet(center=ORIGIN, radius=0.05, include_planetary_disc=False, ring_inner_radius=0.1, ring_outer_radius=0.15, num_particles=100, size_of_particle=0.01, **kwargs)`
— A planet rendered as a `Dot3D` sphere. Default `radius=0.05` is very small — use `radius=0.3` or larger for visibility. Set `include_planetary_disc=True` to add a particle ring system.

`SpaceTimeFabric(func=None, func_args=(), u_range=(-1, 1), v_range=(-1, 1), resolution=(50, 50), scaling_factor=0.1, t_range=(-1, 1), **kwargs)`
— The classic curved-grid "spacetime sheet". Pass a callable `func(u, v)` returning a z-displacement to warp the grid (e.g. `lambda u, v: -0.3 * np.exp(-(u**2 + v**2))`). Defaults to a flat grid (`func=None`). Use `get_wireframe_curves()` to access the grid lines as a VGroup.

`HubbleSpaceTelescope(center=ORIGIN, size=0.5, **kwargs)`
— A Hubble Space Telescope model assembled from wavefront data. Positioned via `center`; `size` scales the model.

`JamesWebbSpaceTelescope(center=ORIGIN, size=0.1, **kwargs)`
— A James Webb Space Telescope model assembled from wavefront data. Default `size=0.1` is very small — use `size=0.5` or larger for visibility.

**Canonical pattern**
```python
from manim_Astronomy import Star, Planet, SpaceTimeFabric

class Scene00(VoiceoverScene):
    def construct(self):
        self.set_speech_service(OfflineTTS(), create_subcaption=False)

        star = Star(center=ORIGIN, radius=0.5)
        planet = Planet(center=RIGHT * 3, radius=0.3)
        self.add(star)
        self.play(FadeIn(planet))
```

**Canonical pattern (SpaceTimeFabric with gravity well)**
```python
import numpy as np
from manim_Astronomy import SpaceTimeFabric

fabric = SpaceTimeFabric(
    func=lambda u, v: -0.5 * np.exp(-(u**2 + v**2)),
    u_range=(-3, 3),
    v_range=(-3, 3),
    resolution=(30, 30),
)
self.play(Create(fabric))
```

**Canonical pattern (telescope)**
```python
from manim_Astronomy import HubbleSpaceTelescope

telescope = HubbleSpaceTelescope(center=ORIGIN, size=0.5)
self.play(FadeIn(telescope))
```

**Gotchas**
- Module is `manim_Astronomy` (capital A) — the import must match exactly or validation/render fails.
- `Planet` default `radius=0.05` is extremely small; always pass an explicit `radius` (e.g. `radius=0.3`) for visible output.
- `JamesWebbSpaceTelescope` default `size=0.1` is also very small; use `size=0.5` or larger.
- `SpaceTimeFabric` generates a 2D wireframe grid in the XY plane. To show curvature, pass a `func` that returns a z-offset. With no `func` the grid is flat. Access grid lines via `.get_wireframe_curves()` if you need to style them individually.
- None of the plugin methods return an `Animation`. All objects are Mobjects — animate them with standard manim animations: `Create(obj)`, `FadeIn(obj)`, `self.add(obj)`, etc.
- `HubbleSpaceTelescope` and `JamesWebbSpaceTelescope` load wavefront mesh data from assets bundled with the plugin — they are offline-safe.
- These objects work in both 2D and 3D scenes. For 3D camera work use `ThreeDScene` patterns (`self.move_camera(...)`, `self.add_fixed_in_frame_mobjects(text)` to keep title text facing the viewer). In voiceover mode the base class stays `VoiceoverScene`; call `self.set_camera_orientation(...)` or `self.move_camera(...)` as needed.

<!-- verified against manim_Astronomy via introspection on 2026-06-08 -->
