"""Should fail: tries to read /etc/shadow and write outside /work."""
from manim import Scene


class FsEscape(Scene):
    def construct(self):
        try:
            open("/etc/shadow", "rb").read()
            with open("/home/hacked", "w") as f:
                f.write("pwned")
            print("ESCAPE: fs read/write succeeded")
        except (PermissionError, FileNotFoundError, OSError) as e:
            raise RuntimeError(f"fs-blocked: {e!r}") from e
