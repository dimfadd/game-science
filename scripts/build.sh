#!/usr/bin/env bash
# Builds the public site into dist/ for Vercel. Only files players need are
# copied: the asset gallery, docs, templates and project notes stay private.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist
for f in index.html welcome.html manifest.webmanifest sw.js; do [ -f "$f" ] && cp "$f" dist/; done
cp -r shared icons dist/
[ -d audio ] && cp -r audio dist/
mkdir -p dist/games
for g in games/*/; do
  name=$(basename "$g")
  [ "$name" = "_template" ] && continue
  cp -r "$g" dist/games/
done
BUILD_ID="${VERCEL_GIT_COMMIT_SHA:-$(date +%s)}"
sed -i "s/__BUILD_ID__/${BUILD_ID:0:12}/" dist/sw.js
echo "Built dist/ (version ${BUILD_ID:0:12})"
