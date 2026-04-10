#!/bin/bash
set -e

if docker rm -f finally-app >/dev/null 2>&1; then
  echo "FinAlly stopped."
else
  echo "FinAlly was not running."
fi
