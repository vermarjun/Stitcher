"""Should be killed by wall-clock timeout. CPU busy-wait, no syscalls to trip rlimits fast."""
from manim import Scene


class SlowLoop(Scene):
    def construct(self):
        x = 0
        while True:
            x += 1
