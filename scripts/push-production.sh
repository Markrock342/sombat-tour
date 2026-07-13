#!/usr/bin/env bash
# Push main to Sombattour/425service (Vercel Production) + origin mirror.
# Usage: ./scripts/push-production.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOMBAT_AUTHOR_NAME="Sombattour"
SOMBAT_AUTHOR_EMAIL="240834019+Sombattour@users.noreply.github.com"

if ! git remote get-url sombattour &>/dev/null; then
  git remote add sombattour https://github.com/Sombattour/425service.git
fi

echo "→ Push sombattour (Vercel Production) as ${SOMBAT_AUTHOR_NAME}..."
gh auth switch --user Sombattour
git push sombattour main:main

echo "→ Push origin (Markrock342 mirror)..."
gh auth switch --user Markrock342
git push origin main

echo "✓ Done. Check https://425service.vercel.app in 1–2 min."
