#!/usr/bin/env bash
# stop_wsl.sh — Stop the FinAlly Docker container on WSL-Ubuntu
set -euo pipefail

CONTAINER_NAME="finally-app"

if ! command -v docker &>/dev/null; then
  echo "Error: Docker is not installed or not on PATH."
  exit 1
fi

if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Container '$CONTAINER_NAME' is not running."
  exit 0
fi

echo "Stopping FinAlly..."
docker rm -f "$CONTAINER_NAME"
echo "Container stopped. Data volume 'finally-data' is preserved."
