"""Should be OOM-killed by RLIMIT_AS (or fail allocation) before eating the host."""
from manim import Scene


class MemBomb(Scene):
    def construct(self):
        buf = bytearray()
        chunk = b"A" * (16 * 1024 * 1024)
        while True:
            buf += chunk
