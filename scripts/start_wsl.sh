#!/usr/bin/env bash
# start_wsl.sh — Launch FinAlly in Docker on WSL-Ubuntu
set -euo pipefail

IMAGE_NAME="finally"
CONTAINER_NAME="finally-app"
PORT=8000
ENV_FILE="$(dirname "$(realpath "$0")")/../.env"

# Check Docker is available
if ! command -v docker &>/dev/null; then
  echo "Error: Docker is not installed or not on PATH."
  echo "Install Docker Desktop for Windows with the WSL2 backend enabled,"
  echo "or install Docker Engine directly in WSL2 via:"
  echo "  https://docs.docker.com/engine/install/ubuntu/"
  exit 1
fi

# Check Docker daemon is running
if ! docker info &>/dev/null 2>&1; then
  echo "Error: Docker daemon is not running."
  echo "If you use Docker Desktop, make sure it is started on Windows and"
  echo "WSL integration is enabled for your Ubuntu distribution."
  echo "If you installed Docker Engine inside WSL2, start the daemon with:"
  echo "  sudo service docker start"
  exit 1
fi

# Check .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  echo "Copy .env.example to .env and fill in your API key:"
  echo "  cp .env.example .env"
  exit 1
fi

BUILD=false
if [ "${1:-}" = "--build" ]; then
  BUILD=true
fi

# Build image if it doesn't exist or --build flag passed
if $BUILD || ! docker image inspect "$IMAGE_NAME" &>/dev/null 2>&1; then
  echo "Building Docker image '$IMAGE_NAME'..."
  REPO_ROOT="$(dirname "$(realpath "$0")")/.."
  docker build -t "$IMAGE_NAME" "$REPO_ROOT"
fi

# Stop and remove any existing container with the same name
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Stopping existing container '$CONTAINER_NAME'..."
  docker rm -f "$CONTAINER_NAME" &>/dev/null
fi

echo "Starting FinAlly..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${PORT}:${PORT}" \
  -v finally-data:/app/db \
  --env-file "$ENV_FILE" \
  "$IMAGE_NAME"

echo ""
echo "FinAlly is running at: http://localhost:${PORT}"
echo ""

# Try to open browser from WSL
URL="http://localhost:${PORT}"

if command -v wslview &>/dev/null; then
  # wslu package provides wslview — preferred method
  wslview "$URL" 2>/dev/null || true
elif command -v explorer.exe &>/dev/null; then
  # Fallback: use Windows Explorer to open URL
  explorer.exe "$URL" 2>/dev/null || true
elif [ -x "/mnt/c/Windows/System32/cmd.exe" ]; then
  /mnt/c/Windows/System32/cmd.exe /c start "$URL" 2>/dev/null || true
else
  echo "Could not auto-open browser."
  echo "Install the 'wslu' package for automatic browser launch:"
  echo "  sudo apt install wslu"
fi

echo "Run './scripts/stop_wsl.sh' to stop the container."
