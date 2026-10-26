# Manim Plugin Integration

All 6 patched plugins are vendored under `vendor/` and installed into the image
at build time. Manim stays pinned at **0.19.2**. All plugins are verified working
through the live `/render` HTTP endpoint.

## What was vendored

| Plugin | vendor/ source | Import name | Key fix |
|---|---|---|---|
| manim-chess | `vendor/manim-chess/` | `manim_chess` | `requires-python` relaxed `>=3.12` → `>=3.11` |
| manim-physics | `vendor/manim-physics/` | `manim_physics` | manim dep pin relaxed `~0.18.0` → `>=0.18,<0.20` |
| manim-chemistry | `vendor/manim-chemistry/` | `manim_chemistry` | scipy `sph_harm` removed in 1.17 → compat shim; `from_mol_file` str/obj element type fix |
| manim-ml | `vendor/manim-ml/` | `manim_ml` | Empty `AnimationGroup` deadlock fix; `rotate()` kwarg fix; `three_d_config` import fix; `BlankConnective` abstract method fix |
| manim-dsa | `vendor/manim-dsa/` | `manim_dsa` | `typing.override` Python 3.12-only → `typing_extensions.override` |
| manim-astronomy | `vendor/manim-astronomy/` | `manim_Astronomy` | Lazy vedo import (Star/Planet/SpaceTimeFabric work without vtk); absolute `.obj` asset paths; `JamesWebbSpaceTelescope` added to `__all__` |

Patched sources live at `/Users/vermarjun/Desktop/Manim plugins/<name>/`. Each has
a `FIXES.md` and `smoke_tests.py`. The vendor copies match the patched sources exactly.

## Dockerfile changes

All changes are in `/Users/vermarjun/Desktop/manim-render-service/Dockerfile`:

1. **`COPY vendor/ ./vendor/`** — copies all 6 plugin trees into the build context.
2. **Build deps** — `pip install poetry-core setuptools_scm setuptools` before plugin installs.
3. **Plugin installs (steps 1–6)** — each uses `pip install --no-deps ./vendor/<name>` then
   installs real third-party deps separately to avoid bumping manim.
4. **`SETUPTOOLS_SCM_PRETEND_VERSION_FOR_MANIM_CHEMISTRY=0.5.0`** — prevents setuptools-scm
   from failing on the vendor tree (no `.git` history).
5. **astronomy install is failure-tolerant** — `pip install vedo || echo WARNING` so a vtk
   download failure cannot block the other 5 plugins. vedo 2026.6.1 / vtk 9.6.2 did install
   successfully; all 7 astronomy classes (including Hubble/JWST) work.
6. **`chmod a+rwx` on plugin SVG dirs** — Manim 0.19 `SVGMobject.generate_mobject()` writes
   a modified SVG next to the source file. `manim_chess/piece_svgs/` and
   `manim_Astronomy/Assets/` are root-owned in the image; the renderer user needs write
   access. The chmod runs in `pydeps` so it propagates via `COPY --from=pydeps /opt/venv`.

## `app/core/validate.py` change

Added all 6 plugin module names (and their common deps: `networkx`, `PIL`, `pymunk`,
`shapely`, `pandas`, `xmltodict`) to `ALLOWED_TOP_LEVEL_IMPORTS` so the AST pre-guard
does not reject scenes that import them.

## Rebuild steps

```bash
# From Stitcher project root (the standard way to rebuild the render service):
docker compose -f docker-compose.yml -f docker-compose.services.yml build render-service
docker compose -f docker-compose.yml -f docker-compose.services.yml up -d render-service

# Or from the manim-render-service repo directly:
cd /Users/vermarjun/Desktop/manim-render-service
docker compose build render
docker compose up -d render
```

Docker layer cache means re-runs that haven't changed the plugin install steps are fast
(only the changed layers rebuild). A full cold build takes ~5 min on Apple Silicon.

## Verification

Check health:
```bash
curl -s http://localhost:8000/health | python3 -m json.tool
```

Test a plugin (example — chess):
```bash
curl -s -X POST http://localhost:8000/render \
  -H "x-api-key: change_me_render_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "from manim import *\nfrom manim_chess import Board\nDEFAULT_FEN = \"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1\"\nclass BoardScene(Scene):\n    def construct(self):\n        board = Board()\n        board.set_board_from_FEN(DEFAULT_FEN)\n        self.add(board)\n        self.wait(0.2)\n",
    "sceneClass": "BoardScene",
    "render": {"quality": "low"},
    "limits": {"timeoutSec": 120}
  }' | python3 -m json.tool | grep success
```

## Verification results (live service, 2026-05-31)

| Plugin | Installed | Renders via /render | Note |
|---|:---:|:---:|---|
| manim-chess | yes | PASS | BoardScene (FEN setup + board display) |
| manim-physics | yes | PASS | RigidFall (SpaceScene physics sim) |
| manim-chemistry | yes | PASS | BohrAtom (element diagram) |
| manim-ml | yes | PASS | FeedForwardNN (static neural network) |
| manim-dsa | yes | PASS | SmokeMArray (animated array) |
| manim-astronomy | yes | PASS | Star (particle), SpaceTimeFabric, HubbleSpaceTelescope (vedo/vtk) |

Manim version inside container: **0.19.2** (unchanged — no plugin dependency bumped it).
