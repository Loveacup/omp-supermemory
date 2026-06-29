#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "  omp-supermemory v2.0.0 — Install"
echo "========================================"
echo ""

# Detect platform
case "$(uname -s)" in
  Darwin)   OS="macOS" ;;
  Linux)    OS="Linux" ;;
  MINGW*|MSYS*|CYGWIN*) OS="Windows (Git Bash)" ;;
  *)        OS="Unknown" ;;
esac
echo "Platform: $OS"

# [1/2] Install dependencies
echo "[1/2] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
  echo "ERROR: npm install failed"
  exit 1
fi

# [2/2] Link plugin
echo "[2/2] Linking OMP plugin..."
omp plugin link "$(dirname "$0")"
if [ $? -ne 0 ]; then
  echo "WARNING: omp plugin link returned non-zero"
  echo "You may need to run this from an OMP-enabled terminal."
fi

echo ""
echo "Done! Run 'omp plugin list' to verify."
echo ""
echo "Next: run the config wizard to set up your memory pools:"
echo "  node $(dirname "$0")/src/wizard.js"
echo ""
echo "Or authenticate first:"
echo "  node $(dirname "$0")/src/login.js"
