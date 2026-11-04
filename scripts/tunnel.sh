#!/bin/sh
# Starts the Cloudflare quick tunnel (docker compose profile "tunnel") and prints the GitHub webhook URL.
set -e
docker compose --profile tunnel up -d tunnel >/dev/null
printf 'Waiting for the tunnel URL'
for _ in $(seq 1 30); do
  url=$(docker compose --profile tunnel logs tunnel 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1)
  [ -n "$url" ] && break
  printf '.'; sleep 1
done
echo
if [ -z "$url" ]; then echo "No URL yet. Check: docker compose --profile tunnel logs tunnel"; exit 1; fi
echo "Tunnel:      $url  ->  http://localhost:3000"
echo "Webhook URL: $url/api/integrations/github/webhook"
echo "Paste the webhook URL into the GitHub App settings. Stop with: docker compose --profile tunnel stop tunnel"
