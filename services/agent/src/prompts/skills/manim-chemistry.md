# manim-chemistry — molecules, atoms, periodic elements, formulas

**Use when:** the prompt is about chemistry — molecules (2D/3D), atomic structure (Bohr models, orbitals), periodic-table elements, or chemical formulas. Prefer this over drawing atoms with `Circle`/`Line`; it renders real chemical structures.

**Imports** (import only what you use):
- `from manim_chemistry import MMoleculeObject, NamedMolecule`
- `from manim_chemistry import GraphMolecule`
- `from manim_chemistry import MElementObject`
- `from manim_chemistry import BohrAtom`
- `from manim_chemistry import Orbital`
- `from manim_chemistry import ChemicalFormula, NamedFormula`
- `from manim_chemistry import ComplexFormula, NamedComplexFormula`  *(for multi-component formulas)*
- `from manim_chemistry import PeriodicTable`  *(needs an external CSV data file — risky in sandbox)*
- `from manim_chemistry import ThreeDMolecule`  *(requires OpenGL renderer — see Gotchas)*

**Key APIs**

`BohrAtom(e=14, p=14, n=10, level=None, orbit_color=WHITE, electron_color=BLUE, proton_color=RED, neutron_color=WHITE, **kwargs)`
— Bohr model with electrons on circular orbits. `e`, `p`, `n` set electron/proton/neutron counts. Defaults are for silicon (14/14/10). Access sub-groups via `.get_electrons()`, `.get_orbitals()`, `.get_nuclei()`.

`MElementObject(atomic_number=1, atomic_mass=1, element_name='Hydrogen', element_symbol='H', coloring=BLACK, fill_colors=(WHITE, BLUE), gradient=10, opacity=1, text_color=BLACK, **kwargs)`
— A single periodic-table tile (symbol, number, mass). All parameters are keyword arguments with defaults; supply the fields you want to customise.

`MMoleculeObject(atoms_dict, bonds_dict, representation_type=None, explicit_carbons=False, explicit_hydrogens=False, planar=True, add_atoms_numbering=False, add_bonds_numbering=False, rotate_bonds=[], **kwargs)`
— 2D molecule from raw atom/bond dicts. Rarely constructed directly; use the class-method factories below.
- `MMoleculeObject.from_mol_file(filename, **kwargs)` — load from a `.mol` file on disk (needs a file path).
- `MMoleculeObject.from_mol_string(mol_string, **kwargs)` — load from a MOL-format string.
- `MMoleculeObject.molecule_from_pubchem(cid=None, name=None, smiles=None, inchi=None, three_d=False, elements_data_dict=None, **kwargs)` — **network call to PubChem API; do not use in offline/sandbox environments.**
- `MMoleculeObject.multiple_molecules_from_file(...)` / `.multiple_molecules_from_string(...)` also exist.

`GraphMolecule(vertices_dict, edges_dict, label=False, numeric_label=False, label_color=BLACK, **kwargs)`
— Graph-based 2D molecule diagram (inherits from manim `Graph`). Atoms are `.atoms` (`.vertices`), bonds are `.bonds` (`.edges`).
- `GraphMolecule.molecule_from_pubchem(cid=None, name=None, smiles=None, inchi=None, three_d=False, elements_data_dict=None, **kwargs)` — **network call; risky in sandbox.**
- `GraphMolecule.molecule_from_string(string, format, elements_data_dict=None, **kwargs)` also exists.

`NamedMolecule(name, molecule_data, direction=DOWN, buff=1, tex=False, font='', **kwargs)`
— A `MMoleculeObject` with a label beneath it.

`Orbital(n=None, l=0, m=0, size=3, **kwargs)`
— Atomic orbital shape (3D surface, requires OpenGL renderer in practice). `l` is the orbital type (0=s, 1=p, 2=d …); `m` is the magnetic quantum number; `n` defaults to `l+1`.

`ChemicalFormula(formula: str, metal_color=WHITE, non_metal_color=WHITE, oxygen_color=WHITE, **kwargs)`
— Typeset a chemical formula string with optional atom colouring.

`NamedFormula(metal_name: str, non_metal_name: str, formula: str, metal_color=WHITE, non_metal_color=WHITE, oxygen_color=WHITE, font='', spanish_structure=False, buff=0.25, direction=DOWN, **kwargs)`
— A `ChemicalFormula` with metal and non-metal name labels.

`ComplexFormula(formula_dict: dict, **kwargs)` — multi-component formula.

`NamedComplexFormula(name_dict: dict, formula_dict: dict, direction=DOWN, buff=0.25, **kwargs)` — named variant.

**Canonical pattern (Bohr atom)**
```python
from manim_chemistry import BohrAtom

atom = BohrAtom(e=6, p=6, n=6)          # carbon: 6 electrons, 6 protons, 6 neutrons
atom.move_to(ORIGIN)
self.play(Create(atom))
```

**Canonical pattern (element tile)**
```python
from manim_chemistry import MElementObject

carbon = MElementObject(
    atomic_number=6,
    atomic_mass=12,
    element_name="Carbon",
    element_symbol="C",
    fill_colors=("#909090", "#58C4DD"),
)
carbon.scale(1.5).move_to(ORIGIN)
self.play(FadeIn(carbon, scale=0.5))
```

**Canonical pattern (molecule from MOL string)**
```python
from manim_chemistry import MMoleculeObject

# mol_string must be a valid V2000 or V3000 MOL format string
mol = MMoleculeObject.from_mol_string(mol_string)
mol.move_to(ORIGIN)
self.play(Create(mol))
```

**Canonical pattern (chemical formula)**
```python
from manim_chemistry import ChemicalFormula

formula = ChemicalFormula("H2O")
formula.move_to(ORIGIN)
self.play(Write(formula))
```

**Gotchas**
- `MElementObject` requires ALL four text fields (`atomic_number`, `atomic_mass`, `element_name`, `element_symbol`) to render a complete tile. The constructor has defaults (Hydrogen) but you should always supply the correct values.
- `MElementObject.from_csv_file_data(filename, atomic_number)` needs a CSV data file path — do NOT use this in sandbox; construct directly instead.
- `molecule_from_pubchem` on both `MMoleculeObject` and `GraphMolecule` makes a **live network call** to PubChem. It will fail in offline/firewalled environments — flag this and use `from_mol_string` or `from_mol_file` instead.
- `ThreeDMolecule` **requires OpenGL renderer** (`--renderer=opengl`). In the standard Cairo renderer it raises an exception immediately. Do not use it unless you are certain the render environment uses OpenGL.
- `Orbital` is a 3D surface mobject (inherits from `Surface`). It renders positively and negatively lobed orbital shapes. Best displayed in a `ThreeDScene`.
- `BohrAtom` is the most robust headline visual — reach for it first for atom/structure prompts. It works in standard 2D scenes.
- `PeriodicTable(data_file, ...)` requires a CSV data file as first positional argument — risky in sandbox.
- None of the plugin methods return an `Animation`. All objects are Mobjects — animate them with standard manim animations: `Create(obj)`, `FadeIn(obj)`, `Write(obj)`, etc.

<!-- verified against manim_chemistry via introspection on 2026-06-08 -->
