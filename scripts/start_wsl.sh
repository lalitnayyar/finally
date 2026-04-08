#!/usr/bin/env bash
# start_wsl.sh — Launch FinAlly in WSL-Ubuntu (WSL2 + Docker)
set -euo pipefail

IMAGE_NAME="finally"
CONTAINER_NAME="finally-app"
PORT=8000
DB_VOLUME="finally-data"
ENV_FILE="$(dirname "$(realpath "$0")")/../.env"

# ── Docker availability check ────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "ERROR: 'docker' not found."
  echo "  Option A (recommended): Install Docker Desktop for Windows and enable the WSL2 backend."
  echo "  Option B: Install Docker Engine directly inside WSL2:"
  echo "    https://docs.docker.com/engine/install/ubuntu/"
  exit 1
fi

if ! docker info &>/dev/null; then
  echo "ERROR: Docker daemon is not reachable."
  echo "  If you are using Docker Desktop, make sure it is running and WSL integration is enabled."
  echo "  If you installed Docker Engine inside WSL2, start it with: sudo service docker start"
  exit 1
fi

# ── .env check ───────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env file not found at $ENV_FILE"
  echo "  Copy .env.example to .env and add your OPENROUTER_API_KEY."
  exit 1
fi

# ── Build image if needed ────────────────────────────────────────────────────
BUILD=false
if [ "${1:-}" = "--build" ]; then
  BUILD=true
fi

if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Image '$IMAGE_NAME' not found — building..."
  BUILD=true
fi

if [ "$BUILD" = true ]; then
  REPO_ROOT="$(dirname "$(realpath "$0")")/.."
  echo "Building Docker image '$IMAGE_NAME'..."
  docker build -t "$IMAGE_NAME" "$REPO_ROOT"
fi

# ── Stop any existing container ───────────────────────────────────────────────
if docker ps -q --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Stopping existing container '$CONTAINER_NAME'..."
  docker stop "$CONTAINER_NAME" >/dev/null
  docker rm "$CONTAINER_NAME" >/dev/null
elif docker ps -aq --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Removing stopped container '$CONTAINER_NAME'..."
  docker rm "$CONTAINER_NAME" >/dev/null
fi

# ── Start container ───────────────────────────────────────────────────────────
echo "Starting FinAlly on http://localhost:${PORT} ..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${PORT}:${PORT}" \
  -v "${DB_VOLUME}:/app/db" \
  --env-file "$ENV_FILE" \
  "$IMAGE_NAME"

echo ""
echo "FinAlly is running at http://localhost:${PORT}"
echo "To stop: ./scripts/stop_wsl.sh"
echo ""

# ── Open browser ──────────────────────────────────────────────────────────────
URL="http://localhost:${PORT}"

if command -v wslview &>/dev/null; then
  wslview "$URL"
elif command -v explorer.exe &>/dev/null; then
  explorer.exe "$URL"
elif command -v cmd.exe &>/dev/null; then
  cmd.exe /c start "$URL"
else
  echo "Could not auto-open browser."
  echo "Open manually: $URL"
fi
