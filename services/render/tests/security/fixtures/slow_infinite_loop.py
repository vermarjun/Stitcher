"""Should be killed by wall-clock timeout. CPU busy-wait, no syscalls to trip rlimits fast."""
x = 0
while True:
    x += 1
