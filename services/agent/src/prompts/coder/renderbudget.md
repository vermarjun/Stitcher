## RENDER BUDGET — hard limits (violations cause timeouts; the job produces a blank fallback)

The renderer runs on a modest CPU at 480p. **Simple animations are cheap** — `Text`, `MathTex`, shapes, `Transform`, `FadeIn`, `Create`, `ValueTracker`, updaters — use as many as the content needs. The budget is eaten by a few EXPENSIVE constructs (3D, multiple physics simulations, huge particle counts), NOT by the number of animations. Avoid the expensive constructs below and your scene renders comfortably within the time budget.

### Banned outright — these reliably cause timeouts
- **Multiple physics simulations in one scene.** `SpaceScene` (pendulum, rigid-body), `LinearWave`/`RadialWave`, and GPU-style particle systems each consume the full render budget on their own. Use AT MOST ONE of these per scene, never two.
- **3D scenes and 3D camera moves.** `ThreeDScene`, `ThreeDAxes`, `set_camera_orientation`, `move_camera`, and any `Surface`/`ParametricSurface` are GPU-dependent and will time out on a CPU renderer. Do not use them.
- **`SpaceTimeFabric`** — this is a 3D parametric surface. It is banned for the same reason as `Surface`. Never use it.
- **Large particle counts.** `Star(num_of_particles=...)` capped at **60**, `Planet(num_particles=...)` capped at **30**. Higher values exceed the render budget.
- **`SpaceTimeFabric` at any resolution** — banned (see above).
- **`ElectricField` / `MagneticField` without limiting the grid.** Always pass `x_range` and `y_range` no wider than `(-3, 3)` and use `delta_x=0.8`, `delta_y=0.8` or larger to keep arrow count below 50.
