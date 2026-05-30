#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-CatnipLabs/Box}"
SOURCE_DIR="${SOURCE_DIR:-docs/wiki}"
DRY_RUN="${DRY_RUN:-0}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Wiki source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if ! compgen -G "$SOURCE_DIR/*.md" >/dev/null; then
  echo "Wiki source directory has no markdown files: $SOURCE_DIR" >&2
  exit 1
fi

WIKI_URL="https://github.com/${REPO}.wiki.git"
WIKI_WEB_URL="https://github.com/${REPO}/wiki"

cat <<MSG
Publishing BOX wiki
  repository: ${REPO}
  source:     ${SOURCE_DIR}
  wiki git:   ${WIKI_URL}
MSG

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN=1 enabled; validating source files only."
  find "$SOURCE_DIR" -maxdepth 1 -type f -name '*.md' -print | sort
  exit 0
fi

echo "Cloning wiki repository: $WIKI_URL"
if ! GIT_TERMINAL_PROMPT=0 git clone "$WIKI_URL" "$WORKDIR/wiki"; then
  cat >&2 <<MSG

Could not clone the GitHub Wiki repository.

GitHub only exposes <repo>.wiki.git after the first wiki page has been created
through the GitHub web UI. Bootstrap once with these steps:

  1. Open: ${WIKI_WEB_URL}
  2. Create any first page, for example Home.
  3. Run this script again:

       scripts/publish_wiki.sh ${REPO}

For CI/source validation without publishing, run:

       DRY_RUN=1 scripts/publish_wiki.sh ${REPO}
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

echo "Wiki published: ${WIKI_WEB_URL}"
