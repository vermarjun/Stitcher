from pathlib import Path

from manim import Scene, ThreeDScene, config

from manim_chemistry import (
    BohrAtom,
    GraphMolecule,
    MElementObject,
    MMoleculeObject,
    Orbital,
    PeriodicTable,
    ThreeDMolecule,
)

script_path = Path(__file__).absolute().parent
files_path = script_path / "molecule_files/mol_files"
csv_path = script_path / "element_files/Elementos.csv"


# 2D Molecule example
class Draw2DMorphine(Scene):
    # Two D Manim Chemistry objects require Cairo renderer

    def construct(self):
        config.renderer = "cairo"
        morphine = MMoleculeObject.molecule_from_file(
            filepath=files_path / "morphine_2d.mol"
        )
        self.add(morphine)


# 2D Graph Molecule example
class DrawGraphMorphine(Scene):
    # Two D Manim Chemistry objects require Cairo renderer

    def construct(self):
        config.renderer = "cairo"
        self.add(GraphMolecule.molecule_from_file(filepath=files_path / "morphine_2d.mol"))


# 2D Graph Molecule example
class DrawLabeledGraphMorphine(Scene):
    # Two D Manim Chemistry objects require Cairo renderer

    def construct(self):
        config.renderer = "cairo"
        self.add(
            GraphMolecule.molecule_from_file(
                filepath=files_path / "morphine_2d.mol", label=True
            )
        )


# 3D Molecule example
class Draw3DMorphine(ThreeDScene):
    # Three D Manim Chemistry objects require Opengl renderer

    def construct(self):
        config.renderer = "opengl"
        self.add(
            ThreeDMolecule.molecule_from_file(
                filepath=files_path / "morphine_3d.mol",
            )
        )
        self.wait()

        # Set the renderer back to cairo to prevent issues with other examples
        config.renderer = "cairo"


# Element example
class DrawCarbonElement(Scene):
    # Two D Manim Chemistry objects require Cairo renderer

    def construct(self):
        config.renderer = "cairo"
        self.add(
            MElementObject.from_csv_file_data(
                filename=csv_path, atomic_number=6
            )
        )


# Periodic Table example
class DrawPeriodicTable(Scene):
    # Two D Manim Chemistry objects require Cairo renderer

    def construct(self):
        config.renderer = "cairo"
        self.add(PeriodicTable(data_file=csv_path))


# Orbitals example
class DrawPOrbital(ThreeDScene):
    # Three D Manim Chemistry objects require Opengl renderer

    def construct(self):
        config.renderer = "opengl"
        self.add(Orbital(l=1, m=-1))
        config.renderer = "cairo"


# Bohr diagram example
class BohrDiagram(Scene):
    # Two D Manim Chemistry objects require Cairo renderer

    def construct(self):
        config.renderer = "cairo"
        self.add(BohrAtom())
