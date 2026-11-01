#!/usr/bin/env bash
# Vercel runs this instead of `npm run build` (package.json "vercel-build").
# Pages are pre-rendered from the database, so its tables must exist first.
set -euo pipefail

echo "Applying database migrations…"
npx prisma migrate deploy

# Set SEED_DEMO_DATA=1 for ONE deploy to load the placeholder catalog,
# locations, tax rates and featured builds, then remove it: re-running the
# seed resets the placeholder products to their original values.
if [ "${SEED_DEMO_DATA:-}" = "1" ]; then
  echo "Loading demo data (SEED_DEMO_DATA=1)…"
  npx prisma db seed
fi

npx next build
