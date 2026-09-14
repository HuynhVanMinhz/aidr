#!/bin/bash
set -e
cd /opt/aidr
for i in $(seq 1 24); do
  st=$(docker inspect -f '{{.State.Health.Status}}' aidr-sqlserver 2>/dev/null || echo none)
  echo "try $i sql=$st"
  if [ "$st" = "healthy" ]; then
    echo SQL_HEALTHY
    exit 0
  fi
  if [ "$st" = "unhealthy" ]; then
    docker logs aidr-sqlserver --tail 40
    exit 1
  fi
  sleep 15
done
echo SQL_TIMEOUT
docker logs aidr-sqlserver --tail 40
exit 1
