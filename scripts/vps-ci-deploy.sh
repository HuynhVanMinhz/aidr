#!/usr/bin/env bash
# Called by GitHub Actions after image push + rsync.
# Usage: vps-ci-deploy.sh <image> <tag> <ghcr_user> <ghcr_token>
set -euo pipefail

IMAGE="${1:?image required}"
TAG="${2:?tag required}"
GHCR_USER="${3:?user required}"
GHCR_TOKEN="${4:?token required}"

cd /opt/aidr

FULL_REF="${IMAGE}:${TAG}"
echo "Deploying ${FULL_REF}"

echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

# Keep other secrets; only bump API image pointer
if grep -q '^API_IMAGE=' .env; then
  sed -i "s|^API_IMAGE=.*|API_IMAGE=${FULL_REF}|" .env
else
  echo "API_IMAGE=${FULL_REF}" >> .env
fi

docker compose -f docker-compose.prod.yml --env-file .env pull api
docker compose -f docker-compose.prod.yml --env-file .env up -d api nginx

# Ensure nginx picks up synced conf (bind-mount already live; reload)
docker compose -f docker-compose.prod.yml --env-file .env exec -T nginx nginx -t
docker compose -f docker-compose.prod.yml --env-file .env exec -T nginx nginx -s reload || \
  docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate nginx

docker image prune -f >/dev/null 2>&1 || true
echo "DEPLOY_OK ${FULL_REF}"
