# Sandbox internals

## Why bubblewrap (and not alternatives)

We considered and rejected:

| Option            | Why not |
| ----------------- | ------- |
| `firejail`        | Depends on setuid binary; harder to ship inside a container. |
| `nsjail`          | Fine, but a full Google-internal-style dependency for marginal gain over bwrap. |
| gVisor / runsc    | Adds a second container runtime; resource overhead per render is real. |
| Full VM per job   | 1–2s cold-start per render; prohibitive for interactive use. |
| Docker-in-Docker  | Doubles the attack surface; DinD is widely documented as a bad isolation primitive. |
| Cloud functions   | Vendor lock-in; cold starts; 10+ minute caps don't match worst-case manim jobs. |

Bubblewrap is the minimum viable tool: unprivileged, no setuid, uses kernel namespaces directly, maintained by the Flatpak project.

## What bwrap is invoked with

See `app/core/sandbox.py` for the authoritative version. The important flags:

```
bwrap
  --unshare-all              # drop every namespace we don't explicitly keep
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
  --bind   <host_workdir> /work
  --chdir  /work
  --cap-drop ALL
  --new-session
  [--seccomp 10]             # when a compiled policy is available
  -- manim [args...] /work/animation.py SceneClass
```

## rlimits

Applied via the child's `preexec_fn` in the no-sandbox fallback; inherited by bwrap in the sandboxed path.

| Limit           | Value (default)        | Why                                               |
| --------------- | ---------------------- | ------------------------------------------------- |
| `RLIMIT_AS`     | `memory_mb * 1MB`      | Kills the process on allocation past the cap.     |
| `RLIMIT_CPU`    | `timeout_sec * cpus + 5` | Backstop for the asyncio wall clock.            |
| `RLIMIT_FSIZE`  | 512 MB                 | No render needs a >512 MB output file.            |
| `RLIMIT_NOFILE` | 256                    | Plenty for manim; blocks fd-leaking attacks.      |
| `RLIMIT_NPROC`  | 64                     | Caps fork bombs; manim itself uses <10.           |
| `RLIMIT_CORE`   | 0                      | No core dumps — they'd leak memory to disk.       |

## Seccomp policy

Default: **deny everything**; allow a curated list of ~100 syscalls that strace shows manim actually uses. Kill on a small set of known-dangerous syscalls (`ptrace`, `bpf`, `unshare`, `mount`, `init_module`, `kexec_*`).

Policy source: `app/assets/seccomp_manim.yaml`.
Compiler: `scripts/build_seccomp.py` (run at Docker build time; requires `libseccomp`).
Output: `/etc/manim-render-service/seccomp_manim.bpf` in the runtime image.

If the compiled blob is missing, the sandbox still runs — just without the seccomp layer. The namespaces + rlimits are sufficient for most threats; seccomp is belt-and-braces.

### Updating the policy

If a Manim upgrade starts returning `EPERM` from a legitimate syscall:

1. Run the failing render with `strace -f -o trace.log manim ...` inside the container.
2. Diff against the previous trace to identify new syscalls.
3. Add them to `allow_syscalls:` in the YAML.
4. Rebuild the image.

Never disable the filter to "unblock" a Manim upgrade — that's how filters die.

## Escape tests

`tests/security/test_sandbox_escape.py`. Each fixture is designed to prove a specific defence holds:

| Fixture                | Defence under test                           |
| ---------------------- | -------------------------------------------- |
| `net_exfil.py`         | `--unshare-net` blocks all socket traffic    |
| `fs_escape.py`         | bind-mount layout denies `/etc/shadow`, `/home` |
| `fork_bomb.py`         | `RLIMIT_NPROC` + PID namespace caps children  |
| `memory_bomb.py`       | `RLIMIT_AS` triggers OOM kill                |
| `slow_infinite_loop.py`| `asyncio.wait_for` wall-clock cancels bwrap   |

CI runs this battery on every PR. A PR that makes a security test fail is blocked from merge.
