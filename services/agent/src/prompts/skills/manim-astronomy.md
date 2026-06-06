# manim-astronomy — stars, planets, spacetime, telescopes

**Use when:** the prompt is about astronomy/astrophysics — stars, planets, orbits, spacetime curvature, or telescopes. Prefer this over plain `Circle`/`Sphere`; it provides purpose-built celestial mobjects.

**Imports** (note the CAPITAL A in the module name):
- `from manim_Astronomy import Star, Planet`
- `from manim_Astronomy import SpaceTimeFabric`
- `from manim_Astronomy import HubbleSpaceTelescope`

**Key APIs**
- `Star(center=ORIGIN, ...)` — a star mobject.
- `Planet(center=..., radius=0.3, include_planetary_disc=False)` — a planet; can include a disc/ring.
- `SpaceTimeFabric(...)` — the classic curved-grid "spacetime sheet" (use for gravity/relativity explainers).
- `HubbleSpaceTelescope(...)` — a telescope model.

**Canonical pattern**
```python
class Scene00(VoiceoverScene):   # most astronomy visuals are 3D
    def construct(self):
        self.set_speech_service(OfflineTTS(), create_subcaption=False)
        ...
        star = Star(center=ORIGIN)
        planet = Planet(center=RIGHT * 3, radius=0.3)
        self.add(star)
        self.play(Create(planet), run_time=tracker.duration)
```

**Gotchas**
- Module is `manim_Astronomy` (capital A) — the import must match exactly or validation/render fails.
- Most astronomy scenes are 3D — they often need `ThreeDScene` patterns (`move_camera`, `add_fixed_in_frame_mobjects` for HUD text). In voiceover mode the base class stays `VoiceoverScene`; use `self.move_camera(...)` for camera work and `self.add_fixed_in_frame_mobjects(text)` to keep titles facing the viewer.
- Heavy dependency (vedo/vtk) is installed in the render image; keep object counts modest.
