"""Should be killed by RLIMIT_NPROC + --unshare-pid."""
from manim import Scene


class ForkBomb(Scene):
    def construct(self):
        import os
        while True:
            try:
                os.fork()
            except OSError:
                pass
