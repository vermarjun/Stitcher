import os  # rejected by AST pre-guard
from manim import *

class Hello(Scene):
    def construct(self):
        os.system("echo pwn")
        self.play(Write(Text("hi")))
