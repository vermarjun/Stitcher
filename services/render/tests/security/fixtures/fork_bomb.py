"""Should be killed by RLIMIT_NPROC + --unshare-pid."""
import os
while True:
    try:
        os.fork()
    except OSError:
        pass
