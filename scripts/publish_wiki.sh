#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-CatnipLabs/Box}"
SOURCE_DIR="${SOURCE_DIR:-docs/wiki}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Wiki source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

WIKI_URL="https://github.com/${REPO}.wiki.git"

echo "Cloning wiki repository: $WIKI_URL"
if ! GIT_TERMINAL_PROMPT=0 git clone "$WIKI_URL" "$WORKDIR/wiki"; then
  cat >&2 <<MSG

Could not clone the GitHub Wiki repository.

GitHub only exposes <repo>.wiki.git after the first wiki page has been created
through the GitHub web UI. Create the first page at:

  https://github.com/${REPO}/wiki

After that, run this script again.
MSG
  exit 1
fi

find "$WORKDIR/wiki" -maxdepth 1 -type f -name '*.md' -delete
cp "$SOURCE_DIR"/*.md "$WORKDIR/wiki"/

git -C "$WORKDIR/wiki" add .
if git -C "$WORKDIR/wiki" diff --cached --quiet; then
  echo "Wiki is already up to date."
  exit 0
fi

git -C "$WORKDIR/wiki" commit -m "docs: sync BOX framework wiki"
git -C "$WORKDIR/wiki" push

echo "Wiki published: https://github.com/${REPO}/wiki"
