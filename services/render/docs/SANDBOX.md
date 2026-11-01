# Sandbox internals

## Why bubblewrap (and not alternatives)

We considered and rejected:

| Option            | Why not |
| ----------------- | ------- |
| `firejail`        | Depends on setuid binary; harder to ship inside a container. |
| `nsjail`          | Fine, but a full Google-internal-style dependency for marginal gain over bwrap. |
| gVisor / runsc    | Adds a second container runtime; resource overhead per render is real. |
| Full VM per job   | 1-2s cold-start per render; prohibitive for interactive use. |
| Docker-in-Docker  | Doubles the attack surface; DinD is widely documented as a bad isolation primitive. |
| Cloud functions   | Vendor lock-in; cold starts; 10+ minute caps don't match worst-case manim jobs. |

Bubblewrap is the minimum viable tool: unprivileged, no setuid, uses kernel namespaces directly, maintained by the Flatpak project.

## What bwrap is invoked with

See `app/core/sandbox.py` for the authoritative version. The flags:

```
bwrap
  --unshare-all              # new user, mount, PID, UTS, IPC, cgroup and (empty) network namespaces
  --die-with-parent          # kill the sandbox if the API process dies
  --uid 99999 --gid 99999    # nonexistent user
  --hostname sandbox
  --proc /proc
  --dev  /dev
  --tmpfs /tmp
  --ro-bind /usr /usr
  --ro-bind /etc /etc
  --ro-bind /lib /lib
  --ro-bind /opt /opt        # includes /opt/venv with the render deps
  --ro-bind /var/lib/texmf /var/lib/texmf
  --bind   <host_workdir> /work   # per-job host directory, read-write
  --chdir  /work
  --cap-drop ALL
  --new-session
  -- manim [args...] /work/animation.py SceneClass
```

`/work` is a bind mount of a directory the service creates under its own `/tmp` for each job. It is not a tmpfs of its own. The service reads the rendered files out of it and then deletes it. In `docker-compose.yml` the container's `/tmp` is a 2 GB tmpfs.

## Container requirements

`bwrap` needs to create namespaces inside the container. `docker-compose.yml` therefore sets `cap_add: [SYS_ADMIN]`, `apparmor=unconfined`, `seccomp=unconfined` and `systempaths=unconfined`. The last one unmasks the `/proc` paths Docker hides by default; without it `bwrap --proc /proc` fails with "Can't mount proc ... Operation not permitted". The container is not `privileged`. This weakens the container boundary compared with the Docker default, so run the service in a container that holds nothing else.

## rlimits

Applied in the child process before it execs `bwrap` (`preexec_fn` in `app/core/sandbox.py`), in both sandboxed and unsandboxed mode. rlimits survive `exec`, so every process inside the sandbox inherits them. Each process gets its own copy; none of them is an aggregate over the sandbox.

| Limit           | Value                  | Why                                               |
| --------------- | ---------------------- | ------------------------------------------------- |
| `RLIMIT_CPU`    | `timeout_sec * max(cpus, host cores) + 5` | Backstop if the wall-clock kill fails. Set high so multi-threaded renders are not cut off. |
| `RLIMIT_FSIZE`  | 512 MB                 | No render needs a >512 MB output file.            |
| `RLIMIT_NOFILE` | 1024                   | Blocks fd-leaking attacks.                        |
| `RLIMIT_CORE`   | 0                      | No core dumps.                                    |
| `RLIMIT_NPROC`  | 256                    | Caps tasks (processes and threads). Counted per user namespace on Linux 5.14 or newer, so it bounds the sandbox, not the API. |
| `RLIMIT_DATA`   | `memory_mb` from the request (default 2048) | The memory cap. Counts heap and private writable mappings, per process. |

Very small `memory_mb` values break Manim itself: it needs several hundred MB to import numpy and scipy, and near 768 MB the import can die with a stray `KeyboardInterrupt` from the BLAS runtime. Use 1024 or more. The sandbox also sets `OPENBLAS_NUM_THREADS=2` and `OMP_NUM_THREADS=2`, because OpenBLAS reserves memory per thread and would otherwise make the needed memory depend on the host core count.

Not set, on purpose:

- `RLIMIT_AS`. Python, ffmpeg and Cairo map several GB of virtual address space at low physical use, so an AS cap kills the ffmpeg step.

On kernels older than 5.14, `RLIMIT_NPROC` is counted per host uid, so the API process and concurrent renders share the 256.

A fork bomb is bounded to 256 tasks and ended by the wall-clock kill, but tearing down that many busy processes can take tens of seconds on a loaded host. There is no cgroup memory or PID limit. Set `--memory` and `--pids-limit` on the container if you need hard aggregate caps.

## Seccomp: not enabled

There is no seccomp filter. An earlier version passed `--seccomp 10` to `bwrap` without ever supplying the file descriptor, so it had no effect, and that code is removed.

`app/assets/seccomp_manim.yaml` (an allowlist of the syscalls Manim uses) and `scripts/build_seccomp.py` (compiles it with the libseccomp Python bindings) are kept as a starting point. They are not built into the image, not tested against real renders, and not referenced by the service. Wiring them in would need: building the `.bpf` in the image, opening it and passing the descriptor to `bwrap --seccomp <fd>` (`pass_fds`), and a pass over real renders to find missing syscalls.

## Escape tests

`tests/security/test_sandbox_escape.py`. Each fixture checks one defence:

| Fixture                | Defence under test                           |
| ---------------------- | -------------------------------------------- |
| `net_exfil.py`         | `--unshare-net` blocks all socket traffic    |
| `fs_escape.py`         | bind-mount layout denies `/etc/shadow`, `/home` |
| `fork_bomb.py`         | `RLIMIT_NPROC` bounds the bomb, wall-clock kill ends it |
| `memory_bomb.py`       | `RLIMIT_DATA` makes the allocation fail      |
| `slow_infinite_loop.py`| `asyncio.wait_for` wall-clock cancels bwrap   |

The battery needs Linux and `bwrap`. The Docker image does not contain `tests/`, so mount the repo; see the Testing section of the README for the exact command.
