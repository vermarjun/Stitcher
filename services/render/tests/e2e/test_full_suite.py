"""
Comprehensive end-to-end test suite for manim-render-service.

Covers: basic animations, LaTeX/MathTex, 3D scenes, all output formats,
        quality levels, edge/error cases, audio muxing, transparent bg,
        custom backgrounds, frame ranges, and security rejections.

Run: python tests/e2e/test_full_suite.py
"""

import base64
import json
import os
import struct
import sys
import time
import wave
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

import requests

API_KEY = os.environ.get("RENDER_API_KEY", "REDACTED")
BASE_URL = os.environ.get("SERVICE_URL", "http://localhost:8000")
HEADERS = {"X-Api-Key": API_KEY, "Content-Type": "application/json"}


# ──────────────────────────────────────────────────────────────────────────────
# Test harness
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class Result:
    name: str
    passed: bool
    reason: str
    response: dict | None = field(default=None, repr=False)
    elapsed: float = 0.0


results: list[Result] = []


def run(name: str, payload: dict, *, expect_success: bool = True,
        expect_category: str | None = None,
        expect_phase: str | None = None,
        extra_checks: list[tuple[str, Any]] | None = None) -> Result:
    t0 = time.time()
    try:
        r = requests.post(f"{BASE_URL}/render", json=payload, headers=HEADERS, timeout=300)
        body = r.json()
    except Exception as exc:
        result = Result(name=name, passed=False, reason=f"HTTP error: {exc}", elapsed=time.time() - t0)
        results.append(result)
        return result

    elapsed = time.time() - t0

    if r.status_code not in (200, 400, 401, 503):
        result = Result(name=name, passed=False, reason=f"Unexpected HTTP {r.status_code}",
                        response=body, elapsed=elapsed)
        results.append(result)
        return result

    success = body.get("success", False)
    errors: list[str] = []

    if expect_success and not success:
        err = body.get("error", {})
        errors.append(f"Expected success but got error: [{err.get('category')}] {err.get('summary')}")

    if not expect_success and success:
        errors.append("Expected failure but got success")

    if expect_category:
        actual_cat = body.get("error", {}).get("category")
        if actual_cat != expect_category:
            errors.append(f"Expected category={expect_category!r}, got {actual_cat!r}")

    if expect_phase:
        actual_phase = body.get("error", {}).get("phase")
        if actual_phase != expect_phase:
            errors.append(f"Expected phase={expect_phase!r}, got {actual_phase!r}")

    if expect_success and success:
        render = body.get("render", {})
        if not render.get("url"):
            errors.append("Missing render.url")
        if render.get("durationSec", -1) < 0 and payload.get("render", {}).get("format") not in ("png", "svg"):
            errors.append("Missing render.durationSec")

    if extra_checks:
        for path_str, expected in extra_checks:
            parts = path_str.split(".")
            node = body
            for p in parts:
                node = node.get(p, {}) if isinstance(node, dict) else None
            if node != expected:
                errors.append(f"Check {path_str!r}: expected {expected!r}, got {node!r}")

    passed = len(errors) == 0
    reason = "; ".join(errors) if errors else "ok"
    result = Result(name=name, passed=passed, reason=reason, response=body, elapsed=elapsed)
    results.append(result)
    return result


def render(name: str, code: str, scene_class: str, **kwargs) -> Result:
    payload: dict = {
        "code": code,
        "sceneClass": scene_class,
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
    }
    render_opts = kwargs.pop("render_opts", {})
    storage_opts = kwargs.pop("storage_opts", {})
    payload["render"].update(render_opts)
    payload["storage"].update(storage_opts)
    return run(name, payload, **kwargs)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def make_wav_b64(duration_sec: float = 1.0, sample_rate: int = 22050) -> str:
    """Generate a silent WAV file and return it as base64."""
    n_samples = int(sample_rate * duration_sec)
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * n_samples)
    return base64.b64encode(buf.getvalue()).decode()


# ──────────────────────────────────────────────────────────────────────────────
# Test cases
# ──────────────────────────────────────────────────────────────────────────────

def test_infrastructure():
    print("\n── Infrastructure ──────────────────────────────────────────────────")

    # /health
    r = requests.get(f"{BASE_URL}/health", timeout=10)
    ok = r.status_code == 200 and r.json().get("status") == "ok"
    results.append(Result("health_endpoint", ok, "ok" if ok else f"status={r.json().get('status')}"))

    # /capabilities
    r = requests.get(f"{BASE_URL}/capabilities", timeout=10)
    cap = r.json()
    ok = r.status_code == 200 and cap.get("manimVersion") is not None
    results.append(Result("capabilities_endpoint", ok, "ok" if ok else "missing manimVersion"))

    # /metrics
    r = requests.get(f"{BASE_URL}/metrics", timeout=10)
    ok = r.status_code == 200 and "renders_total" in r.text
    results.append(Result("metrics_endpoint", ok, "ok" if ok else "missing renders_total"))

    # auth rejection
    r = requests.post(f"{BASE_URL}/render", json={}, headers={"Content-Type": "application/json"}, timeout=10)
    ok = r.status_code == 401
    results.append(Result("auth_rejection_no_key", ok, "ok" if ok else f"Expected 401, got {r.status_code}"))

    r = requests.post(f"{BASE_URL}/render", json={}, headers={"X-Api-Key": "wrong", "Content-Type": "application/json"}, timeout=10)
    ok = r.status_code == 401
    results.append(Result("auth_rejection_bad_key", ok, "ok" if ok else f"Expected 401, got {r.status_code}"))


def test_basic_animations():
    print("\n── Basic Animations ────────────────────────────────────────────────")

    render("basic_text_write", """
from manim import *

class BasicText(Scene):
    def construct(self):
        t = Text("Hello, Manim!", font_size=48)
        self.play(Write(t))
        self.wait(0.5)
""", "BasicText")

    render("basic_circle_create", """
from manim import *

class CircleScene(Scene):
    def construct(self):
        c = Circle(radius=2, color=BLUE)
        self.play(Create(c))
        self.wait(0.3)
""", "CircleScene")

    render("basic_square_to_circle_transform", """
from manim import *

class SquareToCircle(Scene):
    def construct(self):
        sq = Square(side_length=2, color=YELLOW)
        ci = Circle(radius=1.5, color=RED)
        self.play(Create(sq))
        self.play(Transform(sq, ci))
        self.wait(0.3)
""", "SquareToCircle")

    render("basic_fade_in_out", """
from manim import *

class FadeInOut(Scene):
    def construct(self):
        mob = Star(color=GOLD)
        self.play(FadeIn(mob))
        self.play(FadeOut(mob))
""", "FadeInOut")

    render("basic_move_along_path", """
from manim import *

class MovingDot(Scene):
    def construct(self):
        dot = Dot(color=RED)
        path = Arc(radius=2, angle=TAU)
        self.play(MoveAlongPath(dot, path), run_time=2)
""", "MovingDot")

    render("basic_rotation", """
from manim import *

class RotateSquare(Scene):
    def construct(self):
        sq = Square(color=TEAL)
        self.play(Rotate(sq, angle=TAU, run_time=2))
""", "RotateSquare")

    render("basic_value_tracker", """
from manim import *

class ValueTrackerDemo(Scene):
    def construct(self):
        tracker = ValueTracker(0)
        num = always_redraw(lambda: DecimalNumber(tracker.get_value()).to_edge(UP))
        self.add(num)
        self.play(tracker.animate.set_value(10), run_time=2)
""", "ValueTrackerDemo")

    render("basic_multiple_objects", """
from manim import *

class MultiObjects(Scene):
    def construct(self):
        shapes = VGroup(
            Circle(color=RED),
            Square(color=GREEN).shift(LEFT * 3),
            Triangle(color=BLUE).shift(RIGHT * 3),
        )
        self.play(Create(shapes))
        self.play(shapes.animate.shift(DOWN))
        self.wait(0.3)
""", "MultiObjects")


def test_latex_mathtex():
    print("\n── LaTeX / MathTex ─────────────────────────────────────────────────")

    render("latex_basic_equation", """
from manim import *

class BasicEquation(Scene):
    def construct(self):
        eq = MathTex("E = mc^2", font_size=72)
        self.play(Write(eq))
        self.wait(0.5)
""", "BasicEquation")

    render("latex_pythagorean", """
from manim import *

class Pythagorean(Scene):
    def construct(self):
        eq = MathTex("a^2 + b^2 = c^2", font_size=60)
        self.play(Write(eq))
        self.wait(0.5)
""", "Pythagorean")

    render("latex_multiline_align", """
from manim import *

class MultilineAlign(Scene):
    def construct(self):
        eq = MathTex(
            r"\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}",
            font_size=48,
        )
        self.play(Write(eq))
        self.wait(0.5)
""", "MultilineAlign")

    render("latex_tex_text", """
from manim import *

class TexText(Scene):
    def construct(self):
        t = Tex(r"This is \textbf{bold} and $x^2$", font_size=40)
        self.play(FadeIn(t))
        self.wait(0.5)
""", "TexText")

    render("latex_transform_equations", """
from manim import *

class TransformEquations(Scene):
    def construct(self):
        eq1 = MathTex("x^2 + 2x + 1 = 0")
        eq2 = MathTex("(x + 1)^2 = 0")
        self.play(Write(eq1))
        self.play(TransformMatchingShapes(eq1, eq2))
        self.wait(0.5)
""", "TransformEquations")

    render("latex_color_highlighting", """
from manim import *

class ColorHighlight(Scene):
    def construct(self):
        eq = MathTex(r"e^{i\pi} + 1 = 0", font_size=64)
        eq.set_color_by_tex("e", YELLOW)
        eq.set_color_by_tex("i", BLUE)
        eq.set_color_by_tex("\\pi", RED)
        self.play(Write(eq))
        self.wait(0.5)
""", "ColorHighlight")

    render("latex_invalid_raises_error", """
from manim import *

class BadLatex(Scene):
    def construct(self):
        eq = MathTex(r"\invalidcommand{xyz}", font_size=48)
        self.play(Write(eq))
        self.wait(0.3)
""", "BadLatex", expect_success=False)


def test_graphs_plots():
    print("\n── Graphs / Plots ──────────────────────────────────────────────────")

    render("graph_axes_sine", """
from manim import *

class SinePlot(Scene):
    def construct(self):
        ax = Axes(x_range=[-3, 3, 1], y_range=[-1.5, 1.5, 0.5])
        curve = ax.plot(lambda x: np.sin(x), color=BLUE)
        self.play(Create(ax), Create(curve))
        self.wait(0.3)
""", "SinePlot")

    render("graph_number_plane", """
from manim import *

class NumberPlanePlot(Scene):
    def construct(self):
        plane = NumberPlane()
        parabola = plane.plot(lambda x: x ** 2 / 4, color=GREEN)
        self.play(Create(plane), Create(parabola))
        self.wait(0.3)
""", "NumberPlanePlot")

    render("graph_bar_chart", """
from manim import *

class BarChartScene(Scene):
    def construct(self):
        chart = BarChart(
            values=[3, 5, 2, 7, 4],
            bar_names=["A", "B", "C", "D", "E"],
            y_range=[0, 10, 2],
        )
        self.play(Create(chart))
        self.wait(0.3)
""", "BarChartScene")

    render("graph_number_line", """
from manim import *

class NumberLinePlot(Scene):
    def construct(self):
        nl = NumberLine(x_range=[-5, 5, 1])
        dot = Dot(nl.n2p(0), color=RED)
        self.play(Create(nl), FadeIn(dot))
        self.play(dot.animate.move_to(nl.n2p(3)))
        self.wait(0.3)
""", "NumberLinePlot")

    render("graph_complex_multi_curve", """
from manim import *

class MultiCurve(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 4*PI, PI], y_range=[-1.5, 1.5, 0.5])
        sin_c = ax.plot(lambda x: np.sin(x), color=BLUE)
        cos_c = ax.plot(lambda x: np.cos(x), color=RED)
        self.play(Create(ax))
        self.play(Create(sin_c), Create(cos_c))
        self.wait(0.3)
""", "MultiCurve")


def test_3d_scenes():
    print("\n── 3D Scenes ───────────────────────────────────────────────────────")

    render("3d_basic_axes", """
from manim import *

class ThreeDAxesScene(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)
        self.add(axes)
        self.begin_ambient_camera_rotation(rate=0.2)
        self.wait(1.5)
        self.stop_ambient_camera_rotation()
""", "ThreeDAxesScene")

    render("3d_sphere", """
from manim import *

class SphereMesh(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(phi=60 * DEGREES, theta=45 * DEGREES)
        sphere = Sphere(radius=2)
        self.play(Create(sphere))
        self.begin_ambient_camera_rotation(rate=0.3)
        self.wait(1.5)
        self.stop_ambient_camera_rotation()
""", "SphereMesh")

    render("3d_surface_plot", """
from manim import *

class SurfacePlot(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(phi=60 * DEGREES, theta=30 * DEGREES)
        axes = ThreeDAxes(x_range=[-3, 3], y_range=[-3, 3], z_range=[-2, 2])
        surface = Surface(
            lambda u, v: axes.c2p(u, v, np.sin(u) * np.cos(v)),
            u_range=[-3, 3],
            v_range=[-3, 3],
            resolution=(15, 15),
            fill_opacity=0.8,
        )
        surface.set_fill_by_value(axes=axes, colorscale=[(BLUE, -1), (GREEN, 0), (RED, 1)], axis=2)
        self.play(Create(axes), Create(surface))
        self.wait(0.5)
""", "SurfacePlot")

    render("3d_cube", """
from manim import *

class RotatingCube(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(phi=70 * DEGREES, theta=30 * DEGREES)
        cube = Cube(side_length=2, fill_opacity=0.7, fill_color=BLUE)
        self.play(Create(cube))
        self.play(Rotate(cube, angle=PI/2, axis=UP, run_time=2))
        self.wait(0.3)
""", "RotatingCube")

    render("3d_torus", """
from manim import *

class TorusMesh(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(phi=50 * DEGREES, theta=45 * DEGREES)
        torus = Torus(major_radius=2, minor_radius=0.5)
        self.play(Create(torus))
        self.wait(0.5)
""", "TorusMesh")

    render("3d_camera_move", """
from manim import *

class CameraMovement(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        sphere = Sphere(radius=1, color=BLUE)
        self.set_camera_orientation(phi=0, theta=0)
        self.play(Create(axes), Create(sphere))
        self.move_camera(phi=75 * DEGREES, theta=30 * DEGREES, run_time=2)
        self.wait(0.5)
""", "CameraMovement")


def test_output_formats():
    print("\n── Output Formats ──────────────────────────────────────────────────")

    code = """
from manim import *

class FormatTest(Scene):
    def construct(self):
        t = Text("Format Test", font_size=40)
        self.play(Write(t))
        self.wait(0.3)
"""
    for fmt in ["mp4", "webm", "mov", "gif"]:
        render(f"format_{fmt}", code, "FormatTest", render_opts={"format": fmt})

    # PNG — single frame (uses --save_last_frame internally)
    render("format_png", """
from manim import *

class PngScene(Scene):
    def construct(self):
        sq = Square(color=PURPLE, fill_opacity=0.8)
        self.add(sq)
""", "PngScene", render_opts={"format": "png"})


def test_quality_levels():
    print("\n── Quality Levels ──────────────────────────────────────────────────")

    code = """
from manim import *

class QualityTest(Scene):
    def construct(self):
        c = Circle(color=ORANGE)
        self.play(Create(c))
        self.wait(0.2)
"""
    for q in ["low", "medium", "high"]:
        render(f"quality_{q}", code, "QualityTest", render_opts={"quality": q})


def test_render_options():
    print("\n── Render Options ──────────────────────────────────────────────────")

    render("custom_background_color", """
from manim import *

class DarkBg(Scene):
    def construct(self):
        t = Text("Dark Background", color=WHITE, font_size=40)
        self.play(FadeIn(t))
        self.wait(0.3)
""", "DarkBg", render_opts={"background": "#0b1020"})

    render("transparent_background", """
from manim import *

class TransparentBg(Scene):
    def construct(self):
        c = Circle(color=BLUE, fill_opacity=0.6)
        self.play(Create(c))
        self.wait(0.3)
""", "TransparentBg", render_opts={"format": "webm", "transparent": True})

    render("custom_fps_override", """
from manim import *

class FpsTest(Scene):
    def construct(self):
        sq = Square(color=GREEN)
        self.play(Create(sq), run_time=1)
        self.wait(0.2)
""", "FpsTest", render_opts={"fps": 24})

    render("thumbnail_generation", """
from manim import *

class ThumbnailTest(Scene):
    def construct(self):
        t = Text("Thumbnail Frame", font_size=48)
        self.play(FadeIn(t))
        self.wait(0.5)
""", "ThumbnailTest", storage_opts={"generateThumbnail": True, "thumbnailAt": 0.5})

    render("custom_folder", """
from manim import *

class FolderTest(Scene):
    def construct(self):
        t = Text("Custom Folder", font_size=36)
        self.play(Write(t))
        self.wait(0.3)
""", "FolderTest", storage_opts={"folder": "test_custom_folder"})


def test_audio_muxing():
    print("\n── Audio Muxing ────────────────────────────────────────────────────")

    wav_b64 = make_wav_b64(duration_sec=2.0)

    code = """
from manim import *

class WithAudio(Scene):
    def construct(self):
        t = Text("Scene with Audio", font_size=40)
        self.play(FadeIn(t))
        self.wait(1.5)
"""
    payload = {
        "code": code,
        "sceneClass": "WithAudio",
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
        "audio": {
            "base64": wav_b64,
            "filename": "bg.wav",
            "offset": 0.0,
            "gain": 0,
        },
    }
    r = run("audio_mux_wav", payload, expect_success=True,
            extra_checks=[("render.hasAudio", True)])


def test_numpy_scipy_sympy():
    print("\n── numpy / scipy / sympy ───────────────────────────────────────────")

    render("numpy_usage", """
from manim import *
import numpy as np

class NumpyScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-3, 3], y_range=[-1, 5])
        curve = ax.plot(lambda x: np.exp(-x**2), color=GREEN)
        self.play(Create(ax), Create(curve))
        self.wait(0.3)
""", "NumpyScene")

    # sympy is listed in the validator allowlist but not installed in the default Docker image
    run("sympy_not_installed_graceful_error", {
        "code": "from manim import *\nimport sympy as sp\n\nclass SympyScene(Scene):\n    def construct(self):\n        x = sp.Symbol('x')\n        expr = sp.latex(sp.integrate(sp.sin(x), x))\n        label = MathTex(expr, font_size=48)\n        self.play(Write(label))\n        self.wait(0.5)\n",
        "sceneClass": "SympyScene",
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
    }, expect_success=False, expect_category="ImportError")


def test_advanced_manim():
    print("\n── Advanced Manim Features ─────────────────────────────────────────")

    render("updaters_always_redraw", """
from manim import *

class UpdaterDemo(Scene):
    def construct(self):
        sq = Square()
        label = always_redraw(lambda: Text(f"x={sq.get_center()[0]:.2f}", font_size=24).next_to(sq, UP))
        self.add(sq, label)
        self.play(sq.animate.shift(RIGHT * 3), run_time=2)
        self.wait(0.3)
""", "UpdaterDemo")

    render("parametric_curve", """
from manim import *

class Lissajous(Scene):
    def construct(self):
        ax = Axes(x_range=[-2, 2], y_range=[-2, 2])
        curve = ParametricFunction(
            lambda t: ax.c2p(np.sin(3 * t), np.sin(2 * t)),
            t_range=[0, 2 * PI],
            color=ORANGE,
        )
        self.play(Create(ax))
        self.play(Create(curve), run_time=3)
        self.wait(0.3)
""", "Lissajous")

    render("number_animation", """
from manim import *

class CountingUp(Scene):
    def construct(self):
        num = Integer(0).scale(2)
        self.play(ChangeDecimalToValue(num, 100), run_time=3)
        self.wait(0.3)
""", "CountingUp")

    render("brace_annotation", """
from manim import *

class BraceScene(Scene):
    def construct(self):
        line = Line(LEFT * 2, RIGHT * 2, color=WHITE)
        brace = Brace(line, direction=DOWN)
        label = brace.get_tex(r"2L")
        self.play(GrowFromCenter(line))
        self.play(GrowFromCenter(brace), Write(label))
        self.wait(0.3)
""", "BraceScene")

    render("table_mobject", """
from manim import *

class ManimTable(Scene):
    def construct(self):
        t = Table(
            [["1", "2", "3"], ["4", "5", "6"]],
            row_labels=[Text("R1"), Text("R2")],
            col_labels=[Text("A"), Text("B"), Text("C")],
        )
        self.play(Create(t))
        self.wait(0.5)
""", "ManimTable")

    render("pie_chart", """
from manim import *

class PieChartScene(Scene):
    def construct(self):
        chart = AnnularSector(
            inner_radius=1, outer_radius=2, angle=PI, fill_color=BLUE, fill_opacity=0.8
        )
        self.play(Create(chart))
        self.wait(0.3)
""", "PieChartScene")

    render("scene_with_camera_frame", """
from manim import *

class ZoomIn(MovingCameraScene):
    def construct(self):
        t = Text("Zoom In!", font_size=48)
        self.play(Write(t))
        self.play(self.camera.frame.animate.scale(0.5).move_to(t))
        self.wait(0.5)
""", "ZoomIn")

    render("write_and_indicate", """
from manim import *

class IndicateScene(Scene):
    def construct(self):
        eq = MathTex(r"F = ma")
        self.play(Write(eq))
        self.play(Indicate(eq[0][2]))  # Indicate 'a'
        self.wait(0.3)
""", "IndicateScene")


def test_edge_cases_and_errors():
    print("\n── Edge Cases & Error Handling ─────────────────────────────────────")

    # Syntax error
    r = run("error_syntax", {
        "code": "from manim import *\n\nclass Bad(Scene:\n    pass",
        "sceneClass": "Bad",
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
    }, expect_success=False, expect_category="SyntaxError")

    # NameError (undefined mobject)
    run("error_name_error", {
        "code": "from manim import *\n\nclass N(Scene):\n    def construct(self):\n        self.play(Create(UndefinedClass()))",
        "sceneClass": "N",
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
    }, expect_success=False, expect_category="NameError")

    # Banned import (os)
    run("error_banned_import_os", {
        "code": "import os\nfrom manim import *\n\nclass B(Scene):\n    def construct(self):\n        os.system('ls')\n        self.add(Circle())",
        "sceneClass": "B",
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
    }, expect_success=False, expect_phase="validation")

    # Banned import (subprocess)
    run("error_banned_import_subprocess", {
        "code": "import subprocess\nfrom manim import *\n\nclass B(Scene):\n    def construct(self):\n        subprocess.run(['ls'])",
        "sceneClass": "B",
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
    }, expect_success=False, expect_phase="validation")

    # Scene class not found
    run("error_wrong_scene_class", {
        "code": "from manim import *\n\nclass MyScene(Scene):\n    def construct(self):\n        self.add(Circle())",
        "sceneClass": "NonExistentClass",
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
    }, expect_success=False)

    # Malformed JSON / validation failure
    r2 = requests.post(f"{BASE_URL}/render", data="not-json", headers={**HEADERS, "Content-Type": "application/json"}, timeout=10)
    ok = r2.status_code == 422
    results.append(Result("error_malformed_json", ok, "ok" if ok else f"Expected 422, got {r2.status_code}"))

    # Missing required fields
    r3 = requests.post(f"{BASE_URL}/render", json={"code": "x", "sceneClass": "Y"}, headers=HEADERS, timeout=10)
    ok = r3.status_code in (200, 400, 422)
    results.append(Result("error_missing_render_field_graceful", ok, "ok" if ok else f"Got {r3.status_code}"))

    # Timeout (short timeout on pure CPU infinite loop — no banned imports needed)
    run("error_timeout", {
        "code": "from manim import *\nimport math\n\nclass Inf(Scene):\n    def construct(self):\n        x = 0\n        while True:\n            x = math.sin(x + 1)",
        "sceneClass": "Inf",
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
        "limits": {"timeoutSec": 5},
    }, expect_success=False, expect_category="Timeout")


def test_tracing():
    print("\n── Tracing / Meta ──────────────────────────────────────────────────")

    payload = {
        "code": "from manim import *\n\nclass TracedScene(Scene):\n    def construct(self):\n        self.play(FadeIn(Dot()))\n        self.wait(0.2)\n",
        "sceneClass": "TracedScene",
        "render": {"quality": "low", "format": "mp4"},
        "storage": {"backend": "local"},
        "meta": {"traceId": "test-trace-abc123"},
    }
    run("trace_id_echoed", payload, expect_success=True,
        extra_checks=[("meta.traceId", "test-trace-abc123")])


def test_concurrent_requests():
    print("\n── Concurrency ─────────────────────────────────────────────────────")
    import concurrent.futures

    code = """
from manim import *

class Concurrent(Scene):
    def construct(self):
        self.play(Create(Circle()))
        self.wait(0.2)
"""
    payloads = [
        {"code": code, "sceneClass": "Concurrent",
         "render": {"quality": "low", "format": "mp4"},
         "storage": {"backend": "local"}}
        for _ in range(3)
    ]

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        futs = [ex.submit(requests.post, f"{BASE_URL}/render", json=p, headers=HEADERS, timeout=300) for p in payloads]
        responses = [f.result() for f in concurrent.futures.as_completed(futs)]

    success_count = sum(1 for r in responses if r.status_code == 200 and r.json().get("success"))
    ok = success_count == 3
    results.append(Result("concurrent_3_renders", ok,
                          f"ok ({success_count}/3 succeeded)" if ok else f"Only {success_count}/3 succeeded"))


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def print_results():
    PASS = "\033[92m✓\033[0m"
    FAIL = "\033[91m✗\033[0m"

    passed = [r for r in results if r.passed]
    failed = [r for r in results if not r.passed]

    print("\n" + "=" * 70)
    print(f"  E2E TEST REPORT — manim-render-service")
    print("=" * 70)

    for r in results:
        icon = PASS if r.passed else FAIL
        elapsed = f"({r.elapsed:.1f}s)" if r.elapsed else ""
        print(f"  {icon} {r.name:<45} {elapsed}")
        if not r.passed:
            print(f"       └─ {r.reason}")

    print("=" * 70)
    print(f"  TOTAL: {len(results)}  |  PASSED: {len(passed)}  |  FAILED: {len(failed)}")
    print("=" * 70)

    if failed:
        print("\nFailed tests:")
        for r in failed:
            print(f"  • {r.name}: {r.reason}")
            if r.response:
                err = r.response.get("error", {})
                if err:
                    print(f"    stderr excerpt: {str(err.get('stderr', ''))[:200]}")

    return len(failed)


if __name__ == "__main__":
    print(f"\nmanim-render-service E2E Test Suite")
    print(f"Target: {BASE_URL}")
    print(f"API Key: {'*' * 8}{API_KEY[-4:]}")

    test_infrastructure()
    test_basic_animations()
    test_latex_mathtex()
    test_graphs_plots()
    test_3d_scenes()
    test_output_formats()
    test_quality_levels()
    test_render_options()
    test_audio_muxing()
    test_numpy_scipy_sympy()
    test_advanced_manim()
    test_edge_cases_and_errors()
    test_tracing()
    test_concurrent_requests()

    n_failed = print_results()
    sys.exit(0 if n_failed == 0 else 1)
