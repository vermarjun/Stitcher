# manim-physics — physics simulations (pendulums, fields, waves, optics, rigid bodies)

**Use when:** the prompt is about physics — pendulums, electric/magnetic fields, waves, optics, or rigid-body/gravity dynamics. Prefer this over faking motion with updaters; it provides real simulated mobjects and field visualisations.

**Import:** `from manim_physics import *`  (this plugin is designed to be star-imported)

**Key APIs**

- `SpaceScene` — base scene for rigid-body dynamics. **Pendulums REQUIRE this base class** — subclass `SpaceScene` instead of `Scene`. Use `self.make_rigid_body(*mobs)` and `self.make_static_body(*mobs)` as bare statements (both return `None`).
- `Pendulum(length=3.5, initial_theta=0.3, pivot_point=UP*2)` — a single pendulum. Must be used inside a `SpaceScene`.
  - `.start_swinging()` — returns `None`. Call as a **bare statement** (never inside `self.play()`). Requires the pendulum bobs to have been registered first with `self.make_rigid_body(*p.bobs)`.
  - `.end_swinging()` — returns `None`. Bare statement.
- `MultiPendulum(*bob_positions, pivot_point=UP*2)` — chaotic multi-bob pendulum. Same `SpaceScene` requirements as `Pendulum`. Access bob mobjects via `p.bobs` (a `VGroup`).
  - `.start_swinging()` — returns `None`. Bare statement.
  - `.end_swinging()` — returns `None`. Bare statement.
- Electric fields: `Charge(magnitude=1, point=ORIGIN, add_glow=True)`, `ElectricField(*charges)` — render field lines around charges. Works in any `Scene`.
- Magnetic fields: `Wire(stroke_vmobject, current=1, samples=16)`, `MagneticField(*wires)` — render magnetic field from current-carrying wires. **`Magnet` does not exist.** Works in any `Scene`.
- Waves: `RadialWave(*sources, wavelength=1, period=1, amplitude=0.1, x_range=[-5,5], y_range=[-5,5])`, `LinearWave(...)`, `StandingWave(n=2, length=4, period=1, amplitude=1)` — animated wave surfaces. Call `.start_wave()` as a **bare statement** (returns `None`, installs an updater); then use `self.wait(seconds)` to let the wave run. Works in any `Scene`.
- Optics: `Lens(f, d, n=1.52)`, `Ray(start, direction, init_length=5, propagate=None)` — ray tracing through lenses. Works in any `Scene`.
- `TracedPath(mob.get_center, stroke_color=YELLOW)` — trace the trajectory of a moving body (also exported directly by `manim`).

**Canonical pattern (pendulum) — MUST subclass SpaceScene**
```python
from manim_physics import *

class Scene00(SpaceScene):   # SpaceScene is required — Pendulum/MultiPendulum crash without it
    def construct(self):
        pendulum = MultiPendulum(RIGHT, LEFT, pivot_point=UP * 2)
        self.add(pendulum)
        self.make_rigid_body(*pendulum.bobs)   # bare statement — registers bobs in physics sim; sets .spacescene
        pendulum.start_swinging()              # bare statement — returns None, installs updater
        self.add(TracedPath(pendulum.bobs[-1].get_center, stroke_color=YELLOW))
        self.wait(10)
```

**Canonical pattern (electric field) — plain Scene**
```python
from manim_physics import *

class Scene00(Scene):
    def construct(self):
        charge_pos = Charge(magnitude=1, point=LEFT * 2)
        charge_neg = Charge(magnitude=-1, point=RIGHT * 2)
        field = ElectricField(charge_pos, charge_neg)
        self.add(charge_pos, charge_neg, field)
        self.wait(3)
```

**Canonical pattern (wave) — plain Scene**
```python
from manim_physics import *

class Scene00(Scene):
    def construct(self):
        wave = RadialWave(LEFT * 2, RIGHT * 2, amplitude=0.3)
        self.add(wave)
        wave.start_wave()     # bare statement — returns None, installs time updater
        self.wait(5)
```

**Gotchas**
- `start_swinging()`, `end_swinging()`, `make_rigid_body()`, `make_static_body()`, and `start_wave()` all return `None`. **Never pass them to `self.play()`** — doing so crashes with `TypeError` (NoneType is not an Animation).
- `Pendulum` and `MultiPendulum` **cannot** run in a plain `Scene` or `VoiceoverScene`. They call `self.bobs[0].spacescene` internally, which is only set by `make_rigid_body()` inside a `SpaceScene`. If the pipeline base class must be `VoiceoverScene`, use fields/waves/optics instead — those work in any scene.
- The correct order for pendulums is: `self.add(pendulum)` → `self.make_rigid_body(*pendulum.bobs)` → `pendulum.start_swinging()` → `self.wait(seconds)`.
- `Magnet` does not exist in this version (0.2.3). For magnetic fields, use `Wire` + `MagneticField`.
- Field renders can be heavy — keep the number of charges/streamlines small to stay within the render budget.
- Depends on `pymunk`/`shapely` (already installed in the render image).

<!-- verified against manim_physics 0.2.3 via introspection on 2026-06-08 -->
