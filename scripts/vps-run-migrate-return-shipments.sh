#!/usr/bin/env bash
set -euo pipefail
cd /opt/aidr
set -a
# shellcheck disable=SC1091
source .env
set +a

docker cp /opt/aidr/migrate-return-shipments.sql aidr-sqlserver:/tmp/migrate-return-shipments.sql

docker exec aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d AIDR \
  -i /tmp/migrate-return-shipments.sql

docker exec aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d AIDR \
  -Q "SELECT name FROM sys.tables WHERE name IN (N'ReturnShipments', N'ReturnShipmentEvents') ORDER BY name"

echo MIGRATE_OK
