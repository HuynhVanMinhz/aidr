#!/usr/bin/env bash
# Chạy trên VPS (đã SSH root): bash vps-bootstrap-dirs.sh
set -euo pipefail

mkdir -p /opt/aidr/fe-dist /opt/aidr/certbot/www /opt/aidr/certbot/conf
echo '<!doctype html><title>AIDR</title><h1>AIDR - FE chua deploy</h1>' > /opt/aidr/fe-dist/index.html
chmod 755 /opt/aidr
echo "OK - thu muc:"
ls -la /opt/aidr
