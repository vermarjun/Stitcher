# manim-physics — physics simulations (pendulums, fields, waves, rigid bodies)

**Use when:** the prompt is about physics — pendulums, electric/magnetic fields, waves, optics, or rigid-body/gravity dynamics. Prefer this over faking motion with updaters; it provides real simulated mobjects and field visualisations.

**Import:** `from manim_physics import *`  (this plugin is designed to be star-imported)

**Key APIs**
- `SpaceScene` — base scene for rigid-body dynamics. Subclass it (instead of `Scene`) when you want gravity/collisions; use `self.make_rigid_body(...)` / `self.make_static_body(...)`.
- `Pendulum(length=3.5, initial_theta=0.3, pivot_point=UP*2)` — a single pendulum. `MultiPendulum(*bobs, pivot_point=...)` — chaotic multi-bob pendulum.
- Electric/magnetic fields: `Charge`, `ElectricField`, `Magnet`/`MagneticField` — render field lines around sources.
- Waves: `RadialWave`, `LinearWave`, `StandingWave` — animated wave surfaces/curves.
- Optics: `Lens`, `Ray` — ray tracing through lenses (Snell's law handled for you).
- `TracedPath(mob.get_center)` — trace the trajectory of a moving body (pairs well with pendulums).

**Canonical pattern (pendulum)**
```python
class Scene00(VoiceoverScene):   # or SpaceScene for rigid bodies
    def construct(self):
        ...
        pendulum = MultiPendulum(RIGHT, RIGHT * 2, pivot_point=UP * 2)
        self.add(pendulum)
        path = TracedPath(pendulum.bobs[-1].get_center, stroke_color=YELLOW)
        self.add(path)
        self.play(pendulum.start_swinging(), run_time=tracker.duration)
```

**Gotchas**
- Rigid-body/gravity features require subclassing `SpaceScene`. In this pipeline the base class must stay a `VoiceoverScene`, so for narrated rigid-body scenes prefer the non-`SpaceScene` constructs (Pendulum/fields/waves/optics) which work in a normal scene.
- Field renders can be heavy — keep the number of charges/streamlines small to stay within the render budget.
- Depends on `pymunk`/`shapely` (already installed in the render image).
