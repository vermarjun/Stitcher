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


def test_voiceover_scene_imports_allowed() -> None:
    # Native voiceover scenes import manim_voiceover + stitcher_voiceover and subclass
    # VoiceoverScene. All three must pass the AST guard.
    code = """
from manim import *
from manim_voiceover import VoiceoverScene
from stitcher_voiceover import OfflineTTS

class Scene00(VoiceoverScene):
    def construct(self):
        self.set_speech_service(OfflineTTS(), create_subcaption=False)
        with self.voiceover(text="hello world") as tracker:
            self.play(Write(Text("hi")), run_time=tracker.duration)
"""
    assert validate(code) == []


def test_voiceover_scene_still_rejects_socket() -> None:
    # Security regression guard: enabling voiceover imports must NOT loosen the bans.
    code = """
from manim_voiceover import VoiceoverScene
import socket

class Scene00(VoiceoverScene):
    def construct(self):
        socket.socket()
"""
    assert any("'socket'" in i.summary for i in validate(code))


def test_voiceover_scene_still_rejects_subprocess() -> None:
    code = """
from manim_voiceover import VoiceoverScene
import subprocess

class Scene00(VoiceoverScene):
    def construct(self):
        subprocess.run(["ls"])
"""
    assert any("'subprocess'" in i.summary for i in validate(code))


def test_voiceover_scene_still_rejects_os_system() -> None:
    code = """
from manim_voiceover import VoiceoverScene
import os

class Scene00(VoiceoverScene):
    def construct(self):
        os.system("id")
"""
    issues = validate(code)
    assert any("'os'" in i.summary for i in issues)
    assert any(".system" in i.summary for i in issues)


def test_voiceover_scene_still_rejects_eval() -> None:
    code = """
from manim_voiceover import VoiceoverScene

class Scene00(VoiceoverScene):
    def construct(self):
        eval("1+1")
"""
    assert any("'eval'" in i.summary for i in validate(code))
