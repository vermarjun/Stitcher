# manim-chemistry — molecules, atoms, periodic elements, formulas

**Use when:** the prompt is about chemistry — molecules (2D/3D), atomic structure (Bohr models, orbitals), periodic-table elements, or chemical formulas. Prefer this over drawing atoms with `Circle`/`Line`; it renders real chemical structures.

**Imports** (import only what you use):
- `from manim_chemistry import MMoleculeObject, NamedMolecule`
- `from manim_chemistry import GraphMolecule`
- `from manim_chemistry import MElementObject`
- `from manim_chemistry import BohrAtom`
- `from manim_chemistry import Orbital`
- `from manim_chemistry import ChemicalFormula, NamedFormula`

**Key APIs**
- `BohrAtom(e=6, p=6, n=6)` — a Bohr model (electrons/protons/neutrons) with orbiting electrons. Great for "structure of the atom" explainers.
- `MElementObject(atomic_number=6, ...)` — a single periodic-table tile (symbol, number, mass). Style with `fill_colors=(...)`.
- `GraphMolecule` / `MMoleculeObject` — 2D molecule diagrams (atoms + bonds).
- `Orbital(...)` — atomic/molecular orbital shapes.
- `ChemicalFormula(...)` / `NamedFormula(...)` — typeset chemical formulas.

**Canonical pattern (Bohr atom)**
```python
atom = BohrAtom(e=6, p=6, n=6)
atom.move_to(ORIGIN)
self.play(Create(atom), run_time=tracker.duration)
```

**Canonical pattern (element tile)**
```python
carbon = MElementObject(atomic_number=6, fill_colors=("#909090", "#58C4DD"))
carbon.scale(1.5).move_to(ORIGIN)
self.play(FadeIn(carbon, scale=0.5))
```

**Gotchas**
- The plugin ships its own 118-element table (no rdkit needed). Prefer constructing `MElementObject(atomic_number=...)` directly. Some examples use `MElementObject.from_csv_file_data(...)` — that needs a data file path; the direct constructor is safer in this sandbox (no file I/O).
- `BohrAtom` is the most robust headline visual — reach for it first for atom/structure prompts.
- 3D molecules require a `ThreeDScene`; in voiceover mode keep to 2D (`GraphMolecule`/`MMoleculeObject`) unless 3D is essential.
