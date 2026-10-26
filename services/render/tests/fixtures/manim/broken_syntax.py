from manim import *

class Broken(Scene):
    def construct(self)   # missing colon
        self.play(Write(Text("hi")))
