"""Should fail: tries to open a TCP connection. Sandbox --unshare-net must block DNS + sockets.

Wrapped as a Scene so the sandbox's `manim ... SceneClass` invocation actually runs the
payload (previous version was raw Python; manim exited before construct()).
"""
from manim import Scene


class NetExfil(Scene):
    def construct(self):
        import socket
        try:
            socket.create_connection(("1.1.1.1", 80), timeout=2)
            print("ESCAPE: network reachable")
        except OSError as e:
            raise RuntimeError(f"net-blocked: {e!r}") from e
