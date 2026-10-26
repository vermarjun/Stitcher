#!/usr/bin/env python3
"""Compile app/assets/seccomp_manim.yaml into a .bpf blob for bwrap --seccomp.

Called from the Dockerfile build stage — we ship the compiled filter inside the image
rather than compiling at container start, so a malformed policy breaks the build not the
first render.

Uses libseccomp's Python bindings (`python3-seccomp` apt package). If the module is
missing, we emit a clear error and exit 1 — callers should either install it or skip
seccomp by leaving SANDBOX_SECCOMP_POLICY_PATH unset.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml  # PyYAML — ubiquitous, already a transitive dep of many tools


def _load_libseccomp():
    try:
        import seccomp  # type: ignore[import-not-found]
    except ImportError:
        print(
            "ERROR: `seccomp` Python bindings not installed.\n"
            "  apt-get install -y python3-seccomp   (Debian bookworm)\n"
            "  dnf install -y libseccomp-python     (Fedora/RHEL)\n"
            "Or skip seccomp by not setting SANDBOX_SECCOMP_POLICY_PATH.",
            file=sys.stderr,
        )
        sys.exit(1)
    return seccomp


def _action(seccomp_mod, name: str, errno_name: str = "EPERM"):
    if name == "SCMP_ACT_ERRNO":
        import errno
        return seccomp_mod.ERRNO(getattr(errno, errno_name))
    if name == "SCMP_ACT_KILL":
        return seccomp_mod.KILL
    if name == "SCMP_ACT_ALLOW":
        return seccomp_mod.ALLOW
    raise ValueError(f"unknown action: {name}")


def build(policy_path: Path, out_path: Path) -> None:
    seccomp_mod = _load_libseccomp()
    policy = yaml.safe_load(policy_path.read_text())

    default = _action(seccomp_mod, policy.get("default_action", "SCMP_ACT_ERRNO"),
                      policy.get("default_errno", "EPERM"))
    f = seccomp_mod.SyscallFilter(defaction=default)

    for name in policy.get("kill_syscalls", []):
        try:
            f.add_rule(seccomp_mod.KILL, name)
        except (ValueError, RuntimeError) as e:
            print(f"warn: kill rule for {name} skipped ({e})", file=sys.stderr)

    for name in policy.get("allow_syscalls", []):
        try:
            f.add_rule(seccomp_mod.ALLOW, name)
        except (ValueError, RuntimeError) as e:
            # Syscall may not exist on this arch — that's fine, skip it rather than fail.
            print(f"warn: allow rule for {name} skipped ({e})", file=sys.stderr)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("wb") as fh:
        f.export_bpf(fh.fileno())
    print(f"wrote {out_path} ({out_path.stat().st_size} bytes)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--policy", type=Path, default=Path("app/assets/seccomp_manim.yaml"))
    ap.add_argument("--out", type=Path, default=Path("app/assets/seccomp_manim.bpf"))
    args = ap.parse_args()
    build(args.policy, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
