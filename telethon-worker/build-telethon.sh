#!/bin/bash
set -e

OUTPUT_DIR=""
CLEAN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --clean)
      CLEAN=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_SCRIPT="$SCRIPT_DIR/telethon_worker.py"

if ! command -v python3 &> /dev/null; then
  echo "python3 is not installed or not in PATH"
  exit 1
fi

if [ ! -f "$WORKER_SCRIPT" ]; then
  echo "telethon_worker.py not found at $WORKER_SCRIPT"
  exit 1
fi

if [ "$CLEAN" = true ]; then
  rm -rf "$SCRIPT_DIR/build" "$SCRIPT_DIR/dist"
fi

python3 -m pip install --upgrade pip --break-system-packages >/dev/null 2>&1 || true
# python-socks is required for SOCKS5/SOCKS4/HTTP proxy support.
python3 -m pip install telethon pyinstaller cryptg python-socks --break-system-packages >/dev/null 2>&1 || python3 -m pip install --user telethon pyinstaller cryptg python-socks >/dev/null

DIST_DIR="$OUTPUT_DIR"
if [ -z "$DIST_DIR" ]; then
  DIST_DIR="$SCRIPT_DIR/dist"
fi

python3 -m PyInstaller --clean --noconfirm --onefile \
  --name telethon-worker \
  --hidden-import python_socks \
  --hidden-import python_socks.async_.asyncio \
  --distpath "$DIST_DIR" \
  "$WORKER_SCRIPT"

if [ ! -f "$DIST_DIR/telethon-worker" ]; then
  echo "Failed to build telethon-worker"
  exit 1
fi

echo "Telethon worker built at: $DIST_DIR/telethon-worker"
