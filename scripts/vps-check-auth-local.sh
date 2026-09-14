#!/bin/bash
set -e
echo '--- nginx test ---'
docker exec aidr-nginx nginx -t
echo '--- local https via 127.0.0.1 ---'
curl -skI --resolve aidr.id.vn:443:127.0.0.1 https://aidr.id.vn/auth/callback | head -15
echo '--- login ---'
curl -skS --resolve aidr.id.vn:443:127.0.0.1 -o /tmp/kc.html -w "code:%{http_code} size:%{size_download}\n" \
  'https://aidr.id.vn/auth/realms/aidr/protocol/openid-connect/auth?client_id=aidr-fe&redirect_uri=https%3A%2F%2Faidr.id.vn%2Fauth%2Fcallback&response_type=code&scope=openid'
grep -oE 'href="[^"]+\.css[^"]*"' /tmp/kc.html | head -8 || true
CSS=$(grep -oE '/auth/resources/[^"]+\.css' /tmp/kc.html | head -1 || true)
echo "css_path=$CSS"
if [ -n "$CSS" ]; then
  curl -skI --resolve aidr.id.vn:443:127.0.0.1 "https://aidr.id.vn$CSS" | head -12
fi
echo '--- snippet ---'
grep -o '<link[^>]*>' /tmp/kc.html | head -5 || head -c 400 /tmp/kc.html
echo
