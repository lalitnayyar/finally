#!/usr/bin/env python3
"""Reset portfolio DB: delegates to backend/scripts/reset_portfolio.py.

From repo root:
    uv run --directory backend python scripts/reset_portfolio.py

Or (this wrapper):
    python3 scripts/reset_portfolio.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
TARGET = BACKEND / "scripts" / "reset_portfolio.py"


def main() -> None:
    if not TARGET.is_file():
        print(f"Missing {TARGET}", file=sys.stderr)
        raise SystemExit(1)
    r = subprocess.run(
        [sys.executable, str(TARGET)],
        cwd=str(BACKEND),
    )
    raise SystemExit(r.returncode)


if __name__ == "__main__":
    main()
