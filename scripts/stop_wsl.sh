#!/usr/bin/env bash
# stop_wsl.sh — Stop the FinAlly container in WSL-Ubuntu
set -euo pipefail

CONTAINER_NAME="finally-app"

if ! command -v docker &>/dev/null; then
  echo "ERROR: 'docker' not found."
  exit 1
fi

if docker ps -q --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Stopping container '$CONTAINER_NAME'..."
  docker stop "$CONTAINER_NAME" >/dev/null
  docker rm "$CONTAINER_NAME" >/dev/null
  echo "Container stopped. Data volume preserved."
elif docker ps -aq --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Container '$CONTAINER_NAME' already stopped — removing..."
  docker rm "$CONTAINER_NAME" >/dev/null
  echo "Done."
else
  echo "Container '$CONTAINER_NAME' is not running."
fi
