"""Should be OOM-killed by RLIMIT_AS before eating the host."""
buf = bytearray()
chunk = b"A" * (16 * 1024 * 1024)  # 16 MB per iteration
while True:
    buf += chunk
