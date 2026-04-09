#!/bin/bash
set -e

IMAGE_NAME="finally"
CONTAINER_NAME="finally-app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Build if needed or --build flag passed
if [[ "$1" == "--build" ]] || ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Building Docker image..."
  # Classic builder: avoids "buildx missing" when BuildKit is on but buildx isn't installed
  DOCKER_BUILDKIT=0 docker build -t "$IMAGE_NAME" "$PROJECT_DIR"
fi

# Stop existing container if running
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo "Starting FinAlly..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -v finally-data:/app/db \
  -p 8000:8000 \
  --env-file "$PROJECT_DIR/.env" \
  "$IMAGE_NAME"

echo "FinAlly is running at http://localhost:8000"

# Open browser (optional, macOS)
if command -v open &>/dev/null; then
  sleep 2 && open http://localhost:8000 &
fi
