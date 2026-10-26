from manim import *
from manim_Astronomy.stellar_objects import JamesWebbSpaceTelescope

class Space(ThreeDScene):
    def construct(self):
        model = JamesWebbSpaceTelescope()
        self.add(model)
        self.play(Rotate(model,90*DEGREES,UP))
        self.wait(3)