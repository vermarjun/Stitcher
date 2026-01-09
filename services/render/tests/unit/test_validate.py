from __future__ import annotations

from app.core.validate import validate


def test_clean_manim_scene_passes() -> None:
    code = """
from manim import *
import numpy as np

class Hello(Scene):
    def construct(self):
        self.play(Write(Text("hi")))
"""
    assert validate(code) == []


def test_syntax_error_surfaces_line() -> None:
    issues = validate("class Broken(Scene):\n    def construct(self)\n        pass\n")
    assert len(issues) == 1
    assert "SyntaxError" in issues[0].summary


def test_os_import_rejected() -> None:
    issues = validate("import os\nos.system('rm -rf /')\n")
    assert any("'os'" in i.summary for i in issues)


def test_eval_call_rejected() -> None:
    issues = validate("x = eval('1+1')\n")
    assert any("'eval'" in i.summary for i in issues)


def test_dunder_access_rejected() -> None:
    issues = validate("x = ().__class__.__bases__\n")
    assert any("__class__" in i.summary or "__bases__" in i.summary for i in issues)


def test_scipy_sympy_allowed() -> None:
    code = "import scipy\nimport sympy\nfrom sympy import Symbol\n"
    assert validate(code) == []
