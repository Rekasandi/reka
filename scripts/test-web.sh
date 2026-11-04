#!/bin/sh
# Browser tests: starts Vite on :5173, runs every apps/web/test/*.mjs suite (helpers excluded), stops Vite.
# Real-API suites boot their own Nest app on isolated Postgres (PGlite), so no external services are touched.
# Needs built packages/apps (pnpm build) and a Playwright Chromium (pnpm exec playwright install chromium).
cd "$(dirname "$0")/.." || exit 1
if curl -s -o /dev/null http://localhost:5173; then echo "Port 5173 is in use; stop the dev server first."; exit 1; fi
pnpm --filter @reka/web exec vite --port 5173 --strictPort > /tmp/reka-test-web-vite.log 2>&1 &
VITE_PID=$!
trap 'kill $VITE_PID 2>/dev/null' EXIT INT TERM
for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:5173 && break; sleep 1; done
# Let Vite finish discovering and pre-bundling dependencies before the first test, so it never reloads a page mid-test.
curl -s -o /dev/null http://localhost:5173/src/app/main.tsx; sleep 5
failed=""
for file in apps/web/test/*.mjs; do
  case "$file" in *select-option.mjs|*pick-date.mjs) continue ;; esac
  name=$(basename "$file" .mjs)
  if node "$file" > "/tmp/reka-test-web-$name.log" 2>&1; then echo "✔ $name"; else
    echo "✖ $name"; failed="$failed $name"
    # Show why it failed (CI keeps no /tmp logs), without the noisy stack frames.
    grep -vE '^\s+at ' "/tmp/reka-test-web-$name.log" | tail -n 25 | sed 's/^/    /'
  fi
done
[ -z "$failed" ] || { echo "Failed:$failed"; exit 1; }
