"""Tiny Manim scene used by contract tests — no MathTex so LaTeX isn't required."""
from manim import *  # noqa: F403


class Hello(Scene):
    def construct(self):
        title = Text("hello", font_size=48)
        self.play(Write(title))
        self.wait(0.5)
