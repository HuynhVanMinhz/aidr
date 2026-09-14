#!/bin/bash
set -e
docker ps --format '{{.Names}} {{.Status}}'
echo '---nginx---'
docker logs aidr-nginx --tail 30 || true
echo '---kc tail---'
docker logs aidr-keycloak --tail 20 || true
sleep 10
echo '---callback---'
curl -sI https://aidr.id.vn/auth/callback | head -15
echo '---login page---'
curl -sS -o /tmp/kc.html -w "login_html:%{http_code} size:%{size_download}\n" \
  'https://aidr.id.vn/auth/realms/aidr/protocol/openid-connect/auth?client_id=aidr-fe&redirect_uri=https%3A%2F%2Faidr.id.vn%2Fauth%2Fcallback&response_type=code&scope=openid' || true
grep -oE 'href="[^"]+\.css[^"]*"' /tmp/kc.html | head -8 || true
CSS=$(grep -oE '/auth/resources/[^"]+\.css' /tmp/kc.html | head -1 || true)
echo "css_path=$CSS"
if [ -n "$CSS" ]; then
  curl -sI "https://aidr.id.vn$CSS" | head -12
fi
head -c 300 /tmp/kc.html; echo
