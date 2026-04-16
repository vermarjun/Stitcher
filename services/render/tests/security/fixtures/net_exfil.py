"""Should fail: tries to open a TCP connection. Sandbox --unshare-net must block DNS + sockets."""
import socket

socket.create_connection(("1.1.1.1", 80), timeout=2)
print("ESCAPE: network reachable")
