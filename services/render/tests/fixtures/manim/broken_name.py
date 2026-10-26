from manim import *


class BadName(Scene):
    def construct(self):
        self.play(Writ(Text("hi")))  # Writ instead of Write
