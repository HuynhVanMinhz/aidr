#!/usr/bin/env bash
# Chạy trên VPS SAU KHI đã scp file vào /opt/aidr
# Usage: bash /opt/aidr/scripts/vps-remote-bootstrap.sh
set -euo pipefail

cd /opt/aidr

mkdir -p fe-dist certbot/www certbot/conf
if [ ! -f fe-dist/index.html ]; then
  echo '<!doctype html><title>AIDR</title><h1>AIDR - deploying...</h1>' > fe-dist/index.html
fi

if [ ! -f .env ]; then
  if [ -f infra/env/prod.local.env ]; then
    cp infra/env/prod.local.env .env
  else
    cp infra/env/prod.env.example .env
    echo "WARN: using example .env - edit passwords before compose up"
  fi
fi
chmod 600 .env

echo "=== /opt/aidr ==="
ls -la
echo "=== docker ==="
docker --version
docker compose version
free -h
echo "Bootstrap dirs + .env OK"
