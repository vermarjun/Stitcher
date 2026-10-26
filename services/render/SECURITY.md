# Security policy

## Threat model

This service executes **untrusted Python code submitted over HTTP**. The design assumes:

- Callers may be malicious. Code submitted may attempt to escape the sandbox, exfiltrate data, exhaust resources, or establish persistence.
- The API key protects against unauthorized *use*, not against abuse by authorized callers.
- The kernel is not part of the threat model — a privileged local kernel bug defeats any userspace sandbox. Run recent kernels and patch them.

**In scope:**
- Network isolation of the render process.
- Filesystem isolation of the render process.
- CPU, RAM, FD, and process-count caps.
- Wall-clock timeouts.
- Rejection of clearly-malicious code before it even reaches the sandbox (`app/core/validate.py`).
- Seccomp-BPF syscall allowlist.

**Out of scope:**
- Protection against a privileged container escape (run without `--privileged`, use least-caps).
- Protection against DoS at the HTTP layer (put a reverse proxy / rate limiter in front).
- Protection against downstream storage misconfiguration (your Cloudinary account is your problem).

## Defence layers

1. **AST pre-guard** — cheap rejection of code that tries `import os`, calls `eval`, or accesses dunder attributes. Not security; it's a filter to avoid paying for a sandbox on obvious junk.
2. **Bubblewrap namespaces** — `--unshare-all` drops network, PID, UTS, IPC, user, cgroup, and mount namespaces.
3. **Bind-mounted filesystem** — only `/usr`, `/etc`, `/opt/venv`, `/lib` are mounted read-only; a tmpfs `/work` is the only writable location.
4. **rlimits** — `RLIMIT_AS`, `RLIMIT_CPU`, `RLIMIT_FSIZE`, `RLIMIT_NOFILE`, `RLIMIT_NPROC`, `RLIMIT_CORE=0`.
5. **Wall-clock timeout** — `asyncio.wait_for` + process-group kill.
6. **Seccomp-BPF allowlist** — optional, policy at `app/assets/seccomp_manim.yaml`, compiled to BPF at image build time.

Each layer is independently verified by the test battery at `tests/security/test_sandbox_escape.py`.

## Reporting a vulnerability

Email: **vermarjun@gmail.com**. Subject line: `manim-render-service: security`.

Do NOT open a public GitHub issue for security reports. Expect an acknowledgement within 72 hours and a fix or mitigation plan within 14 days for reasonable vulnerabilities. Co-ordinated disclosure is appreciated — I'll credit researchers who request it.

## Hardening checklist for operators

- [ ] `SANDBOX_ENABLED=true` (service refuses to start otherwise in production).
- [ ] `RENDER_API_KEY` is a long, unguessable random string; rotate on a schedule.
- [ ] Container runs without `--privileged`; use `cap_add: [SYS_ADMIN]` only.
- [ ] Put a rate limiter in front of `/render` (nginx, envoy, cloud WAF) — the service itself doesn't rate-limit.
- [ ] Disable `/metrics` exposure to the public internet; expose it only to your Prometheus scraper's network.
- [ ] Monitor `mrs_saturated_rejections_total` — spikes mean your concurrency cap is too low or your caller is flooding.
- [ ] If using `storage_backend=local`, serve the storage directory through a separate reverse proxy with its own access controls — the render service does NOT serve files.
