# Security policy

## Threat model

This service executes **untrusted Python code submitted over HTTP**. The design assumes:

- Callers may be malicious. Code submitted may attempt to escape the sandbox, exfiltrate data, exhaust resources, or establish persistence.
- The API key protects against unauthorized *use*, not against abuse by authorized callers.
- The kernel is not part of the threat model - a privileged local kernel bug defeats any userspace sandbox. Run recent kernels and patch them.

**In scope:**
- Network isolation of the render process.
- Filesystem isolation of the render process.
- Per-process CPU-time, memory (data segment), file-size and open-file caps.
- Wall-clock timeouts.
- Rejection of clearly-malicious code before it even reaches the sandbox (`app/core/validate.py`).

**Out of scope:**
- Protection against a container escape. The recommended container has `CAP_SYS_ADMIN`, no AppArmor or default seccomp profile, and unmasked `/proc` paths, which is a weaker container boundary than the Docker default. Do not run other workloads in it.
- Syscall filtering. There is no seccomp filter (see below).
- A cap on the number of processes or total memory of one render. See "Known gaps".
- Protection against DoS at the HTTP layer (put a reverse proxy / rate limiter in front).
- Protection against downstream storage misconfiguration (your Cloudinary account is your problem).

## Defence layers

1. **AST pre-guard**: cheap rejection of code that tries `import os`, calls `eval`, or accesses dunder attributes. Not security; it's a filter to avoid paying for a sandbox on obvious junk.
2. **Bubblewrap namespaces**: `--unshare-all` gives the render new network (empty), PID, UTS, IPC, user, cgroup and mount namespaces.
3. **Filesystem layout**: `/usr`, `/etc`, `/lib`, `/opt` and `/var/lib/texmf` are mounted read-only; `/tmp` is a fresh tmpfs; `/work` is a bind mount of a per-job host directory and is the only writable path that outlives the process. No `/home` or `/root`.
4. **Identity**: uid and gid 99999, all capabilities dropped (`--cap-drop ALL`).
5. **rlimits**, set before `bwrap` starts so every process inside inherits them: `RLIMIT_CPU`, `RLIMIT_FSIZE` (512 MB), `RLIMIT_NOFILE` (1024), `RLIMIT_NPROC` (256), `RLIMIT_CORE=0`, and `RLIMIT_DATA` set to the request's memory limit.
6. **Wall-clock timeout**: `asyncio.wait_for` plus process-group kill.

The test battery at `tests/security/test_sandbox_escape.py` checks network isolation, filesystem confinement, the fork bomb, the memory bomb and the wall-clock timeout.

## Known gaps

- **No seccomp.** `app/assets/seccomp_manim.yaml` and `scripts/build_seccomp.py` exist but are not built into the image or passed to `bwrap`.
- **No aggregate memory cap, and a soft process cap.** rlimits apply per process, so a render can use `memory_mb` in each of several processes. `RLIMIT_NPROC` (256) bounds a fork bomb per sandbox on Linux 5.14 or newer, but killing it can still take tens of seconds. Set container-level limits (`--pids-limit`, `--memory`) in your orchestrator.
- **`/work` is not a tmpfs.** It is a host directory under the container's `/tmp`. The compose file mounts `/tmp` as a 2 GB tmpfs, which bounds its size; outside compose, bound it yourself.
- **Local storage is public by URL.** See the checklist below.

## Reporting a vulnerability

Use the repository's private vulnerability reporting (GitHub: Security tab, "Report a vulnerability"). Put `render service` in the title.

Do NOT open a public issue for security reports. Co-ordinated disclosure is appreciated, and we will credit researchers who ask.

## Hardening checklist for operators

- [ ] `SANDBOX_ENABLED=true` (service refuses to start otherwise in production).
- [ ] `RENDER_API_KEY` is a long, unguessable random string; rotate on a schedule.
- [ ] Container runs without `--privileged`. Use `cap_add: [SYS_ADMIN]` plus `apparmor=unconfined`, `seccomp=unconfined` and `systempaths=unconfined`, as `docker-compose.yml` does.
- [ ] Set `--pids-limit` and a memory limit on the container (see Known gaps).
- [ ] Put a rate limiter in front of `/render` (nginx, envoy, cloud WAF) - the service itself doesn't rate-limit.
- [ ] Disable `/metrics` exposure to the public internet; expose it only to your Prometheus scraper's network.
- [ ] Monitor `mrs_saturated_rejections_total` - spikes mean your concurrency cap is too low or your caller is flooding.
- [ ] With `STORAGE_BACKEND=local` the service serves the storage directory at `/files/` with no API key. Names are random UUIDs, but anyone with a URL can fetch the file. Put a proxy with access control in front of `/files/` if the videos are private, or use `cloudinary`.
