#!/usr/bin/env bash
# Pulls the latest tinybeans-archive code from GitHub and rebuilds the docker
# image. Safe to call from cron before running the archiver.
#
# Put this script OUTSIDE the code dir, e.g.
#   /volume2/Fast and Volatile/tinybeans-archive/update-and-build.sh
# The code is unpacked to ./tinybeans-archive-master next to it, and that
# directory is wiped and replaced on every run, so keep nothing in it that you
# want to keep (your archive output and .env belong alongside it, not inside).

set -euo pipefail

ZIP_URL="https://github.com/oliyh/tinybeans-archive/archive/refs/heads/master.zip"
IMAGE="tinybeans-archive"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE_DIR="$DIR/tinybeans-archive-master"

# Work next to the destination so the final mv is a cheap same-filesystem rename.
tmp="$(mktemp -d "$DIR/.update.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $ZIP_URL"
curl -fsSL -o "$tmp/master.zip" "$ZIP_URL"

echo "Extracting"
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$tmp/master.zip" -d "$tmp/extracted"
elif command -v 7z >/dev/null 2>&1; then
  7z x -bd -y -o"$tmp/extracted" "$tmp/master.zip" >/dev/null
else
  python3 -m zipfile -e "$tmp/master.zip" "$tmp/extracted"
fi

# Only swap the code in once the download and extraction have succeeded.
rm -rf "$CODE_DIR"
mv "$tmp/extracted/tinybeans-archive-master" "$CODE_DIR"

echo "Building docker image $IMAGE"
docker build -t "$IMAGE" "$CODE_DIR"
