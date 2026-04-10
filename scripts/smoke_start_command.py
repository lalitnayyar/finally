#!/usr/bin/env python3
"""Success-path smoke test for the documented Docker start command."""

from __future__ import annotations

import subprocess
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
START_SCRIPT = ROOT / "scripts" / "start_mac.sh"
STOP_SCRIPT = ROOT / "scripts" / "stop_mac.sh"
ENV_FILE = ROOT / ".env"
SMOKE_ENV = (
    "OPENROUTER_API_KEY=smoke-test-key\n"
    "LLM_MOCK=true\n"
    "MASSIVE_API_KEY=\n"
)


def run_checked(command: list[str], *, cwd: Path) -> None:
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"Command failed: {' '.join(command)}\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )


def wait_for_url(url: str, *, contains: str | None = None, timeout: float = 90.0) -> None:
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=5) as response:
                body = response.read().decode("utf-8", errors="ignore")
                if response.status == 200 and (contains is None or contains in body):
                    return
        except (OSError, URLError):
            pass
        time.sleep(2)

    raise TimeoutError(f"Timed out waiting for {url}")


def main() -> int:
    original_env = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else None

    try:
        ENV_FILE.write_text(SMOKE_ENV, encoding="utf-8")
        run_checked(["bash", str(STOP_SCRIPT)], cwd=ROOT)
        run_checked(["bash", str(START_SCRIPT), "--build"], cwd=ROOT)
        wait_for_url("http://localhost:8000/", contains="FinAlly")
        wait_for_url("http://localhost:8000/api/health", contains='"status":"ok"')
        print("Smoke launch passed.")
        return 0
    finally:
        subprocess.run(["bash", str(STOP_SCRIPT)], cwd=ROOT, check=False)
        if original_env is None:
            ENV_FILE.unlink(missing_ok=True)
        else:
            ENV_FILE.write_text(original_env, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
