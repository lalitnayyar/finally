#!/usr/bin/env python3
"""Validate startup script preflight behavior for student launch scripts."""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAC_SCRIPT = ROOT / "scripts" / "start_mac.sh"
WINDOWS_SCRIPT = ROOT / "scripts" / "start_windows.ps1"
EXPECTED_MESSAGE = (
    "Startup blocked: create .env from .env.example and set OPENROUTER_API_KEY before "
    "starting FinAlly."
)


def _make_stub_docker(bin_dir: Path) -> None:
    docker_path = bin_dir / "docker"
    docker_path.write_text("#!/bin/sh\necho docker-called >&2\nexit 99\n", encoding="utf-8")
    docker_path.chmod(docker_path.stat().st_mode | stat.S_IEXEC)


def _run_start_mac(project_dir: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PATH"] = f"{project_dir / 'bin'}:{env['PATH']}"
    return subprocess.run(
        ["bash", str(project_dir / "scripts" / "start_mac.sh")],
        cwd=project_dir,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _build_temp_project() -> Path:
    temp_dir = Path(tempfile.mkdtemp(prefix="finally-startup-"))
    (temp_dir / "scripts").mkdir()
    (temp_dir / "bin").mkdir()
    shutil.copy2(MAC_SCRIPT, temp_dir / "scripts" / "start_mac.sh")
    _make_stub_docker(temp_dir / "bin")
    return temp_dir


def test_missing_env_file_fails_before_docker() -> None:
    project_dir = _build_temp_project()
    try:
        result = _run_start_mac(project_dir)
        combined_output = f"{result.stdout}{result.stderr}"

        assert result.returncode == 1, combined_output
        assert EXPECTED_MESSAGE in combined_output
        assert "docker-called" not in combined_output
    finally:
        shutil.rmtree(project_dir)


def test_missing_openrouter_key_fails_before_docker() -> None:
    project_dir = _build_temp_project()
    try:
        (project_dir / ".env").write_text("MASSIVE_API_KEY=\n", encoding="utf-8")
        result = _run_start_mac(project_dir)
        combined_output = f"{result.stdout}{result.stderr}"

        assert result.returncode == 1, combined_output
        assert EXPECTED_MESSAGE in combined_output
        assert "docker-called" not in combined_output
    finally:
        shutil.rmtree(project_dir)


def test_windows_script_contains_matching_preflight_guard() -> None:
    content = WINDOWS_SCRIPT.read_text(encoding="utf-8")

    assert ".env.example" in content
    assert "OPENROUTER_API_KEY" in content
    assert EXPECTED_MESSAGE in content


def main() -> int:
    tests = [
        test_missing_env_file_fails_before_docker,
        test_missing_openrouter_key_fails_before_docker,
        test_windows_script_contains_matching_preflight_guard,
    ]
    failures = 0

    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL {test.__name__}: {exc}", file=sys.stderr)

    return failures


if __name__ == "__main__":
    raise SystemExit(main())
