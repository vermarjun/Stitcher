# Vendored Manim plugins

These are patched copies of six third-party MIT plugins. The Dockerfile installs
each one with `pip install --no-deps ./vendor/<plugin>` and installs the real
dependencies separately, so Manim stays pinned at 0.19.2. Each directory keeps
its upstream license.

| Plugin | Upstream | Vendored version | License | Our patches |
|---|---|---|---|---|
| [manim-physics](https://pypi.org/project/manim-physics/) | https://github.com/Matheart/manim-physics | 0.4.0 | MIT | manim dependency pin relaxed from `~0.18.0` to `>=0.18,<0.20` |
| [manim-dsa](https://pypi.org/project/manim-dsa/) | https://github.com/F4bbi/manim-dsa | 0.4.0 | MIT | `typing.override` is Python 3.12 only, switched to `typing_extensions.override` |
| [manim-chess](https://pypi.org/project/manim-chess/) | https://github.com/swoyer2/manim_chess | 0.0.38 | MIT | `requires-python` relaxed from `>=3.12` to `>=3.11` |
| [manim-ml](https://pypi.org/project/manim-ml/) | https://github.com/helblazer811/ManimML | 0.0.17 | MIT | Empty `AnimationGroup` deadlock fix; `rotate()` kwarg fix; `three_d_config` import fix; `BlankConnective` abstract method fix |
| [manim-chemistry](https://pypi.org/project/manim-chemistry/) | https://github.com/UnMolDeQuimica/manim-Chemistry | 0.5.0 (set by the Dockerfile, the tree has no version field) | MIT | scipy `sph_harm` removed in 1.17, compat shim added; `from_mol_file` string/object element type fix |
| [manim-astronomy](https://pypi.org/project/manim-Astronomy/) | https://github.com/hassamrajpoot/manim-Astronomy | 0.0.5 | MIT | Lazy vedo import so `Star`, `Planet` and `SpaceTimeFabric` work without vtk; absolute `.obj` asset paths; `JamesWebbSpaceTelescope` added to `__all__` |

Note on manim-dsa: the upstream repository and the PyPI sdist for 0.4.0 contain no
LICENSE file. Upstream declares MIT in `pyproject.toml`, `CITATION.cff` and the README.
`vendor/manim-dsa/LICENSE` is therefore the standard MIT text with the author named in
`pyproject.toml` (Fabio Missagia), and says so in its header. It is not copied from
upstream, and upstream states no copyright year.
